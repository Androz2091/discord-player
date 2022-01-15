import axios from "axios";
import cheerio from "cheerio";
import YouTube from "youtube-sr";
import { ExtractorModelData, TrackSource } from "..";

export interface Artist {
    name: string;
    url: string;
}

export interface Track {
    artist: Artist;
    duration: number;
    title: string;
    url: string;
    type: "song";
}

export interface RawAlbum {
    artist: Artist;
    description: string;
    numTracks: number;
    title: string;
    tracks: Track[];
    type: "album";
    thumbnail: string;
}

export interface RawPlaylist {
    creator: Artist;
    description: string;
    numTracks: number;
    title: string;
    tracks: Track[];
    type: "playlist";
    thumbnail: string;
}

function getRawPlaylist(document: string): RawPlaylist {
    const $ = cheerio.load(document);

    const tracks: Track[] = [];

    const songList = $("div.songs-list-row").toArray();
    songList.forEach((song) => {
        const lookArtist = $(song).find("div.songs-list__col--artist").find("a.songs-list-row__link");

        const track: Track = {
            artist: {
                name: lookArtist.text(),
                url: lookArtist.attr("href") ?? ""
            },
            title: $(song).find("div.songs-list__col--song").find("div.songs-list-row__song-name").text(),
            duration: $(song)
                .find("div.songs-list__col--time")
                .find("time")
                .text()
                .trim()
                .split(":")
                .map((value) => Number(value))
                .reduce((acc, time) => 60 * acc + time),
            url: $(song).find("div.songs-list__col--album").find("a.songs-list-row__link").attr("href") ?? "",
            type: "song"
        };

        tracks.push(track);
    });

    const product = $("div.product-page-header");
    const creator = product.find("div.product-creator").find("a.dt-link-to");

    const playlist: RawPlaylist = {
        title: product.find("h1.product-name").text().trim(),
        description: product.find("div.product-page-header__metadata--notes").text().trim(),
        creator: {
            name: creator.text().trim(),
            url: "https://music.apple.com" + creator.attr("href") ?? ""
        },
        tracks,
        numTracks: tracks.length,
        type: "playlist",
        thumbnail: $("meta[property='og:image']").attr("content") ?? ""
    };
    return playlist;
}

function getRawAlbum(document: string): RawAlbum {
    const $ = cheerio.load(document);

    const tracks: Track[] = [];

    const product = $("div.product-page-header");
    const creator = product.find("div.product-creator").find("a.dt-link-to");
    const artist = {
        name: creator.text().trim(),
        url: creator.attr("href") ?? ""
    };

    const albumUrl = $("meta[property='og:url']").attr("content");
    const songList = $("div.songs-list-row").toArray();
    songList.forEach((song) => {
        const track: Track = {
            artist,
            title: $(song).find("div.songs-list__col--song").find("div.songs-list-row__song-name").text(),
            duration: $(song)
                .find("div.songs-list__col--time")
                .find("time")
                .text()
                .trim()
                .split(":")
                .map((value) => Number(value))
                .reduce((acc, time) => 60 * acc + time),
            url: albumUrl
                ? albumUrl + "?i=" + JSON.parse($(song).find("div.songs-list__col--time").find("button.preview-button").attr("data-metrics-click") ?? "{ targetId: 0 }")["targetId"] ?? ""
                : "",
            type: "song"
        };

        tracks.push(track);
    });

    const playlist: RawAlbum = {
        title: product.find("h1.product-name").text().trim(),
        description: product.find("div.product-page-header__metadata--notes").text().trim(),
        artist,
        tracks,
        numTracks: tracks.length,
        type: "album",
        thumbnail: $("meta[property='og:image']").attr("content") ?? ""
    };
    return playlist;
}

function linkType(url: string) {
    if (RegExp(/https?:\/\/music\.apple\.com\/.+?\/album\/.+?\/.+?\?i=([0-9]+)/).test(url)) {
        return "song";
    } else if (RegExp(/https?:\/\/music\.apple\.com\/.+?\/playlist\//).test(url)) {
        return "playlist";
    } else if (RegExp(/https?:\/\/music\.apple\.com\/.+?\/album\//).test(url)) {
        return "album";
    } else {
        return false;
    }
}

async function search(url: string): Promise<RawPlaylist | RawAlbum | Track | null> {
    const urlType = linkType(url);
    const page = await axios
        .get<string>(url)
        .then((res) => res.data)
        .catch(() => undefined);

    if (!page) {
        return null;
    }

    if (urlType === "playlist") {
        return getRawPlaylist(page);
    }

    const album = getRawAlbum(page);

    if (urlType === "album") {
        return album;
    }

    const match = new RegExp(/https?:\/\/music\.apple\.com\/.+?\/album\/.+?\/.+?\?i=([0-9]+)/).exec(url);

    const id = match ? match[1] : undefined;
    if (!id) {
        return null;
    }

    const track = album.tracks.find((track) => {
        return track.url.includes(`?i=${id}`);
    });

    if (!track) {
        return null;
    }

    return track;
}

async function makeData(query: string): Promise<ExtractorModelData> {
    const music_data = await search(query);

    if (music_data.type === "song") {
        const videos = await YouTube.search(music_data.title, {
            type: "video"
        });
        if (!videos) return null;

        const info: ExtractorModelData = {
            data: [
                {
                    title: music_data.title,
                    duration: videos[0].duration,
                    thumbnail: videos[0].thumbnail.url,
                    engine: "youtube",
                    views: 0,
                    author: music_data.artist.name,
                    description: videos[0].description,
                    url: videos[0].url,
                    source: "applemusic" as TrackSource
                }
            ]
        };

        return {
            playlist: null,
            data:
                (info.data as Omit<ExtractorModelData, "playlist">["data"])?.map((m) => ({
                    title: m.title as string,
                    duration: m.duration as number,
                    thumbnail: m.thumbnail as string,
                    engine: m.engine,
                    views: m.views as number,
                    author: m.author as string,
                    description: m.description as string,
                    url: m.url as string,
                    source: m.source
                })) ?? []
        };
    }
    // eslint-disable-next-line no-constant-condition
    if (music_data.type === "playlist" || "album") {
        const info: ExtractorModelData = {
            data: [],
            playlist: {
                title: music_data.title,
                description: music_data.description,
                thumbnail: "",
                source: "applemusic",
                url: query,
                id: "",
                type: music_data.type === "playlist" ? "playlist" : "album",
                author: {
                    name: music_data.type === "playlist" ? music_data.creator.name : music_data.artist.name,
                    url: music_data.type === "playlist" ? music_data.creator.url : music_data.artist.url
                }
            }
        };

        for (const m of music_data.tracks) {
            const videos = await YouTube.search(m.title, {
                type: "video"
            });
            if (!videos) return null;

            const data = {
                title: videos[0].title as string,
                duration: videos[0].duration as number,
                thumbnail: videos[0].thumbnail.url as string,
                engine: "youtube",
                views: 0,
                author: videos[0].channel.name,
                description: videos[0].description as string,
                url: videos[0].url as string,
                source: "applemusic" as TrackSource
            };
            info.data.push(data);
        }

        return {
            playlist: info.playlist,
            data:
                (info.data as Omit<ExtractorModelData, "playlist">["data"])?.map((m) => ({
                    title: m.title as string,
                    duration: m.duration as number,
                    thumbnail: m.thumbnail as string,
                    engine: m.engine,
                    views: m.views as number,
                    author: m.author as string,
                    description: m.description as string,
                    url: m.url as string,
                    source: m.source
                })) ?? []
        };
    }
}

export { linkType, search, getRawAlbum, getRawPlaylist, makeData };
