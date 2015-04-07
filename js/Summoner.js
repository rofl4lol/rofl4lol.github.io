/// <reference path="Interfaces.ts"/>
define(["require", "exports", "Request", "Utility", "CurrentGame"], function (require, exports, Request, Utility, CurrentGame) {
    var Summoner = (function () {
        function Summoner(tempName, region) {
            var self = this;
            // init public non-computables
            self.Name = ko.observable(tempName);
            self.Region = region.toLowerCase();
            self.ProfileIcon = ko.observable(-1);
            self.CurrGame = new CurrentGame();
            self.RefreshEnabled = ko.observable(false);
            // init private non-computables
            self._revisionDate = ko.observable(-1);
            self._currentGameLastCheckedTime = ko.observable(-1);
            // init public computables
            this.LastModifiedAgo = ko.computed(function summonerLastModifiedAgo() {
                if (self._revisionDate() === -1)
                    return "?";
                var toReturn = Utility.TimeSinceAgo(self._revisionDate());
                // either come back and update it in 1s, or 1m
                clearTimeout(self._updateLastModifiedAgoTimeout);
                if (toReturn.indexOf("sec") !== -1)
                    self._updateLastModifiedAgoTimeout = setTimeout(self._revisionDate.valueHasMutated, Math.random() * 20000 + 10000); // 10-30s
                else
                    self._updateLastModifiedAgoTimeout = setTimeout(self._revisionDate.valueHasMutated, Math.random() * 2000 * 60); // 0-2m
                return toReturn;
            });
            this.LastModifiedDate = ko.computed(function summonerLastModifiedAgo() {
                if (self._revisionDate() === -1)
                    return "?";
                return Utility.GetFriendlyDate(new Date(self._revisionDate()));
            });
            self.CurrentGameMessage = ko.computed(function SummonerCurrentGameMessage() {
                var currGameType = self.CurrGame.GameType();
                var currGameElapsed = self.CurrGame.ElapsedTime();
                var currGameLastChecked = self._currentGameLastCheckedTime();
                if (currGameLastChecked < 0)
                    return "";
                if (!currGameType) {
                    clearTimeout(self._updateCurrentGameLastCheckedTimeTimeout);
                    var timeAgo = Utility.TimeSinceAgo(currGameLastChecked);
                    if (timeAgo.indexOf("sec") > -1)
                        self._updateCurrentGameLastCheckedTimeTimeout = setTimeout(function () {
                            self._currentGameLastCheckedTime.valueHasMutated();
                        }, Math.random() * 20000 + 10000); // 10-30s
                    else
                        self._updateCurrentGameLastCheckedTimeTimeout = setTimeout(function () {
                            self._currentGameLastCheckedTime.valueHasMutated();
                        }, Math.random() * 2000 * 60); // 0-2m
                    return "No active game: " + Utility.TimeSinceAgo(currGameLastChecked);
                }
                return currGameType + " - " + currGameElapsed;
            });
            // init private computables
            self._updateRefreshRequests = ko.computed(function SummonerUpdateRefreshRequests() {
                if (!self.RefreshEnabled())
                    self.CancelCurrentGameRequest();
                else
                    self.GetCurrentGame();
            });
        } // ctor
        Summoner.prototype.Hydrate = function (summonerObject) {
            var self = this;
            self.Id = summonerObject.id;
            self.Name(summonerObject.name);
            self.ProfileIcon = ko.observable(summonerObject.profileIconId);
            if (summonerObject.revisionDate > self._revisionDate())
                self._revisionDate(summonerObject.revisionDate);
            if (self.RefreshEnabled())
                self.GetCurrentGame();
        };
        // once only
        Summoner.prototype.GetData = function (successCallback, errorCallback) {
            var self = this;
            Request.Manager.GetSummonerByName(self.Name(), self.Region, function SummonerGetDataSuccess(responseText) {
                self.Hydrate(JSON.parse(responseText)[self.Name().toLowerCase().replace(/\s/g, "")]);
                successCallback();
            }, function SummonerGetDataError(status) {
                alert("Summoner.GetData() error: " + status); // todo: handle 404
                errorCallback(status);
            }, false, null);
        };
        // refreshes
        Summoner.prototype.GetCurrentGame = function () {
            var self = this;
            if (!self.Id)
                return;
            if (self._currentGameRequest)
                return; // there's already a request in flight
            self._currentGameRequest = Request.Manager.GetCurrentGameBySummonerId(self.Id, self.Region, function SummonerGetCurrentGameSuccess(responseText) {
                self._currentGameLastCheckedTime(Date.now());
                var game = JSON.parse(responseText);
                self.CurrGame.Hydrate(responseText);
                self._revisionDate(Date.now());
            }, function SummonerGetCurrentGameError(status) {
                self._currentGameLastCheckedTime(Date.now());
                if (status === 404)
                    self.CurrGame.Blank();
            }, true, self._currentGameRequest);
        };
        Summoner.prototype.CancelCurrentGameRequest = function () {
            var self = this;
            if (!!self._currentGameRequest)
                Request.Manager.CancelRequest(self._currentGameRequest);
            self._currentGameRequest = null;
        };
        return Summoner;
    })();
    return Summoner;
});
