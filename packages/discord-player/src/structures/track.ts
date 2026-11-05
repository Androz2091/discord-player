export class Track<Metadata = any> {
  /**
   * The arbitrary metadata associated with this track.
   */
  public get metadata(): Metadata {
    return this.metadata;
  }

  /**
   * Casts the current Track instance to a Track with a different metadata type.
   */
  public asMetadata<NewMetadata>(): Track<NewMetadata> {
    return this as unknown as Track<NewMetadata>;
  }
}
