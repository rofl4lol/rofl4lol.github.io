/// <reference path="Interfaces.ts"/>
define(["require", "exports", "Utility"], function (require, exports, Utility) {
    var CurrentGame = (function () {
        function CurrentGame(rawJson) {
            var self = this;
            self._startTime = ko.observable(-1);
            self.GameType = ko.observable("");
            self.Spectatable = ko.observable(false);
            self.ElapsedTime = ko.computed(function CurrentGameElapsedTime() {
                var startTime = self._startTime();
                var gameType = self.GameType();
                if (!gameType)
                    return "";
                else if (startTime === -1)
                    return "Loading...";
                self.Spectatable(true);
                clearTimeout(self._updateElapsedTimeTimeout);
                setTimeout(function () {
                    self._startTime.valueHasMutated();
                }, Math.random() * 2000); // 0-2s
                return Utility.TimeSinceDuration(self._startTime());
            });
            if (!!rawJson)
                self.Hydrate(rawJson);
        }
        CurrentGame.prototype.Hydrate = function (rawJson) {
            var self = this;
            var currentGame = JSON.parse(rawJson);
            self._startTime(currentGame.gameStartTime);
            self._id = currentGame.gameId;
            self._platformId = currentGame.platformId;
            self._encryptionKey = currentGame.observers.encryptionKey;
            switch (currentGame.gameQueueConfigId) {
                case 0:
                    self.GameType("Custom");
                    break;
                case 2:
                    self.GameType("Normal 5");
                    break;
                case 7:
                    self.GameType("Co-op");
                    break;
                case 31:
                    self.GameType("Co-op");
                    break;
                case 32:
                    self.GameType("Co-op");
                    break;
                case 33:
                    self.GameType("Co-op");
                    break;
                case 8:
                    self.GameType("Normal 3");
                    break;
                case 14:
                    self.GameType("Draft 5");
                    break;
                case 16:
                    self.GameType("Dominion");
                    break;
                case 17:
                    self.GameType("Dominion Draft");
                    break;
                case 25:
                    self.GameType("Co-op (Dom)");
                    break;
                case 4:
                    self.GameType("Ranked 5");
                    break;
                case 9:
                    self.GameType("Ranked 3");
                    break;
                case 6:
                    self.GameType("Ranked 5");
                    break;
                case 41:
                    self.GameType("Ranked Team 3");
                    break;
                case 42:
                    self.GameType("Ranked Team 5");
                    break;
                case 52:
                    self.GameType("Co-op (TT)");
                    break;
                case 61:
                    self.GameType("Team Builder 5");
                    break;
                case 65:
                    self.GameType("ARAM");
                    break;
                case 70:
                    self.GameType("One for All");
                    break;
                case 72:
                    self.GameType("Snowdown Showdown 1");
                    break;
                case 73:
                    self.GameType("Snowdown Showdown 2");
                    break;
                case 75:
                    self.GameType("Hexakill");
                    break;
                case 76:
                    self.GameType("URF");
                    break;
                case 83:
                    self.GameType("Co-op (URF)");
                    break;
                case 91:
                    self.GameType("Doom Bots I");
                    break;
                case 92:
                    self.GameType("Doom Bots II");
                    break;
                case 93:
                    self.GameType("Doom Bots V");
                    break;
                case 96:
                    self.GameType("Ascension");
                    break;
                case 98:
                    self.GameType("Hexakill (TT)");
                    break;
                case 300:
                    self.GameType("King Poro");
                    break;
                case 310:
                    self.GameType("Nemesis");
                    break;
                default: self.GameType("Unknown");
            }
        };
        CurrentGame.prototype.GetSpectateCommandParams = function () {
            var self = this;
            var domain = "";
            switch (self._platformId.toUpperCase()) {
                case "NA1":
                    domain = "spectator.na.lol.riotgames.com:80";
                    break;
                case "EUW1":
                    domain = "spectator.euw1.lol.riotgames.com:80";
                    break;
                case "EUN1":
                    domain = "spectator.eu.lol.riotgames.com:8080";
                    break;
                case "KR":
                    domain = "spectator.kr.lol.riotgames.com:80";
                    break;
                case "OC1":
                    domain = "spectator.oc1.lol.riotgames.com:80";
                    break;
                case "BR1":
                    domain = "spectator.br.lol.riotgames.com:80";
                    break;
                case "LA1":
                    domain = "spectator.la1.lol.riotgames.com:80";
                    break;
                case "LA2":
                    domain = "spectator.la2.lol.riotgames.com:80";
                    break;
                case "RU":
                    domain = "spectator.ru.lol.riotgames.com:80";
                    break;
                case "TR1":
                    domain = "spectator.tr.lol.riotgames.com:80";
                    break;
                case "PBE1":
                    domain = "spectator.pbe1.lol.riotgames.com:8080";
                    break;
                default: alert("Error: GetSpectateCommandParams(): unknown platform id");
            }
            return '"spectator ' + domain + ' ' + this._encryptionKey + " " + this._id + " " + this._platformId + '"';
        };
        CurrentGame.prototype.Blank = function () {
            this.GameType("");
            this._startTime(-1);
            this.Spectatable(false);
        };
        return CurrentGame;
    })();
    return CurrentGame;
});
