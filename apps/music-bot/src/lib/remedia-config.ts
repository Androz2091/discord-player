import type { DiscordPlayerNode } from 'discord-player';

/** Choose the same Remedia engine in-process or through a standalone server. */
export function createRemediaNodes(env: NodeJS.ProcessEnv = process.env): DiscordPlayerNode[] {
  const mode = env.REMEDIA_MODE ?? 'embedded';
  if (mode === 'embedded') return [{ id: 'local', type: 'embedded' }];
  if (mode !== 'remote') throw new Error('REMEDIA_MODE must be "embedded" or "remote".');

  const url = env.REMEDIA_URL?.trim();
  const username = env.REMEDIA_USERNAME?.trim();
  const password = env.REMEDIA_PASSWORD;
  if (!url || !username || !password) {
    throw new Error('Remote mode requires REMEDIA_URL, REMEDIA_USERNAME and REMEDIA_PASSWORD.');
  }
  return [{ id: 'remote', type: 'remote', url, auth: { username, password } }];
}
