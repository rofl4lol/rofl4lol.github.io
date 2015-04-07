/* Interfaces for Riot API returned objects ONLY */

interface ISummoner {
    id: number;
    name: string;
    profileIconId: number;
    revisionDate: number;
    summonerLevel: number;
}

interface IObserverKey { // called Observer in API doc
    encryptionKey: string;
}
interface ICurrentGame {
    gameId: number;
    gameLength: number;
    gameMode: string;
    gameQueueConfigId: number;
    gameStartTime: number;
    gameType: string;
    mapId: number;
    observers: IObserverKey;
    platformId: string;
}

interface IBatchedSummonersById {
    [summonerId: string]: ISummoner
}