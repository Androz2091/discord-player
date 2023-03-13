import { UA, getFetch } from '../extractors';

const SP_ANON_TOKEN_URL = 'https://open.spotify.com/get_access_token?reason=transport&productType=embed';
const SP_BASE = 'https://api.spotify.com/v1';

interface SP_ACCESS_TOKEN {
    token: string;
    expiresAfter: number;
    type: 'Bearer';
}

export class SpotifyAPI {
    public accessToken: SP_ACCESS_TOKEN | null = null;

    public async requestAnonymousToken() {
        try {
            const res = await getFetch(SP_ANON_TOKEN_URL, {
                headers: {
                    'User-Agent': UA
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
            if (this.isTokenExpired()) this.accessToken = await this.requestAnonymousToken();
            // failed
            if (!this.accessToken) return null;

            const res = await getFetch(`${SP_BASE}/search/?q=${encodeURIComponent(query)}&type=track&market=US`, {
                headers: {
                    'User-Agent': UA,
                    Authorization: `${this.accessToken.type} ${this.accessToken.token}`
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
    }[];
    duration_ms: number;
    explicit: boolean;
    external_urls: { spotify: string };
    id: string;
    name: string;
}
