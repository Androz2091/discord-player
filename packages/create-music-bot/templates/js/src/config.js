/**
 * Reads and validates the bot configuration from environment variables.
 *
 * @param {NodeJS.ProcessEnv} env Environment variables to read from.
 * @returns {{ token: string, allowedMediaHosts: string[] }} The bot token and the hostnames `/play` may load audio
 * from. When the host list is empty, `/play` is disabled.
 */
export function loadConfig(env = process.env) {
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
