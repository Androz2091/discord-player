declare module 'spotify-url-info' {
    export interface Spotify {
        getPreview(url: string, opts?: RequestInit): Promise<any>;
        getTracks(url: string, opts?: RequestInit): Promise<any>;
        getDetails(url: string, opts?: RequestInit): Promise<any>;
        getData(url: string, opts?: RequestInit): Promise<any>;
        getLink(data: any): string;
    }

    function spotifyUrlInfo(fetch: any): Spotify;

    export = spotifyUrlInfo;
}
