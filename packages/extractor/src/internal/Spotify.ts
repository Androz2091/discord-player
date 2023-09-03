import { GuildQueueHistory } from 'discord-player';
import { fetch, UA } from '../extractors';

const SP_ANON_TOKEN_URL = 'https://open.spotify.com/get_access_token?reason=transport&productType=embed';
const SP_ACCESS_TOKEN_URL = 'https://accounts.spotify.com/api/token?grant_type=client_credentials';
const SP_BASE = 'https://api.spotify.com/v1';

interface SP_ACCESS_TOKEN {
    token: string;
    expiresAfter: number;
    type: 'Bearer';
}

export class SpotifyAPI {
    public accessToken: SP_ACCESS_TOKEN | null = null;

    public constructor(
        public credentials: { clientId: string | null; clientSecret: string | null } = {
            clientId: null,
            clientSecret: null
        }
    ) {}

    public get authorizationKey() {
        if (!this.credentials.clientId || !this.credentials.clientSecret) return null;
        return Buffer.from(`${this.credentials.clientId}:${this.credentials.clientSecret}`).toString('base64');
    }

    public async requestToken() {
        const key = this.authorizationKey;

        if (!key) return await this.requestAnonymousToken();

        try {
            const res = await fetch(SP_ACCESS_TOKEN_URL, {
                method: 'POST',
                headers: {
                    'User-Agent': UA,
                    Authorization: `Basic ${key}`,
                    'Content-Type': 'application/json'
                }
            });

            const body = await res.json();

            if (!body.access_token) throw 'no token';

            const data = {
                token: body.access_token as string,
                expiresAfter: body.expires_in as number,
                type: 'Bearer' as const
            };

            return (this.accessToken = data);
        } catch {
            return await this.requestAnonymousToken();
        }
    }

    public async requestAnonymousToken() {
        try {
            const res = await fetch(SP_ANON_TOKEN_URL, {
                headers: {
                    'User-Agent': UA,
                    'Content-Type': 'application/json'
                }
            });

            if (!res.ok) throw 'not_ok';

            const body = await res.json();

            if (!body.accessToken) throw 'no_access_token';

            const data = {
                token: body.accessToken as string,
                expiresAfter: body.accessTokenExpirationTimestampMs as number,
                type: 'Bearer' as const
            };

            return (this.accessToken = data);
        } catch {
            return null;
        }
    }

    public isTokenExpired() {
        if (!this.accessToken) return true;
        return Date.now() > this.accessToken.expiresAfter;
    }

    public async search(query: string) {
        try {
            // req
            if (this.isTokenExpired()) await this.requestToken();
            // failed
            if (!this.accessToken) return null;

            const res = await fetch(`${SP_BASE}/search/?q=${encodeURIComponent(query)}&type=track&market=US`, {
                headers: {
                    'User-Agent': UA,
                    Authorization: `${this.accessToken.type} ${this.accessToken.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!res.ok) return null;

            const data: { tracks: { items: SpotifyTrack[] } } = await res.json();

            return data.tracks.items.map((m) => ({
                title: m.name,
                duration: m.duration_ms,
                artist: m.artists.map((m) => m.name).join(', '),
                url: m.external_urls?.spotify || `https://open.spotify.com/track/${m.id}`,
                thumbnail: m.album.images?.[0]?.url || null
            }));
        } catch {
            return null;
        }
    }

    public async getPlaylist(id: string) {
        try {
            // req
            if (this.isTokenExpired()) await this.requestToken();
            // failed
            if (!this.accessToken) return null;

            const res = await fetch(`${SP_BASE}/playlists/${id}?market=US`, {
                headers: {
                    'User-Agent': UA,
                    Authorization: `${this.accessToken.type} ${this.accessToken.token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!res.ok) return null;

            const data: {
                external_urls: { spotify: string };
                owner: { display_name: string };
                id: string;
                name: string;
                images: { url: string }[];
                tracks: {
                    items: { track: SpotifyTrack }[];
                    next?: string;
                };
            } = await res.json();

            if (!data.tracks.items.length) return null;

            const t: { track: SpotifyTrack }[] = data.tracks.items;

            let next: string | undefined = data.tracks.next;

            while (typeof next === 'string') {
                try {
                    const res = await fetch(next, {
                        headers: {
                            'User-Agent': UA,
                            Authorization: `${this.accessToken.type} ${this.accessToken.token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    if (!res.ok) break;
                    const nextPage: { items: { track: SpotifyTrack }[]; next?: string } = await res.json();

                    t.push(...nextPage.items);
                    next = nextPage.next;

                    if (!next) break;
                } catch {
                    break;
                }
            }

            const tracks = t.map(({ track: m }) => ({
                title: m.name,
                duration: m.duration_ms,
                artist: m.artists.map((m) => m.name).join(', '),
                url: m.external_urls?.spotify || `https://open.spotify.com/track/${m.id}`,
                thumbnail: m.album.images?.[0]?.url || null
            }));

            if (!tracks.length) return null;
            return {
                name: data.name,
                author: data.owner.display_name,
                thumbnail: data.images?.[0]?.url || null,
                id: data.id,
                url: data.external_urls.spotify || `https://open.spotify.com/playlist/${id}`,
                tracks
            };
        } catch {
            return null;
        }
    }

    public async getAlbum(id: string) {
        try {
            // req
            if (this.isTokenExpired()) await this.requestToken();
            // failed
            if (!this.accessToken) return null;

            const res = await fetch(`${SP_BASE}/albums/${id}?market=US`, {
                headers: {
                    'User-Agent': UA,
                    Authorization: `${this.accessToken.type} ${this.accessToken.token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!res.ok) return null;

            const data: {
                external_urls: { spotify: string };
                artists: { name: string }[];
                id: string;
                name: string;
                images: { url: string }[];
                tracks: {
                    items: SpotifyTrack[];
                    next?: string;
                };
            } = await res.json();

            if (!data.tracks.items.length) return null;

            const t: SpotifyTrack[] = data.tracks.items;

            let next: string | undefined = data.tracks.next;

            while (typeof next === 'string') {
                try {
                    const res = await fetch(next, {
                        headers: {
                            'User-Agent': UA,
                            Authorization: `${this.accessToken.type} ${this.accessToken.token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    if (!res.ok) break;
                    const nextPage: { items: SpotifyTrack[]; next?: string } = await res.json();

                    t.push(...nextPage.items);
                    next = nextPage.next;

                    if (!next) break;
                } catch {
                    break;
                }
            }

            const tracks = t.map((m) => ({
                title: m.name,
                duration: m.duration_ms,
                artist: m.artists.map((m) => m.name).join(', '),
                url: m.external_urls?.spotify || `https://open.spotify.com/track/${m.id}`,
                thumbnail: data.images?.[0]?.url || null
            }));

            if (!tracks.length) return null;
            return {
                name: data.name,
                author: data.artists.map((m) => m.name).join(', '),
                thumbnail: data.images?.[0]?.url || null,
                id: data.id,
                url: data.external_urls.spotify || `https://open.spotify.com/album/${id}`,
                tracks
            };
        } catch {
            return null;
        }
    }

    public async getRelatedTracks(trackId: string, artistId: string, history: GuildQueueHistory) {
        try {
            // req
            if (this.isTokenExpired()) await this.requestToken();
            // failed
            if (!this.accessToken) return null;

            let trackIds: string[] = [];
            let artistIds: string[] = [];

            if (history) {
                const spotifyHistoryTracks = history.tracks.data.filter((m) => m.queryType === 'spotifySong').slice(0, 5);
                trackIds = spotifyHistoryTracks.map((m) => (m.metadata as { source: SpotifyTrack }).source.id);
                artistIds = spotifyHistoryTracks.map((m) => (m.metadata as { source: SpotifyTrack }).source.artists[0].uri.split(':')[2]);
            } else {
                trackIds = [trackId];
                artistIds = [artistId];
            }

            if (!trackIds || !artistIds) return null;

            // Spotify recommendations API only allows 5 seeds
            // This will limit to 5 seeds, prioritizing artist ids over track ids
            if (trackIds.length + artistIds.length > 5) {
                const diff = trackIds.length + artistIds.length - 5;
                if (trackIds.length > diff) {
                    trackIds = trackIds.slice(0, trackIds.length - diff);
                } else {
                    const remainingDiff = diff - trackIds.length;
                    trackIds = [];
                    artistIds = artistIds.slice(0, artistIds.length - remainingDiff);
                }
            }

            // Ensure at least 1 track id
            if (trackIds.length === 0 && artistIds.length > 1) {
                artistIds = artistIds.slice(0, artistIds.length - 1);
                trackIds = [trackId];
            }

            const res = await fetch(`${SP_BASE}/recommendations/?limit=1&market=US&seed_tracks=${trackIds.join(',')}&seed_artists=${artistIds.join(',')}`, {
                headers: {
                    'User-Agent': UA,
                    Authorization: `${this.accessToken.type} ${this.accessToken.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!res.ok) return null;

            const data: { tracks: SpotifyTrack[] } = await res.json();

            return data.tracks.map((m) => ({
                id: m.id,
                title: m.name,
                duration: m.duration_ms,
                artists: m.artists.map((m) => {
                    return {
                        name: m.name,
                        uri: m.uri
                    };
                }),
                url: m.external_urls?.spotify || `https://open.spotify.com/track/${m.id}`,
                thumbnail: m.album.images?.[0]?.url || null
            }));
        } catch {
            return null;
        }
    }
}

export interface SpotifyTrack {
    album: {
        images: {
            height: number;
            url: string;
            width: number;
        }[];
    };
    artists: {
        id: string;
        name: string;
        uri: string;
    }[];
    duration_ms: number;
    explicit: boolean;
    external_urls: { spotify: string };
    id: string;
    name: string;
}
