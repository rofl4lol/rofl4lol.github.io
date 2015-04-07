/// <reference path="require.d.ts" />
/// <reference path="knockout.d.ts" />
define(["require", "exports", "User", "Request"], function (require, exports, User, Request) {
    // todo: settings stuff for spectator, changing API key, and deleting login
    // todo: how to host locally (set up IIS, dl page, give permission to folder to IUSR and IIS_IUSRS)
    // todo: deletable logins
    // todo: query parameter for api key to bypass login (for local), goes to blank list
    // todo: error module
    var UserInfo = (function () {
        function UserInfo(summonerName, region, apiKey) {
            this.SummonerName = summonerName;
            this.Region = region;
            this.ApiKey = apiKey;
        }
        return UserInfo;
    })();
    var Login = (function () {
        function Login(regionList, onSuccess) {
            this.Enabled = ko.observable(true);
            this.RegionList = regionList;
            this.RegionSelected = ko.observable("");
            this.SummonerName = ko.observable("");
            this.ApiKey = ko.observable("");
            this.Submit = function loginSubmit() {
                if (!this.Enabled())
                    return;
                if (!this.SummonerName()) {
                    alert("Enter a summoner name.");
                    return;
                }
                if (!this.ApiKey()) {
                    alert("Enter an API key.");
                    return;
                }
                this.Test((function loginTestOnSuccess() {
                    this.LoginSuccess.call(this);
                    onSuccess.call(this, this);
                }).bind(this), (function loginTestOnError(status) {
                    switch (status) {
                        case 429:
                            alert("Error 429: Rate limit exceeded, try again.");
                            break;
                        case 404:
                            alert("Error 404: Summoner not found, try again.");
                            break;
                        case 401:
                            alert("Error 401: API key rejected by server, double-check and try again.");
                            break;
                        case 500:
                            alert("Error 500: Riot API server error, try again.");
                            break;
                        case 503:
                            alert("Error 503: Riot API service is currently down, try again later.");
                            break;
                        case 403:
                        default:
                            alert("Unexpected error " + status + ": Try again.");
                    }
                    this.Enabled(true);
                }).bind(this)); // Test()
            };
            if (!localStorage)
                return;
            var allLoginsRaw = localStorage.getItem("logins");
            if (!allLoginsRaw)
                return;
            var allLogins = JSON.parse(allLoginsRaw);
            if (!allLogins)
                return;
            var self = this;
            allLogins.forEach(function loginCtorForEach(ui) {
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
        Login.prototype.Test = function (onSuccess, onError) {
            if (!this.Enabled())
                return;
            this.Enabled(false);
            Request.Manager.Start(this.ApiKey());
            Request.Manager.GetSummonerByName(this.SummonerName(), this.RegionSelected(), onSuccess, onError, false, null);
        };
        // save login info
        Login.prototype.LoginSuccess = function () {
            if (!localStorage)
                return;
            var allLoginsRaw = localStorage.getItem("logins");
            if (!allLoginsRaw)
                allLoginsRaw = null;
            var allLogins = JSON.parse(allLoginsRaw);
            if (!allLogins)
                allLogins = [];
            var newLogin = new UserInfo(this.SummonerName(), this.RegionSelected(), this.ApiKey());
            allLogins.forEach(function loginSuccessForEach(ui, index) {
                if (ui.SummonerName == newLogin.SummonerName && ui.Region === newLogin.Region)
                    allLogins.splice(index, 1);
            });
            allLogins.push(newLogin);
            localStorage.setItem("logins", JSON.stringify(allLogins));
            console.log(JSON.parse(localStorage.getItem("logins")));
        };
        return Login;
    })();
    var AddSummoner = (function () {
        function AddSummoner(regionList, onSubmit) {
            this.InputText = ko.observable("");
            this.RegionList = regionList;
            this.RegionSelected = ko.observable("");
            this.Submit = onSubmit;
        }
        return AddSummoner;
    })();
    var ContentManager = (function () {
        function ContentManager(regionList, summonerName, summonerRegion) {
            this.User = new User(summonerName, summonerRegion);
            this.TotalRequests = Request.Manager.TotalRequests;
            this._regionList = regionList;
            this.AddSummoner = new AddSummoner(this._regionList, (function addSummonerSubmit() {
                this.User.AddFriend(this.AddSummoner.InputText(), this.AddSummoner.RegionSelected().toLowerCase());
                this.AddSummoner.InputText("");
                document.getElementById("AddSummonerInput").focus();
            }).bind(this));
            this._regionList = regionList;
        }
        return ContentManager;
    })();
    if (!localStorage) {
        // no localStorage when running directly from filesystem
        alert("Your information will not be saved because window.localStorage is not available.");
    }
    var RegionList = ["NA", "BR", "EUNE", "EUW", "KR", "LAN", "LAS", "OCE", "RU", "TR"];
    var login = new Login(RegionList, ShowContent);
    ko.applyBindings(login, document.getElementById("login"));
    function ShowContent(loginInfo) {
        document.getElementById("login").style.display = "none";
        document.getElementById("content").style.display = "block";
        var main = new ContentManager(RegionList, loginInfo.SummonerName(), loginInfo.RegionSelected());
        ko.applyBindings(main, document.getElementById("content"));
        main.User.SpectatorPath = "C:\\Riot Games\\League of Legends\\RADS\\solutions\\lol_game_client_sln\\releases\\0.0.1.79";
    }
});
