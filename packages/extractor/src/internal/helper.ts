import { BaseExtractor, Track } from 'discord-player';
import { SoundCloudExtractor } from '../extractors/SoundCloudExtractor';
import unfetch from 'isomorphic-unfetch';
import type * as SoundCloud from 'soundcloud.ts';

export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36 Edg/109.0.1518.49';
export const fetch = unfetch;

export async function makeSCSearch(query: string) {
  const { instance } = SoundCloudExtractor;
  if (!instance?.internal) return [];

  let data: SoundCloud.SoundcloudTrackV2[];

  try {
    const info = await instance.internal.tracks.searchV2({
      q: query,
      limit: 5,
    });

    data = info.collection;
  } catch {
    // fallback
    const info = await instance.internal.tracks.searchAlt(query);

    data = info;
  }

  return filterSoundCloudPreviews(data);
}

export async function pullSCMetadata(ext: BaseExtractor, info: Track) {
  const meta = await makeSCSearch(ext.createBridgeQuery(info))
    .then((r) => r[0])
    .catch(() => null);

  return meta;
}

export function filterSoundCloudPreviews(
  tracks: SoundCloud.SoundcloudTrackV2[],
): SoundCloud.SoundcloudTrackV2[] {
  const filtered = tracks.filter((t) => {
    if (typeof t.policy === 'string') return t.policy.toUpperCase() === 'ALLOW';
    return !(t.duration === 30_000 && t.full_duration > 30_000);
  });

  const result = filtered.length > 0 ? filtered : tracks;

  return result;
}
