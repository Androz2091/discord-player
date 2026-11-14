/** Where a project lives, derived from its URL without external requests. Unsupported metadata is null. */
export interface ProjectSource {
  /** Hosting platform, such as `GitHub` or `npm`. */
  platform: string;

  /** Repository or package identifier shown on the card, such as `owner/repo` or `package-name`. */
  identifier: string;

  /** Repository owner or namespace, inferred from the first repository path segment. */
  author: string | null;

  /** GitHub profile image URL. Other hosting platforms are not supported. */
  imageUrl: string | null;
}

/**
 * Derives where a community project lives from its URL.
 *
 * @param url Project URL, such as a GitHub repository or an npm package.
 */
export function getProjectSource(url: string): ProjectSource {
  const { hostname, pathname } = new URL(url);
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const [author, repo] = segments;

  if (hostname === 'github.com' && author && repo) {
    const cleanRepo = repo.replace(/\.git$/, '').replace(/\.+$/, '');

    return {
      platform: 'GitHub',
      identifier: `${author}/${cleanRepo}`,
      author,
      imageUrl: `https://github.com/${encodeURIComponent(author)}.png`,
    };
  }

  if (hostname === 'npm.im' || hostname.endsWith('npmjs.com')) {
    const parts = hostname === 'npm.im' ? segments : segments[0] === 'package' ? segments.slice(1) : segments;
    const name = parts[0]?.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];

    if (name) return { platform: 'npm', identifier: name, author: null, imageUrl: null };
  }

  return {
    platform: hostname === 'gitlab.com' ? 'GitLab' : hostname.replace(/^www\./, ''),
    identifier: hostname.replace(/^www\./, '') + pathname,
    author: author && repo ? author : null,
    imageUrl: null,
  };
}
