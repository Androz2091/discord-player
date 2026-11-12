/** Settings read from environment variables. */
export interface Config {
  /** Discord bot token. */
  token: string;

  /** Hostnames that `/play` may load audio from. When empty, `/play` is disabled. */
  allowedMediaHosts: string[];
}

/**
 * Reads and validates the bot configuration.
 *
 * @param env Environment variables to read from.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const token = env.DISCORD_TOKEN?.trim();

  if (!token) {
    throw new Error('DISCORD_TOKEN is not set. Copy .env.example to .env and add your bot token.');
  }

  const allowedMediaHosts = (env.ALLOWED_MEDIA_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  for (const host of allowedMediaHosts) {
    if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(host)) {
      throw new Error(`ALLOWED_MEDIA_HOSTS must list bare hostnames such as "media.example.com", but got "${host}".`);
    }
  }

  return { token, allowedMediaHosts };
}
