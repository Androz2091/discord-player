import { QueryResolver } from 'discord-player';
import fetch from 'node-fetch';

// eslint-disable-next-line
function getData<T = unknown>(link: string, json: false): Promise<string>;
function getData<T = unknown>(link: string, json: true): Promise<T>;
function getData<T = unknown>(link: string, json = false): Promise<T | string> {
    return fetch(link, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.APPLE_MUSIC_EMBED_JWT}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36 Edg/109.0.1518.49'
        }
    })
        .then((r) => (json ? r.json() : r.text()))
        .catch(() => null);
}

function makeImage({ height, url, width }: { url: string; width: number; height: number }) {
    return url.replace('{w}', `${width}`).replace('{h}', `${height}`);
}

export class AppleMusic {
    public constructor() {
        return AppleMusic;
    }

    public static async getSongInfo(link: string) {
        if (!QueryResolver.regex.appleMusicSongRegex.test(link)) {
            return null;
        }

        const id = new URL(link).searchParams.get('i');

        if (!id) return null;

        const embedURL = `https://amp-api.music.apple.com/v1/catalog/us/songs/${id}`;

        const res = await getData<AppleMusicSongEmbed>(embedURL, true);
        if (!res || !res.data.length) return null;

        const song = res.data[0];

        return {
            id: song.id,
            duration: song.attributes.durationInMillis,
            title: song.attributes.name,
            thumbnail: makeImage(song.attributes.artwork),
            url: song.attributes.url,
            artist: {
                name: song.attributes.artistName
            }
        };
    }

    public static async getPlaylistInfo(link: string) {
        if (!QueryResolver.regex.appleMusicPlaylistRegex.test(link)) {
            return null;
        }

        const id = new URL(link).searchParams.get('i');

        if (!id) return null;

        const embedURL = `https://amp-api.music.apple.com/v1/catalog/us/albums/${link.split('/').pop()}`;
        const res = await getData<AppleMusicPlaylistEmbed>(embedURL, true);
        if (!res || !res.data.length) return null;

        const pl = res.data[0];

        return {
            id: pl.id,
            title: pl.attributes.name,
            thumbnail: makeImage(pl.attributes.artwork),
            artist: {
                name: pl.attributes.curatorName
            },
            url: pl.attributes.url,
            tracks: pl.relationships.tracks.data.map((song) => ({
                id: song.id,
                duration: song.attributes.durationInMillis,
                title: song.attributes.name,
                thumbnail: makeImage(song.attributes.artwork),
                url: song.attributes.url,
                artist: {
                    name: song.attributes.artistName
                }
            }))
        };
    }

    public static async getAlbumInfo(link: string) {
        if (!QueryResolver.regex.appleMusicAlbumRegex.test(link)) {
            return null;
        }

        const embedURL = `https://amp-api.music.apple.com/v1/catalog/us/albums/${link.split('/').pop()}`;
        const res = await getData<AppleMusicAlbumEmbed>(embedURL, true);
        if (!res || !res.data.length) return null;

        const pl = res.data[0];

        return {
            id: pl.id,
            title: pl.attributes.name,
            thumbnail: makeImage(pl.attributes.artwork),
            artist: {
                name: pl.attributes.artistName
            },
            url: pl.attributes.url,
            tracks: pl.relationships.tracks.data.map((song) => ({
                id: song.id,
                duration: song.attributes.durationInMillis,
                title: song.attributes.name,
                thumbnail: makeImage(song.attributes.artwork),
                url: song.attributes.url,
                artist: {
                    name: song.attributes.artistName
                }
            }))
        };
    }
}

export interface AppleMusicSongEmbed {
    data: {
        id: string;
        type: string;
        href: string;
        attributes: {
            hasTimeSyncedLyrics: boolean;
            albumName: string;
            genreNames: string[];
            trackNumber: number;
            releaseDate: string;
            durationInMillis: number;
            isVocalAttenuationAllowed: boolean;
            isMasteredForItunes: boolean;
            isrc: string;
            artwork: {
                width: number;
                url: string;
                height: number;
                textColor3: string;
                textColor2: string;
                textColor4: string;
                textColor1: string;
                bgColor: string;
                hasP3: boolean;
            };
            audioLocale: string;
            composerName: string;
            url: string;
            playParams: {
                id: string;
                kind: string;
            };
            discNumber: number;
            hasLyrics: boolean;
            isAppleDigitalMaster: boolean;
            audioTraits: string[];
            name: string;
            previews: {
                url: string;
            }[];
            artistName: string;
        };
        relationships: {
            artists: {
                href: string;
                data: {
                    id: string;
                    type: string;
                    href: string;
                }[];
            };
            albums: {
                href: string;
                data: {
                    id: string;
                    type: string;
                    href: string;
                }[];
            };
        };
    }[];
}

export interface AppleMusicAlbumEmbed {
    data: [
        {
            id: string;
            type: string;
            href: string;
            attributes: {
                copyright: string;
                genreNames: string[];
                releaseDate: string;
                upc: string;
                isMasteredForItunes: boolean;
                artwork: {
                    width: number;
                    url: string;
                    height: number;
                    textColor3: string;
                    textColor2: string;
                    textColor4: string;
                    textColor1: string;
                    bgColor: string;
                    hasP3: boolean;
                };
                playParams: { id: string; kind: string };
                url: string;
                recordLabel: string;
                isCompilation: boolean;
                trackCount: number;
                isPrerelease: boolean;
                audioTraits: string[];
                isSingle: boolean;
                name: string;
                artistName: string;
                contentRating: string;
                editorialNotes: {
                    standard: string;
                    short: string;
                };
                isComplete: boolean;
            };
            relationships: {
                artists: {
                    href: string;
                    data: [{ id: string; type: string; href: string }, { id: string; type: string; href: string }, { id: string; type: string; href: string }];
                };
                tracks: {
                    href: string;
                    data: {
                        id: string;
                        type: string;
                        href: string;
                        attributes: {
                            albumName: string;
                            hasTimeSyncedLyrics: boolean;
                            genreNames: string[];
                            trackNumber: number;
                            durationInMillis: number;
                            releaseDate: string;
                            isVocalAttenuationAllowed: boolean;
                            isMasteredForItunes: boolean;
                            isrc: string;
                            artwork: {
                                width: number;
                                url: string;
                                height: number;
                                textColor3: string;
                                textColor2: string;
                                textColor4: string;
                                textColor1: string;
                                bgColor: string;
                                hasP3: boolean;
                            };
                            audioLocale: string;
                            composerName: string;
                            url: string;
                            playParams: { id: string; kind: string };
                            discNumber: number;
                            isAppleDigitalMaster: boolean;
                            hasLyrics: boolean;
                            audioTraits: string[];
                            name: string;
                            previews: [{ url: string }];
                            artistName: string;
                        };
                    }[];
                };
            };
        }
    ];
}

export interface AppleMusicPlaylistEmbed {
    data: [
        {
            id: string;
            type: string;
            href: string;
            attributes: {
                curatorName: string;
                audioTraits: string[];
                lastModifiedDate: string;
                name: string;
                isChart: boolean;
                playlistType: string;
                description: {
                    standard: string;
                    short: string;
                };
                artwork: {
                    width: number;
                    url: string;
                    height: number;
                    textColor3: string;
                    textColor2: string;
                    textColor4: string;
                    textColor1: string;
                    bgColor: string;
                    hasP3: boolean;
                };
                editorialNotes: {
                    name: string;
                    standard: string;
                    short: string;
                };
                playParams: {
                    id: string;
                    kind: string;
                    versionHash: string;
                };
                url: string;
            };
            relationships: {
                tracks: {
                    href: string;
                    data: {
                        id: string;
                        type: string;
                        href: string;
                        attributes: {
                            hasTimeSyncedLyrics: boolean;
                            albumName: string;
                            genreNames: string[];
                            trackNumber: number;
                            releaseDate: string;
                            durationInMillis: number;
                            isVocalAttenuationAllowed: boolean;
                            isMasteredForItunes: boolean;
                            isrc: string;
                            artwork: {
                                width: number;
                                url: string;
                                height: number;
                                textColor3: string;
                                textColor2: string;
                                textColor4: string;
                                textColor1: string;
                                bgColor: string;
                                hasP3: boolean;
                            };
                            audioLocale: string;
                            composerName: string;
                            url: string;
                            playParams: {
                                id: string;
                                kind: string;
                            };
                            discNumber: number;
                            isAppleDigitalMaster: boolean;
                            hasLyrics: boolean;
                            audioTraits: string[];
                            name: string;
                            previews: {
                                url: string;
                            }[];
                            artistName: string;
                        };
                    }[];
                };
                curator: {
                    href: string;
                    data: {
                        id: string;
                        type: string;
                        href: string;
                    }[];
                };
            };
        }
    ];
}
