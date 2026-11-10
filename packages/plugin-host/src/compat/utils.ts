/** Duration fields consumed by legacy raw-stream extractors. */
export interface LegacyTimeData {
  /** Whole days. */
  days: number;

  /** Hours within the day. */
  hours: number;

  /** Minutes within the hour. */
  minutes: number;

  /** Seconds within the minute. */
  seconds: number;

  /** Remaining milliseconds. */
  milliseconds: number;
}

/** Small metadata helpers; obsolete voice and transcoding helpers are intentionally unavailable. */
export const Util = {
  /** No-op callback for legacy extractor promise cleanup.
   * @param args Ignored arguments.
   */
  noop(...args: unknown[]): void {
    void args;
  },

  /** Split a duration into clock fields.
   * @param milliseconds Non-negative duration.
   */
  parseMS(milliseconds: number): LegacyTimeData {
    const value = Math.max(0, milliseconds);

    return {
      days: Math.floor(value / 86400000),
      hours: Math.floor(value / 3600000) % 24,
      minutes: Math.floor(value / 60000) % 60,
      seconds: Math.floor(value / 1000) % 60,
      milliseconds: value % 1000,
    };
  },

  /** Format a duration for legacy Track construction.
   * @param time Split clock fields.
   */
  buildTimeCode(time: LegacyTimeData): string {
    const hours = time.days * 24 + time.hours;

    return `${hours ? `${hours}:` : ''}${hours ? String(time.minutes).padStart(2, '0') : time.minutes}:${String(time.seconds).padStart(2, '0')}`;
  },
};
