import { describe, expect, it } from 'vitest';
import { QueryResolver, QueryType } from '../src/index';

describe('QueryResolver', () => {
    const qr = QueryResolver;

    it('should be autoSearch [default]', () => {
        const query = 'a search query';
        expect(qr.resolve(query)).toBe(QueryType.AUTO_SEARCH);
    });

    it('should be appleMusicSearch [custom]', () => {
        const query = 'a search query';
        expect(qr.resolve(query, QueryType.APPLE_MUSIC_SEARCH)).toBe(QueryType.APPLE_MUSIC_SEARCH);
    });

    it('should be youtubeVideo', () => {
        const query = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
        expect(qr.resolve(query)).toBe(QueryType.YOUTUBE_VIDEO);
    });

    it('should resolve youtube music', () => {
        const query = 'https://music.youtube.com/watch?v=dQw4w9WgXcQ';
        expect(qr.resolve(query)).toBe(QueryType.YOUTUBE_VIDEO);
    });

    it('should be youtubePlaylist', () => {
        const query = 'https://www.youtube.com/playlist?list=PLu4wnki9NI_8VmJ7Qz_byhKwCquXcy6u9';
        expect(qr.resolve(query)).toBe(QueryType.YOUTUBE_PLAYLIST);
    });

    it('should be vimeo', () => {
        const query = 'https://vimeo.com/524209915';
        expect(qr.resolve(query)).toBe(QueryType.VIMEO);
    });

    it('should be soundcloudTrack', () => {
        const query = 'https://soundcloud.com/rick-astley-official/never-gonna-give-you-up-4';
        expect(qr.resolve(query)).toBe(QueryType.SOUNDCLOUD_TRACK);
    });

    it('should be soundcloudPlaylist', () => {
        const query = 'https://soundcloud.com/user-746418733/sets/rick-roll';
        expect(qr.resolve(query)).toBe(QueryType.SOUNDCLOUD_PLAYLIST);
    });

    it('should be spotifySong', () => {
        const query = 'https://open.spotify.com/track/59Rx7sQnBmVbHwdKqKHOrQ';
        expect(qr.resolve(query)).toBe(QueryType.SPOTIFY_SONG);
    });

    it('should be spotifySong (new url)', () => {
        const query = 'https://open.spotify.com/intl-de/track/2USlegnFJLrVLpoVfPimKB?si=8e3902d2056547ca';

        expect(qr.resolve(query)).toBe(QueryType.SPOTIFY_SONG);
    });

    it('should be spotifyPlaylist', () => {
        const query = 'https://open.spotify.com/playlist/0vvXsWCC9xrXsKd4FyS8kM';
        expect(qr.resolve(query)).toBe(QueryType.SPOTIFY_PLAYLIST);
    });

    it('should be spotifyPlaylist (alternate)', () => {
        const query = 'https://open.spotify.com/playlist/6Wu1PLrAuL1aApvX0iX9Rh?si=5b6c2f185b624001';
        expect(qr.resolve(query)).toBe(QueryType.SPOTIFY_PLAYLIST);
    });

    it('should be spotifyAlbum', () => {
        const query = 'https://open.spotify.com/album/3nzuGtN3nXARvvecier4K0';
        expect(qr.resolve(query)).toBe(QueryType.SPOTIFY_ALBUM);
    });

    it('should be appleMusicSong', () => {
        const query = 'https://music.apple.com/us/album/never-gonna-give-you-up/1558533900?i=1558534271';
        expect(qr.resolve(query)).toBe(QueryType.APPLE_MUSIC_SONG);
    });

    it('should be appleMusicPlaylist', () => {
        const query = 'https://music.apple.com/us/playlist/rick-astley-essentials/pl.504a9420747e43ec93e4faa999a8bef9';
        expect(qr.resolve(query)).toBe(QueryType.APPLE_MUSIC_PLAYLIST);
    });

    it('should be appleMusicAlbum', () => {
        const query = 'https://music.apple.com/us/album/whenever-you-need-somebody-deluxe-edition-2022-remaster/1615678477';
        expect(qr.resolve(query)).toBe(QueryType.APPLE_MUSIC_ALBUM);
    });

    it('should be arbitrary', () => {
        const query = 'https://example.com/music';
        expect(qr.resolve(query)).toBe(QueryType.ARBITRARY);
    });
});
