declare module 'reverbnation-scraper' {
  import internal from 'stream';

  class Song {
    public title: string;
    public id: number;
    public image: string;
    public thumbnail: string;
    public duration: number;
    public bitrate: number;
    public lyrics: string;
    public streamURL: string;
    public public: boolean;
    public url: string;
    public contextImage: {
      original: string;
      blur: string;
      colors: {
        average_lightness: number;
        greyscale: boolean;
        vibrant: string;
        light_vibrant: string;
        dark_vibrant: string;
        muted: string;
        light_muted: string;
        dark_muted: string;
      };
      source: string;
    } | null;
  }

  class Artist {
    public id: number;
    public name: string;
    public profile: string;
    public type: string;
    public avatar: string;
    public thumbnail: string;
    public bio: string;
    public genres: string[];
    public location: {
      city: string;
      state: string | null;
      country: string;
    };
  }

  export type ReverbnationInfo = Song & {
    artist: Artist;
    songs: Song[];
  };

  export function getInfo(url: string): Promise<ReverbnationInfo>;

  function rvdl(url: string): Promise<internal.Readable>;

  export = rvdl;
}
