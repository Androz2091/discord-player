import { expect } from 'vitest';
import { BaseExtractor, Track, type SourceStream } from '../../src/index.js';

export class Legacy extends BaseExtractor<{ prefix: string }> {
  static override identifier = 'org.example.legacy';

  override protocols = ['raw'];

  override priority = 10;

  activated = 0;

  deactivated = 0;

  override async activate() {
    this.activated++;
  }

  override async deactivate() {
    this.deactivated++;
  }

  override async validate() {
    return true;
  }

  override async handle(query: string) {
    const track = new Track(this.context.player, {
      title: this.options.prefix + query,
      url: 'https://example.test/audio.mp3',
      engine: { processLocal: true },
      metadata: { value: 1 },
      requestMetadata: async () => ({ value: 2 }),
    });

    track.extractor = this;
    track.raw.circular = track;

    return this.createResponse(null, [track]);
  }

  override async stream(track: Track): Promise<SourceStream> {
    expect(track.raw.engine).toBeDefined();

    return track.url;
  }
}
