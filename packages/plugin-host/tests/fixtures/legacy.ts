import { Readable } from 'node:stream';
import { BaseExtractor, Track, Playlist } from '@discord-player/plugin-host';

/** Integration fixture deliberately uses only the legacy source API. */
export class LegacyFixture extends BaseExtractor {
  static override identifier = 'fixture.legacy';
  override async validate() {
    return true;
  }
  override async handle(query: string) {
    this.context.player.debug('Resolving source');
    if (query === 'delegate') return this.context.player.search('fixture', { pluginId: 'fixture.modern' });
    const track = new Track(this.context.player, {
      title: query,
      url: 'https://fixture.test/audio',
      raw: { engine: { secret: 'never serialize' } },
    });
    const playlist = new Playlist(this.context.player, { title: 'Fixture', tracks: [track] });
    return this.createResponse(playlist);
  }
  override async stream(track: Track) {
    if (!track.raw.engine || typeof track.raw.engine !== 'object') throw new Error('Missing reconstructed engine');
    return Readable.from([Buffer.from('encoded fixture')]);
  }
}
