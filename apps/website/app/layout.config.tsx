import { DISCORD_INVITE } from '@/lib/constants';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

/**
 * Shared layout configurations
 *
 * you can configure layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: 'Discord Player',
  },
  links: [
    {
      text: 'Documentation',
      url: '/docs',
      active: 'nested-url',
    },
    {
      text: 'API Reference',
      url: '/api',
      active: 'nested-url',
    },
    {
      text: 'Community',
      url: '/community',
      active: 'url',
    },
    {
      text: 'Discord',
      url: DISCORD_INVITE,
    },
  ],
  githubUrl: 'https://github.com/Androz2091/discord-player',
};
