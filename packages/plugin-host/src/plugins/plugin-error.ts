/** Failure attributed to a source registration and lifecycle stage or operation. */
export class PluginError extends Error {
  /** Create an attributed error.
   * @param pluginId Responsible registration.
   * @param operation Lifecycle stage or operation name.
   * @param cause Original failure.
   */
  constructor(
    /** Responsible source registration. */
    public readonly pluginId: string,

    /** Failed lifecycle stage or operation. */
    public readonly operation: string,

    cause: unknown,
  ) {
    super(`Plugin ${pluginId} failed during ${operation}: ${cause instanceof Error ? cause.message : String(cause)}`, {
      cause,
    });

    this.name = 'PluginError';
  }
}
