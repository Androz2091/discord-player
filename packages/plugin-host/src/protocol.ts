import { Track, type SerializedTrack } from './structures/track.js';
import { Playlist, type SerializedPlaylist } from './structures/playlist.js';
import { SearchResult } from './structures/search-result.js';
import { deserialize } from './utils/serde.js';

/** Versioned metadata plus an optional, expiring host-owned process-state hint.
 * Keep this whole payload when requesting source.stream; the hint is never required for persistence.
 */
export type PortableSourceTrack = SerializedTrack & {
  /** Opaque source-host state reference. Never identifies credentials or stream resources. */
  sourceState?: string;
};

/** HTTP metadata response payload inside Remedia's handled/result envelope. */
export interface PortableSourceResult {
  /** Ordered versioned Track metadata with optional ephemeral state hints. */
  tracks: PortableSourceTrack[];
  /** Versioned playlist metadata, when present. */
  playlist: SerializedPlaylist | null;
}

/** Reconstruct source-host metadata in a consumer process without restoring private extractor objects.
 * Keep the original portable tracks separately when requesting media, to retain ephemeral state hints.
 * @param result HTTP result payload (after unwrapping Remedia's handled/result envelope).
 * @returns Shared model instances suitable for application metadata display and persistence.
 */
export function deserializeSourceResult(result: PortableSourceResult): SearchResult {
  const tracks = result.tracks.map(({ sourceState: _state, ...entity }) => {
    const track = deserialize(entity);
    if (!(track instanceof Track)) throw new TypeError('Expected source Track metadata');
    return track;
  });
  const playlist = result.playlist ? deserialize(result.playlist) : null;
  if (playlist !== null && !(playlist instanceof Playlist)) throw new TypeError('Expected source Playlist metadata');
  if (playlist) {
    playlist.tracks = tracks;
    for (const track of tracks) track.playlist = playlist;
  }
  return new SearchResult({ tracks, playlist });
}
