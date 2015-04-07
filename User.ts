import Summoner = require("Summoner");
import Request = require("Request");

class User {

    SummonerName: string;
    Region: string;
    ApiKey: string;

    Friends: KnockoutObservableArray<Summoner>;

    private _storedFriendsKey: string;
    private _refreshAllEnabled: KnockoutObservable<boolean>;
    private _updateRefreshAll: KnockoutComputed<void>;
    private _batchedRequestsForSummonerStatus: Array<Request.Info>;

    private _spectatorPath: string; // filepath
    set SpectatorPath(path: string) {
        path = path.trim().replace('/', '\\');

        if (path.charAt(path.length - 1) == '\\')
            path = path.substr(0, path.length - 1);

        this._spectatorPath = path;
    }
    get SpectatorPath() {
        return this._spectatorPath;
    }

    constructor(name: string, region: string) {
        var self = this;

        this.SummonerName = name;
        this.Region = region;
        this.Friends = ko.observableArray<Summoner>([]);
        this._spectatorPath = "";
        this._batchedRequestsForSummonerStatus = [];

        this._storedFriendsKey = (this.Region + this.SummonerName).toLowerCase().replace(/\s/g, "");
        this._refreshAllEnabled = ko.observable(false);
        this._updateRefreshAll = ko.computed(function UserUpdateRefreshAll() {
            var refreshAllEnabled = self._refreshAllEnabled();

            self.Friends.peek().forEach(function UserUpdateRefreshAll(s: Summoner) {
                s.RefreshEnabled(refreshAllEnabled);
            });
        });

        // load saved friends
        if (!!localStorage) {
            var savedFriendsRaw = localStorage.getItem(this._storedFriendsKey);
            if (!!savedFriendsRaw) {
                var savedFriends: Array<IFriendsInternal> = JSON.parse(savedFriendsRaw);
                savedFriends.forEach(function UserCtorSavedFriendsForEach(f: IFriendsInternal) {
                    self.AddFriend(f.Name, f.Region);
                });
            }
        }

        if (this.Friends().length == 0) // aw so sad
            this.AddFriend(self.SummonerName, self.Region);
    }

    AddFriend(name: string, region: string) {
        var self = this;
        var region = region.toLowerCase();

        var alreadyAdded = false;
        self.Friends().forEach(function UserAddFriendDuplicateCheck(s: Summoner) {
            if (s.Name().toLowerCase().replace(/\s/g, "") === name.toLowerCase().replace(/\s/g, "")
                && s.Region.toLowerCase() === region)
                alreadyAdded = true;
        });

        if (alreadyAdded) return;

        var placeholderSummoner = new Summoner(name, region);
        placeholderSummoner.RefreshEnabled(self._refreshAllEnabled());
        self.Friends.push(placeholderSummoner);
        self._updateFriendsIdList();

        placeholderSummoner.GetData(
            self._updateFriendsIdList.bind(this), // success
            self.RemoveFriend.bind(self, placeholderSummoner)
        );
    }

    RemoveFriend(summoner: Summoner) {
        var self = this;

        var removed: Array<Summoner> = self.Friends.remove(summoner);

        if (removed.length > 1) {
            alert("User.RemoveFriend() error: removed length > 1");
            debugger;
        }
        if (removed.length === 0) {
            alert("User.RemoveFriend() error: removed length == 0");
            debugger;
        }

        self._updateFriendsIdList();
    }

    private _updateFriendsIdList() {
        // make a list of all friends with just summoner ID and region
        var friendsList: Array<IFriendsInternal> = [];
        this.Friends().forEach(function UserUpdateFriendsIdListMakeList(f: Summoner) {
            if (!f.Id && !f.Name()) return;
            friendsList.push({ Id: f.Id, Name: f.Name(), Region: f.Region.toLowerCase() });
        });

        // store it
        if (localStorage) {
            localStorage.setItem(
                this._storedFriendsKey,
                JSON.stringify(friendsList));
        }

        //*** Now, create batched requests for summoner info which takes 40 IDs per region at a time.
        //    (todo: should throttle doing this for perf at some point)
        // cancel the previous batched requests
        this._batchedRequestsForSummonerStatus.forEach(
            function UserUpdateFriendsIdListCancelPreviousRequests(ri: Request.Info) {
                Request.Manager.CancelRequest(ri);
        });

        // maps a given region to a group of buckets, one "bucket" is up to 40 summoners
        var regionToBucketsMap: { [region: string]: Array<Array<number>> } = {};
        // iterate through friends and split them into buckets
        friendsList.forEach(function UserUpdateFriendsIdListBucketing(f: IFriendsInternal) {
            if (!f.Id) return; // no id: just a placeholder, request should be in flight elsewhere
            // get the group of buckets for the friend's region
            if (!regionToBucketsMap[f.Region]) regionToBucketsMap[f.Region] = [];
            var regionBuckets = regionToBucketsMap[f.Region];
            // get a bucket to put this friend into
            if (regionBuckets.length <= 0) regionBuckets.push([]);
            var lastBucket = regionBuckets[regionBuckets.length - 1];
            if (lastBucket.length > 40)
                alert("Error: bucket shouldn't have more than 40 items."); // sanity check
            else if (lastBucket.length === 40) {
                regionBuckets.push([]);
                lastBucket = regionBuckets[regionBuckets.length - 1];
            }
            lastBucket.push(f.Id);
        });

        // now create the requests and save the Request.Infos
        this._batchedRequestsForSummonerStatus = [];
        var self = this;
        for (var region in regionToBucketsMap) {
            regionToBucketsMap[region].forEach(function ForEachGroupOfBuckets(bucket: Array<number>) {
                self._batchedRequestsForSummonerStatus.push(
                    Request.Manager.GetSummonersByIds(
                        bucket,
                        region,
                        (function BatchedSummonersRequestSuccessWrapper(r: string) {
                            return function BatchedSummonersRequestSuccess(responseText: string) {
                                var batchedSummonerData: IBatchedSummonersById = JSON.parse(responseText);
                                for (var summonerId in batchedSummonerData) {
                                    var thisSummoner: ISummoner = batchedSummonerData[summonerId];
                                    self.Friends().forEach(function BatchedSummonersUpdateSummoner(s: Summoner) {
                                        if (r === s.Region
                                            && (summonerId === s.Id
                                                || thisSummoner.name.toLowerCase().replace(/\s/g, "") === s.Name().toLowerCase().replace(/\s/g, ""))) {
                                            s.Hydrate(thisSummoner);
                                        }
                                    });
                                }
                            }
                        })(region),
                        function BatchedSummonersRequestError(status: number) {
                            alert("Error: Batched summoner request failed with status: " + status);
                        },
                        true,
                        null)
                );
            });
        }
    }

    GetSpectateCommand(summoner: Summoner) {
        var self = this;
        if (!summoner.CurrGame.Spectatable()) {
            alert("Error: game not spectatable at this time.");
            return;
        }

        return 'cd "' + self._spectatorPath + '" & "' + self._spectatorPath + '\\deploy\\League of Legends.exe" '
            + '"8394" "LoLLauncher.exe" "" '
            + summoner.CurrGame.GetSpectateCommandParams()
            + " & exit";
    }

    PromptSpectateCommand(summoner: Summoner) {
        var self = this;
        if (!summoner.CurrGame.Spectatable()) {
            alert("Error: game not spectatable at this time.");
            return;
        }

        prompt(
            "Copy and paste into a command window.\nSee below for spectator instructions.",
            self.GetSpectateCommand(summoner));
    }
}

interface IFriendsInternal {
    Id: number;
    Name: string;
    Region: string;
}

export = User;