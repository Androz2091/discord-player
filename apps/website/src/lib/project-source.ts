/** Where a project lives, derived from its URL. Fields are only set when the URL exposes them. */
export interface ProjectSource {
  /** Hosting platform, such as `GitHub` or `npm`. */
  platform: string;

  /** Repository or package identifier shown on the card, such as `owner/repo` or `package-name`. */
  identifier: string;

  /** Repository owner. Only available for GitHub URLs. */
  author?: string;
}

/**
 * Derives where a community project lives from its URL.
 *
 * @param url Project URL, such as a GitHub repository or an npm package.
 */
export function getProjectSource(url: string): ProjectSource {
  const { hostname, pathname } = new URL(url);
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);

  if (hostname === 'github.com' && segments.length >= 2) {
    const [author, repo] = segments;
    const cleanRepo = repo!.replace(/\.git$/, '').replace(/\.+$/, '');

    return { platform: 'GitHub', identifier: `${author}/${cleanRepo}`, author };
  }

  if (hostname === 'npm.im' || hostname.endsWith('npmjs.com')) {
    const parts = hostname === 'npm.im' ? segments : segments[0] === 'package' ? segments.slice(1) : segments;
    const name = parts[0]?.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];

    if (name) return { platform: 'npm', identifier: name };
  }

  return { platform: hostname.replace(/^www\./, ''), identifier: hostname.replace(/^www\./, '') + pathname };
}
