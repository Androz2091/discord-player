/* eslint-disable @typescript-eslint/no-explicit-any */

declare module 'spotify-url-info' {
  export interface Spotify {
    getPreview(url: string, opts?: RequestInit): Promise<any>;
    getTracks(url: string, opts?: RequestInit): Promise<any>;
    getDetails(url: string, opts?: RequestInit): Promise<any>;
    getData(url: string, opts?: RequestInit): Promise<any>;
    getLink(data: any): string;
  }

  function spotifyUrlInfo(fetch: any): Spotify;

  export interface SpotifySong {
    type: 'track';
    name: string;
    uri: string;
    id: string;
    title: string;
    artists: {
      name: string;
      uri: string;
    }[];
    coverArt: {
      extractedColors: {
        colorDark: {
          hex: string;
        };
        colorLight: {
          hex: string;
        };
      };
      sources: {
        url: string;
        width: number;
        height: number;
      }[];
    };
    releaseDate: {
      isoString: string;
    };
    duration: number;
    maxDuration: number;
    isPlayable: boolean;
    isExplicit: boolean;
    audioPreview: {
      url: string;
      format: string;
    };
    hasVideo: boolean;
    relatedEntityUri: string;
  }

  export interface SpotifyAlbum {
    type: 'album';
    name: string;
    uri: string;
    id: string;
    title: string;
    subtitle: string;
    coverArt: {
      extractedColors: {
        colorDark: {
          hex: string;
        };
      };
      sources: {
        height: number;
        width: number;
        url: string;
      }[];
    };
    releaseDate: string;
    duration: number;
    maxDuration: number;
    isPlayable: boolean;
    isExplicit: boolean;
    hasVideo: boolean;
    relatedEntityUri: string;
    trackList: {
      uri: string;
      uid: string;
      title: string;
      subtitle: string;
      isExplicit: boolean;
      duration: number;
      isPlayable: boolean;
      audioPreview: {
        format: string;
        url: string;
      };
    }[];
  }

  export interface SpotifyPlaylist {
    type: 'playlist';
    name: string;
    uri: string;
    id: string;
    title: string;
    subtitle: string;
    coverArt: {
      extractedColors: {
        colorDark: {
          hex: string;
        };
      };
      sources: {
        height: number;
        width: number;
        url: string;
      }[];
    };
    releaseDate: string;
    duration: number;
    maxDuration: number;
    isPlayable: boolean;
    isExplicit: boolean;
    hasVideo: boolean;
    relatedEntityUri: string;
    trackList: {
      uri: string;
      uid: string;
      title: string;
      subtitle: string;
      isExplicit: boolean;
      duration: number;
      isPlayable: boolean;
      audioPreview: {
        format: string;
        url: string;
      };
    }[];
  }

  export = spotifyUrlInfo;
}
