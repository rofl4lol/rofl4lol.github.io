define(["require", "exports"], function (require, exports) {
    var Request;
    (function (Request) {
        var Info = (function () {
            function Info(path, onSuccess, onError) {
                this.Path = path;
                this.OnSuccess = onSuccess;
                this.OnError = onError;
            }
            return Info;
        })();
        Request.Info = Info;
        var Manager = (function () {
            function Manager() {
            }
            Manager.requestStillValid = function (waitQueue, ri) {
                var fromWaiting = waitQueue.remove(ri);
                if (fromWaiting.length > 1) {
                    alert("Error: Request.Manager.requestStillValid(): Removed too many from waiting queue.");
                    return false;
                }
                else if (fromWaiting.length != 1)
                    return false;
                return true;
            };
            Manager.Start = function (apiKey) {
                if (!Manager._initialized) {
                    if (!Manager._refreshQueue)
                        Manager._refreshQueue = ko.observableArray([]);
                    if (!Manager._refreshQueueWaiting)
                        Manager._refreshQueueWaiting = ko.observableArray([]);
                    if (!Manager._hiPriQueue)
                        Manager._hiPriQueue = ko.observableArray([]);
                    if (!Manager._hiPriQueueWaiting)
                        Manager._hiPriQueueWaiting = ko.observableArray([]);
                    if (!Manager.TotalRequests) {
                        Manager.TotalRequests = ko.computed(function RequestManagerTotalRequests() {
                            return Manager._refreshQueue().length + Manager._refreshQueueWaiting().length + Manager._hiPriQueue().length + Manager._hiPriQueueWaiting().length;
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
                        Manager.sendRequest(info.Path, (function ManagerHiPriSuccessWrapper(ri) {
                            return function ManagerHiPriSuccess(responseText) {
                                if (Manager.requestStillValid(Manager._hiPriQueueWaiting, ri))
                                    ri.OnSuccess(responseText);
                                // else it wasn't in waiting queue so it was cancelled
                            };
                        })(info), (function ManagerHiPriErrorWrapper(ri) {
                            return function ManagerHiPriError(status) {
                                if (!Manager.requestStillValid(Manager._hiPriQueueWaiting, ri))
                                    return;
                                else if (status === 429)
                                    Manager.queueInternal(ri, Manager._hiPriQueue, Manager._hiPriQueueWaiting); // requeue and try again later
                                else
                                    ri.OnError(status);
                            };
                        })(info)); // sendRequest()
                    }
                    else if (Manager._refreshQueue().length > 0) {
                        var info = Manager._refreshQueue.shift();
                        Manager._refreshQueueWaiting.push(info);
                        Manager.sendRequest(info.Path, (function ManagerRefreshSuccessWrapper(ri) {
                            return function ManagerRefreshSuccess(responseText) {
                                if (!Manager.requestStillValid(Manager._refreshQueueWaiting, ri))
                                    return;
                                Manager.queueInternal(ri, Manager._refreshQueue, Manager._refreshQueueWaiting); // requeue
                                ri.OnSuccess(responseText);
                            };
                        })(info), (function ManagerRefreshErrorWrapper(ri) {
                            return function ManagerRefreshError(status) {
                                if (!Manager.requestStillValid(Manager._refreshQueueWaiting, ri))
                                    return;
                                else if (status !== 429)
                                    ri.OnError(status);
                                Manager.queueInternal(ri, Manager._refreshQueue, Manager._refreshQueueWaiting); // requeue
                            };
                        })(info)); // sendRequest()
                    }
                }
                ;
            };
            Manager.GetSummonerByName = function (name, region, onSuccess, onError, refresh, info) {
                var path = Manager.makePath(region, "api/lol/" + region + "/v1.4/summoner/by-name/" + name);
                return Manager.queue(path, onSuccess, onError, refresh, info);
            };
            Manager.GetCurrentGameBySummonerId = function (summonerId, region, onSuccess, onError, refresh, info) {
                var platformId = "";
                switch (region) {
                    case "na":
                        platformId = "NA1";
                        break;
                    case "euw":
                        platformId = "EUW1";
                        break;
                    case "eune":
                        platformId = "EUN1";
                        break;
                    case "kr":
                        platformId = "KR";
                        break;
                    case "oce":
                        platformId = "OC1";
                        break;
                    case "br":
                        platformId = "BR1";
                        break;
                    case "lan":
                        platformId = "LA1";
                        break;
                    case "las":
                        platformId = "LA2";
                        break;
                    case "ru":
                        platformId = "RU";
                        break;
                    case "tr":
                        platformId = "TR1";
                        break;
                    case "pbe":
                        platformId = "PBE1";
                        break;
                    default: alert("GetCurrentGameBySummonerId(): Unexpected region: " + region);
                }
                var path = Manager.makePath(region, "observer-mode/rest/consumer/getSpectatorGameInfo/" + platformId + "/" + summonerId);
                return Manager.queue(path, onSuccess, onError, refresh, info);
            };
            Manager.GetSummonersByIds = function (summonerIds, region, onSuccess, onError, refresh, info) {
                var path = Manager.makePath(region, "api/lol/" + region + "/v1.4/summoner/" + summonerIds.join(','));
                return Manager.queue(path, onSuccess, onError, refresh, info);
            };
            Manager.queue = function (path, onSuccess, onError, refresh, info) {
                if (!info)
                    info = new Info(path, onSuccess, onError);
                Manager.queueInternal(info, Manager._hiPriQueue, Manager._hiPriQueueWaiting);
                if (refresh)
                    Manager.queueInternal(info, Manager._refreshQueue, Manager._refreshQueueWaiting);
                return info;
            };
            Manager.queueInternal = function (info, queue, waitingQueue) {
                if (queue.indexOf(info) > -1 || waitingQueue.indexOf(info) > -1)
                    return; // don't queue up a duplicate request
                queue.push(info);
            };
            Manager.makePath = function (region, endpoint) {
                return "https://" + region + ".api.pvp.net/" + endpoint;
            };
            Manager.sendRequest = function (url, onSuccess, onError) {
                url += "?api_key=" + Manager.ApiKey;
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url);
                xhr.onload = function ManagerSendRequest() {
                    if (xhr.readyState == 4) {
                        switch (xhr.status) {
                            case 200:
                                onSuccess(xhr.responseText);
                                break;
                            case 429:
                                alert("Error 429: Rate limit exceeded. Should have been handled.");
                            case 404:
                                onError(xhr.status);
                                break;
                            case 401:
                                alert("Error 401: API key rejected, is it correct?");
                                onError(xhr.status);
                                break;
                            case 500:
                                alert("Error 500: Riot API server error, please try again.");
                                onError(xhr.status);
                                break;
                            case 503:
                                alert("Error 503: Riot API service is down, please try again later.");
                                onError(xhr.status);
                                break;
                            case 403:
                            default:
                                var cleanUrl = url.substring(0, url.indexOf('?'));
                                alert("Unexpected error code " + xhr.status + " for request to path: " + cleanUrl);
                                onError(xhr.status);
                        }
                    }
                }; // xhr.onload
                xhr.send(null); // null: for IE bug
            }; // sendRequest()
            Manager.CancelRequest = function (requestInfo) {
                if (!requestInfo)
                    return;
                Manager._hiPriQueue.remove(requestInfo);
                Manager._hiPriQueueWaiting.remove(requestInfo);
                Manager._refreshQueue.remove(requestInfo);
                Manager._refreshQueueWaiting.remove(requestInfo);
            };
            Manager._initialized = false;
            return Manager;
        })();
        Request.Manager = Manager;
    })(Request || (Request = {}));
    return Request;
});
