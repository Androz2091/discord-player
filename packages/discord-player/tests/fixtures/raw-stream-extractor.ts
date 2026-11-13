import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { BaseExtractor, QueryType, Track, type ExtractorSearchContext } from '../../src/index.js';

/** Local fixture for URL and file adapter behavior; performs no provider requests. */
export class RawStreamExtractor extends BaseExtractor {
  static override identifier = 'org.example.mock.raw';

  override async validate(_query: string, type?: string | null) {
    return type === QueryType.ARBITRARY || type === QueryType.FILE;
  }

  override async handle(query: string, context: ExtractorSearchContext) {
    const isFile = context.type === QueryType.FILE;

    if (isFile && !(await stat(query)).isFile()) return this.createResponse();

    const metadata = { url: query };
    const track = new Track(this.context.player, {
      title: path.basename(query),
      url: query,
      engine: query,
      queryType: context.type ?? undefined,
      metadata,
      requestMetadata: async () => metadata,
    });

    track.extractor = this;
    track.raw.isFile = isFile;

    return this.createResponse(null, [track]);
  }

  override async stream(track: Track) {
    return track.raw.isFile ? createReadStream(track.url) : track.url;
  }
}
