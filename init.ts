/// <reference path="require.d.ts" />
/// <reference path="knockout.d.ts" />

import User = require("User");
import Request = require("Request");

// todo: settings stuff for spectator, changing API key, and deleting login
// todo: how to host locally (set up IIS, dl page, give permission to folder to IUSR and IIS_IUSRS)
// todo: deletable logins
// todo: query parameter for api key to bypass login (for local), goes to blank list
// todo: error module

class UserInfo {
    SummonerName: string;
    Region: string;
    ApiKey: string;

    constructor(summonerName: string, region: string, apiKey: string) {
        this.SummonerName = summonerName;
        this.Region = region;
        this.ApiKey = apiKey;
    }
}

class Login {
    Enabled: KnockoutObservable<boolean>;
    RegionList: Array<string>;
    RegionSelected: KnockoutObservable<string>;
    SummonerName: KnockoutObservable<string>;
    ApiKey: KnockoutObservable<string>;
    Submit: () => void;

    private _testing: KnockoutObservable<boolean>;

    constructor(
        regionList: Array<string>,
        onSuccess: (Login) => void
    ) {
        this.Enabled = ko.observable(true);
        this.RegionList = regionList;
        this.RegionSelected = ko.observable("");
        this.SummonerName = ko.observable("");
        this.ApiKey = ko.observable("");

        this.Submit = function loginSubmit() {
            if (!this.Enabled()) return;
            if (!this.SummonerName()) {
                alert("Enter a summoner name.");
                return;
            }
            if (!this.ApiKey()) {
                alert("Enter an API key.");
                return;
            }
            this.Test(
                (function loginTestOnSuccess() {
                    this.LoginSuccess.call(this);
                    onSuccess.call(this, this);
                }).bind(this),
                (function loginTestOnError(status: number) {
                    switch (status) {
                        case 429: // rate limit exceeded
                            alert("Error 429: Rate limit exceeded, try again.");
                            break;
                        case 404: // doesn't exist
                            alert("Error 404: Summoner not found, try again.");
                            break;
                        case 401: // unauthorized, double check api key
                            alert("Error 401: API key rejected by server, double-check and try again.");
                            break;
                        case 500: // server error
                            alert("Error 500: Riot API server error, try again.");
                            break;
                        case 503: // service down
                            alert("Error 503: Riot API service is currently down, try again later.");
                            break;
                        case 403: // forbidden?!
                        default: // unexpected error
                            alert("Unexpected error " + status + ": Try again.");
                    }
                    this.Enabled(true);
                }).bind(this)
            ); // Test()
        };

        if (!localStorage) return;
        var allLoginsRaw = localStorage.getItem("logins");
        if (!allLoginsRaw) return;
        var allLogins: Array<UserInfo> = JSON.parse(allLoginsRaw);
        if (!allLogins) return;

        var self = this;
        allLogins.forEach(function loginCtorForEach(ui: UserInfo) {
            // make links to login as a saved user
            // can't use KO templates or anything since they don't work when run locally
            var userButton = document.createElement("a");
            userButton.className = "userLoginButton";
            userButton.href = "javascript:;";
            userButton.innerText = ui.Region.toUpperCase() + " " + ui.SummonerName;
            userButton.onclick = function userLoginButtonClick() {
                self.RegionSelected(ui.Region);
                self.SummonerName(ui.SummonerName);
                self.ApiKey(ui.ApiKey);
                self.Submit();
            };
            document.getElementById("userList").appendChild(userButton);
        });
    }

    Test(
        onSuccess: (Login) => void,
        onError: (number) => void
    ) {
        if (!this.Enabled()) return;
        this.Enabled(false);

        Request.Manager.Start(this.ApiKey());
        Request.Manager.GetSummonerByName(
            this.SummonerName(),
            this.RegionSelected(),
            onSuccess,
            onError,
            false,
            null);
    }

    // save login info
    LoginSuccess() {
        if (!localStorage) return;
        var allLoginsRaw = localStorage.getItem("logins");
        if (!allLoginsRaw) allLoginsRaw = null;
        var allLogins: Array<UserInfo> = JSON.parse(allLoginsRaw);
        if (!allLogins) allLogins = [];

        var newLogin = new UserInfo(this.SummonerName(), this.RegionSelected(), this.ApiKey());
        allLogins.forEach(function loginSuccessForEach(ui: UserInfo, index: number) { // remove dupes
            if (ui.SummonerName == newLogin.SummonerName && ui.Region === newLogin.Region)
                allLogins.splice(index, 1);
        });

        allLogins.push(newLogin);
        localStorage.setItem("logins", JSON.stringify(allLogins));

        console.log(JSON.parse(localStorage.getItem("logins")));
    }
}

class AddSummoner {
    InputText: KnockoutObservable<string>;
    RegionList: Array<string>;
    RegionSelected: KnockoutObservable<string>;
    Submit: () => void;

    constructor(regionList: Array<string>, onSubmit: () => void) {
        this.InputText = ko.observable("");
        this.RegionList = regionList;
        this.RegionSelected = ko.observable("");
        this.Submit = onSubmit;
    }
}

class ContentManager {
    User: User;
    TotalRequests: KnockoutObservable<number>;
    AddSummoner: AddSummoner;

    private _regionList: Array<string>;

    constructor(
        regionList: Array<string>,
        summonerName: string,
        summonerRegion: string
    ) {
        this.User = new User(summonerName, summonerRegion);
        this.TotalRequests = Request.Manager.TotalRequests;
        this._regionList = regionList;
        this.AddSummoner = new AddSummoner(
            this._regionList,
            (function addSummonerSubmit() {
                this.User.AddFriend(
                    this.AddSummoner.InputText(),
                    this.AddSummoner.RegionSelected().toLowerCase());
                this.AddSummoner.InputText("");
                document.getElementById("AddSummonerInput").focus();
            }).bind(this)
        );

        this._regionList = regionList;
    }
}


if (!localStorage) {
    // no localStorage when running directly from filesystem
    alert("Your information will not be saved because window.localStorage is not available.");
}

var RegionList = ["NA", "BR", "EUNE", "EUW", "KR", "LAN", "LAS", "OCE", "RU", "TR"];

var login = new Login(RegionList, ShowContent);
ko.applyBindings(login, document.getElementById("login"));

function ShowContent(loginInfo: Login) {
    document.getElementById("login").style.display = "none";
    document.getElementById("content").style.display = "block";

    var main = new ContentManager(RegionList, loginInfo.SummonerName(), loginInfo.RegionSelected());
    ko.applyBindings(main, document.getElementById("content"));


    main.User.SpectatorPath = "C:\\Riot Games\\League of Legends\\RADS\\solutions\\lol_game_client_sln\\releases\\0.0.1.79";
}
