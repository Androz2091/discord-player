import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, discordInviteUrl, gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      // JSX supported
      title: appName,
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    links: [
      {
        text: 'Discord',
        url: discordInviteUrl,
        external: true,
      },
    ],
  };
}
