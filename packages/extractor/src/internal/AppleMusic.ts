/* eslint-disable @typescript-eslint/no-explicit-any */
import { QueryResolver } from 'discord-player';
import { parse, HTMLElement } from 'node-html-parser';
import { UA, fetch } from './helper';

function getHTML(link: string): Promise<HTMLElement | null> {
  return fetch(link, {
    headers: {
      'User-Agent': UA,
    },
  })
    .then((r) => r.text())
    .then(
      (txt) => parse(txt),
      () => null,
    );
}

function makeImage({
  height,
  url,
  width,
  ext = 'jpg',
}: {
  url: string;
  width: number;
  height: number;
  ext?: string;
}) {
  return url
    .replace('{w}', `${width}`)
    .replace('{h}', `${height}`)
    .replace('{f}', ext);
}

function parseDuration(d: string) {
  const r = (name: string, unit: string) =>
    `((?<${name}>-?\\d*[\\.,]?\\d+)${unit})?`;
  const regex = new RegExp(
    [
      '(?<negative>-)?P',
      r('years', 'Y'),
      r('months', 'M'),
      r('weeks', 'W'),
      r('days', 'D'),
      '(T',
      r('hours', 'H'),
      r('minutes', 'M'),
      r('seconds', 'S'),
      ')?', // end optional time
    ].join(''),
  );
  const test = regex.exec(d);
  if (!test || !test.groups) return '0:00';

  const dur = [
    test.groups.years,
    test.groups.months,
    test.groups.weeks,
    test.groups.days,
    test.groups.hours,
    test.groups.minutes,
    test.groups.seconds,
  ];

  return (
    dur
      .filter((r, i, a) => !!r || i > a.length - 2)
      .map((m, i) => {
        if (!m) m = '0';
        return i < 1 ? m : m.padStart(2, '0');
      })
      .join(':') || '0:00'
  );
}

export class AppleMusic {
  public constructor() {
    return AppleMusic;
  }

  public static async search(query: string) {
    try {
      const url = `https://music.apple.com/us/search?term=${encodeURIComponent(
        query,
      )}`;
      const node = await getHTML(url);
      if (!node) return [];

      const rawData = node.getElementById('serialized-server-data');
      if (!rawData) return [];

      const data = JSON.parse(rawData.innerText)[0].data.sections;
      const tracks = data.find((s: any) => s.itemKind === 'trackLockup')?.items;
      if (!tracks) return [];

      return tracks.map((track: any) => ({
        id: track.contentDescriptor.identifiers.storeAdamID,
        duration: track.duration || '0:00',
        title: track.title,
        url: track.contentDescriptor.url,
        thumbnail: track?.artwork?.dictionary
          ? makeImage({
              url: track.artwork.dictionary.url,
              height: track.artwork.dictionary.height,
              width: track.artwork.dictionary.width,
            })
          : 'https://music.apple.com/assets/favicon/favicon-180.png',
        artist: {
          name: track.subtitleLinks?.[0]?.title ?? 'Unknown Artist',
        },
      }));
    } catch {
      return [];
    }
  }

  public static async getSongInfoFallback(
    res: HTMLElement,
    name: string,
    id: string,
    link: string,
  ) {
    try {
      const metaTags = res.getElementsByTagName('meta');
      if (!metaTags.length) return null;

      const title =
        metaTags
          .find((r) => r.getAttribute('name') === 'apple:title')
          ?.getAttribute('content') ||
        res.querySelector('title')?.innerText ||
        name;
      const contentId =
        metaTags
          .find((r) => r.getAttribute('name') === 'apple:content_id')
          ?.getAttribute('content') || id;
      const durationRaw = metaTags
        .find((r) => r.getAttribute('property') === 'music:song:duration')
        ?.getAttribute('content');

      const song = {
        id: contentId,
        duration: durationRaw
          ? parseDuration(durationRaw)
          : metaTags
              .find((m) => m.getAttribute('name') === 'apple:description')
              ?.textContent.split('Duration: ')?.[1]
              .split('"')?.[0] || '0:00',
        title,
        url: link,
        thumbnail:
          metaTags
            .find((r) =>
              ['og:image:secure_url', 'og:image'].includes(
                r.getAttribute('property')!,
              ),
            )
            ?.getAttribute('content') ||
          'https://music.apple.com/assets/favicon/favicon-180.png',
        artist: {
          name:
            res
              .querySelector('.song-subtitles__artists>a')
              ?.textContent?.trim() || 'Apple Music',
        },
      };

      return song;
    } catch {
      return null;
    }
  }

  public static async getSongInfo(link: string) {
    if (!QueryResolver.regex.appleMusicSongRegex.test(link)) {
      return null;
    }

    const url = new URL(link);
    const id = url.searchParams.get('i');
    const name = url.pathname.split('album/')[1]?.split('/')[0];

    if (!id || !name) return null;

    const res = await getHTML(`https://music.apple.com/us/song/${name}/${id}`);
    if (!res) return null;

    try {
      const datasrc =
        res.getElementById('serialized-server-data')?.innerText ||
        res.innerText
          .split(
            '<script type="application/json" id="serialized-server-data">',
          )?.[1]
          ?.split('</script>')?.[0];
      if (!datasrc) throw 'not found';
      const data = JSON.parse(datasrc)[0].data.seoData;
      const song = data.ogSongs[0]?.attributes;

      return {
        id: data.ogSongs[0]?.id || data.appleContentId || id,
        duration: song?.durationInMillis || '0:00',
        title: song?.name || data.appleTitle,
        url: song?.url || data.url || link,
        thumbnail: song?.artwork
          ? makeImage({
              url: song.artwork.url,
              height: song.artwork.height,
              width: song.artwork.width,
            })
          : data.artworkUrl
          ? makeImage({
              height: data.height,
              width: data.width,
              url: data.artworkUrl,
              ext: data.fileType || 'jpg',
            })
          : 'https://music.apple.com/assets/favicon/favicon-180.png',
        artist: {
          name: song?.artistName || data.socialTitle || 'Apple Music',
        },
      };
    } catch {
      return this.getSongInfoFallback(res, name, id, link);
    }
  }

  public static async getPlaylistInfo(link: string) {
    if (!QueryResolver.regex.appleMusicPlaylistRegex.test(link)) {
      return null;
    }

    const res = await getHTML(link);
    if (!res) return null;

    try {
      const datasrc =
        res.getElementById('serialized-server-data')?.innerText ||
        res.innerText
          .split(
            '<script type="application/json" id="serialized-server-data">',
          )?.[1]
          ?.split('</script>')?.[0];
      if (!datasrc) throw 'not found';
      const pl = JSON.parse(datasrc)[0].data.seoData;
      const thumbnail = pl.artworkUrl
        ? makeImage({
            height: pl.height,
            width: pl.width,
            url: pl.artworkUrl,
            ext: pl.fileType || 'jpg',
          })
        : 'https://music.apple.com/assets/favicon/favicon-180.png';
      return {
        id: pl.appleContentId,
        title: pl.appleTitle,
        thumbnail,
        artist: {
          name: pl.ogSongs?.[0]?.attributes?.artistName || 'Apple Music',
        },
        url: pl.url,
        tracks:
          // eslint-disable-next-line
          pl.ogSongs?.map((m: any) => {
            const song = m.attributes;
            return {
              id: m.id,
              duration: song.durationInMillis || '0:00',
              title: song.name,
              url: song.url,
              thumbnail: song.artwork
                ? makeImage({
                    url: song.artwork.url,
                    height: song.artwork.height,
                    width: song.artwork.width,
                  })
                : thumbnail,
              artist: {
                name: song.artistName || 'Apple Music',
              },
            };
          }) || [],
      };
    } catch {
      return null;
    }
  }

  public static async getAlbumInfo(link: string) {
    if (!QueryResolver.regex.appleMusicAlbumRegex.test(link)) {
      return null;
    }

    const res = await getHTML(link);
    if (!res) return null;

    try {
      const datasrc =
        res.getElementById('serialized-server-data')?.innerText ||
        res.innerText
          .split(
            '<script type="application/json" id="serialized-server-data">',
          )?.[1]
          ?.split('</script>')?.[0];
      if (!datasrc) throw 'not found';
      const pl = JSON.parse(datasrc)[0].data.seoData;
      const thumbnail = pl.artworkUrl
        ? makeImage({
            height: pl.height,
            width: pl.width,
            url: pl.artworkUrl,
            ext: pl.fileType || 'jpg',
          })
        : 'https://music.apple.com/assets/favicon/favicon-180.png';
      return {
        id: pl.appleContentId,
        title: pl.appleTitle,
        thumbnail,
        artist: {
          name: pl.ogSongs?.[0]?.attributes?.artistName || 'Apple Music',
        },
        url: pl.url,
        tracks:
          // eslint-disable-next-line
          pl.ogSongs?.map((m: any) => {
            const song = m.attributes;
            return {
              id: m.id,
              duration: song.durationInMillis || '0:00',
              title: song.name,
              url: song.url,
              thumbnail: song.artwork
                ? makeImage({
                    url: song.artwork.url,
                    height: song.artwork.height,
                    width: song.artwork.width,
                  })
                : thumbnail,
              artist: {
                name: song.artistName || 'Apple Music',
              },
            };
          }) || [],
      };
    } catch {
      return null;
    }
  }
}
