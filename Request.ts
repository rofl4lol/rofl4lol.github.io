import Summoner = require("Summoner");

module Request {

    export class Info {
        Path: string;
        OnSuccess: (string) => void;
        OnError: (number) => void;

        constructor(path: string, onSuccess: (string) => void, onError: (number) => void) {
            this.Path = path;
            this.OnSuccess = onSuccess;
            this.OnError = onError;
        }
    }

    export class Manager {
        static ApiKey: string;

        static TotalRequests: KnockoutComputed<number>;

        private static _refreshQueue: KnockoutObservableArray<Info>;
        private static _refreshQueueWaiting: KnockoutObservableArray<Info>;
        private static _hiPriQueue: KnockoutObservableArray<Info>;
        private static _hiPriQueueWaiting: KnockoutObservableArray<Info>;

        private static _delayedRequestInterval: number;
        private static _initialized: boolean = false;

        private static requestStillValid(waitQueue: KnockoutObservableArray<Info>, ri: Info): boolean {
            var fromWaiting: Array<Info> = waitQueue.remove(ri);
            if (fromWaiting.length > 1) {
                alert("Error: Request.Manager.requestStillValid(): Removed too many from waiting queue.");
                return false;
            } else if (fromWaiting.length != 1)
                return false;
            return true;
        }

        static Start(apiKey: string) {
            if (!Manager._initialized) {
                if (!Manager._refreshQueue) Manager._refreshQueue = ko.observableArray([]);
                if (!Manager._refreshQueueWaiting) Manager._refreshQueueWaiting = ko.observableArray([]);
                if (!Manager._hiPriQueue) Manager._hiPriQueue = ko.observableArray([]);
                if (!Manager._hiPriQueueWaiting) Manager._hiPriQueueWaiting = ko.observableArray([]);

                if (!Manager.TotalRequests) {
                    Manager.TotalRequests = ko.computed(function RequestManagerTotalRequests() {
                        return Manager._refreshQueue().length
                            + Manager._refreshQueueWaiting().length
                            + Manager._hiPriQueue().length
                            + Manager._hiPriQueueWaiting().length;
                    });
                }

                Manager._delayedRequestInterval = setInterval(sendNextRequest, 1250); // 50ms wiggle room to avoid rate limit

                Manager._initialized = true;
            }

            Manager.ApiKey = apiKey;

            function sendNextRequest() {
                if (Manager._hiPriQueue().length > 0) {
                    var info = Manager._hiPriQueue.shift();
                    Manager._hiPriQueueWaiting.push(info);
                    Manager.sendRequest(
                        info.Path,
                        (function ManagerHiPriSuccessWrapper(ri: Info) {
                            return function ManagerHiPriSuccess(responseText: string) {
                                if (Manager.requestStillValid(Manager._hiPriQueueWaiting, ri))
                                    ri.OnSuccess(responseText);
                                // else it wasn't in waiting queue so it was cancelled
                            }
                        })(info),
                        (function ManagerHiPriErrorWrapper(ri: Info) {
                            return function ManagerHiPriError(status: number) {
                                if (!Manager.requestStillValid(Manager._hiPriQueueWaiting, ri))
                                    return;
                                else if (status === 429) // rate limit exceeded, requeue and try again
                                    Manager.queueInternal(ri, Manager._hiPriQueue, Manager._hiPriQueueWaiting); // requeue and try again later
                                else
                                    ri.OnError(status);
                            }
                        })(info)
                    ); // sendRequest()
                } else if (Manager._refreshQueue().length > 0) { // no hi pri requests
                    var info = Manager._refreshQueue.shift();
                    Manager._refreshQueueWaiting.push(info);
                    Manager.sendRequest(
                        info.Path,
                        (function ManagerRefreshSuccessWrapper(ri: Info) {
                            return function ManagerRefreshSuccess(responseText: string) {
                                if (!Manager.requestStillValid(Manager._refreshQueueWaiting, ri))
                                    return;

                                Manager.queueInternal(ri, Manager._refreshQueue, Manager._refreshQueueWaiting); // requeue
                                ri.OnSuccess(responseText);
                            }
                        })(info),
                        (function ManagerRefreshErrorWrapper(ri: Info) {
                            return function ManagerRefreshError(status: number) {
                                if (!Manager.requestStillValid(Manager._refreshQueueWaiting, ri))
                                    return;
                                else if (status !== 429) // rate limit exceeded, ignore since it'll requeue
                                    ri.OnError(status);

                                Manager.queueInternal(ri, Manager._refreshQueue, Manager._refreshQueueWaiting); // requeue
                            }
                        })(info)
                    ); // sendRequest()
                }
            }; // sendNextRequest()
        }

        static GetSummonerByName(
            name: string,
            region: string,
            onSuccess: (string) => void,
            onError: (number) => void,
            refresh: boolean,
            info: Info
        ): Info {
            var path = Manager.makePath(region, "api/lol/" + region + "/v1.4/summoner/by-name/" + name);

            return Manager.queue(path, onSuccess, onError, refresh, info);
        }

        static GetCurrentGameBySummonerId(
            summonerId: number,
            region: string,
            onSuccess: (string) => void,
            onError: (number) => void,
            refresh: boolean,
            info: Info
        ): Info {
            var platformId = "";
            switch (region) {
                case "na":   platformId = "NA1";  break;
                case "euw":  platformId = "EUW1"; break;
                case "eune": platformId = "EUN1"; break;
                case "kr":   platformId = "KR";   break;
                case "oce":  platformId = "OC1";  break;
                case "br":   platformId = "BR1";  break;
                case "lan":  platformId = "LA1";  break;
                case "las":  platformId = "LA2";  break;
                case "ru":   platformId = "RU";   break;
                case "tr":   platformId = "TR1";  break;
                case "pbe":  platformId = "PBE1"; break;
                default: alert("GetCurrentGameBySummonerId(): Unexpected region: " + region);
            }

            var path = Manager.makePath(
                region,
                "observer-mode/rest/consumer/getSpectatorGameInfo/" + platformId +"/" + summonerId);

            return Manager.queue(path, onSuccess, onError, refresh, info);
        }

        static GetSummonersByIds(
            summonerIds: Array<number>,
            region: string,
            onSuccess: (string) => void,
            onError: (number) => void,
            refresh: boolean,
            info: Info
        ): Info {
            var path = Manager.makePath(
                region,
                "api/lol/" + region + "/v1.4/summoner/" + summonerIds.join(','));

            return Manager.queue(path, onSuccess, onError, refresh, info);
        }

        private static queue(
            path: string,
            onSuccess: (string) => void,
            onError: (number) => void,
            refresh: boolean,
            info: Info
        ): Info {
            if (!info)
                info = new Info(path, onSuccess, onError);

            Manager.queueInternal(info, Manager._hiPriQueue, Manager._hiPriQueueWaiting);
            if (refresh) Manager.queueInternal(info, Manager._refreshQueue, Manager._refreshQueueWaiting);

            return info;
        }

        private static queueInternal(
            info: Info,
            queue: KnockoutObservableArray<Info>,
            waitingQueue: KnockoutObservableArray<Info>
        ) {
            if (queue.indexOf(info) > -1 || waitingQueue.indexOf(info) > -1)
                return; // don't queue up a duplicate request
            queue.push(info);
        }


        private static makePath(
            region: string,
            endpoint: string
            ): string {
            return "https://" + region + ".api.pvp.net/" + endpoint;
        }

        private static sendRequest(
            url: string,
            onSuccess: (responseText: string) => void,
            onError: (status: number) => void
        ) {
            url += "?api_key=" + Manager.ApiKey;
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url);

            xhr.onload = function ManagerSendRequest() {
                if (xhr.readyState == 4) {
                    switch (xhr.status) {
                        case 200:
                            onSuccess(xhr.responseText);
                            break;
                        case 429: // rate limit exceeded, should be handled above
                            alert("Error 429: Rate limit exceeded. Should have been handled.");
                        case 404: // doesn't exist
                            onError(xhr.status);
                            break;
                        case 401: // unauthorized, double check api key
                            alert("Error 401: API key rejected, is it correct?");
                            onError(xhr.status);
                            break;
                        case 500: // server error
                            alert("Error 500: Riot API server error, please try again.");
                            onError(xhr.status);
                            break;
                        case 503: // service down
                            alert("Error 503: Riot API service is down, please try again later.");
                            onError(xhr.status);
                            break;
                        case 403: // forbidden?!
                        default: // unexpected error
                            var cleanUrl = url.substring(0, url.indexOf('?'));
                            alert("Unexpected error code " + xhr.status + " for request to path: " + cleanUrl);
                            onError(xhr.status);
                    }
                }
            }; // xhr.onload

            xhr.send(null); // null: for IE bug
        } // sendRequest()

        static CancelRequest(requestInfo: Info) {
            if (!requestInfo) return;

            Manager._hiPriQueue.remove(requestInfo);
            Manager._hiPriQueueWaiting.remove(requestInfo);
            Manager._refreshQueue.remove(requestInfo);
            Manager._refreshQueueWaiting.remove(requestInfo);
        }
    }
}

export = Request;