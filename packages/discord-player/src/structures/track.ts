import type { MediaSource } from '@remedia/client';

export class Track<Metadata = any> {
  public readonly title!: string;

  /**
   * The arbitrary metadata associated with this track.
   */
  public get metadata(): Metadata {
    return {} as Metadata;
  }

  /**
   * Casts the current Track instance to a Track with a different metadata type.
   */
  public asMetadata<NewMetadata>(): Track<NewMetadata> {
    return this as unknown as Track<NewMetadata>;
  }

  public async getStreamableSource(): Promise<MediaSource> {
    throw new Error('NOT_IMPLEMENTED');
  }
}
