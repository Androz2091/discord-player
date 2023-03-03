import { useRouter } from 'next/router';
import { useConfig } from 'nextra-theme-docs';

/**
 * @type {import('nextra').ThemeConfig}
 */
export default {
    logo: <span>Discord Player</span>,
    project: {
        link: 'https://github.com/androz2091/discord-player'
    },
    chat: {
        link: 'https://discord.com/invite/hw87VUQ'
    },
    sidebar: {
        defaultMenuCollapseLevel: 0,
        toggleButton: true
    },
    primaryHue: 10,
    darkMode: false,
    nextThemes: {
        defaultTheme: 'dark'
    },
    banner: {
        dismissible: false,
        key: "discord-invite-banner",
        text: <a href="https://discord.com/invite/hw87VUQ" target="_blank">📢 Join our official Discord support server →</a>
    },
    docsRepositoryBase: 'https://github.com/Androz2091/discord-player/tree/master/apps/website/pages',
    titleTemplate: '%s – Discord Player',
    footer: {
        text: <span>
            MIT {new Date().getFullYear()} © <a href="https://discord-player.js.org" target="_blank">Androz2091</a>.
            Documentation generated with <a href="https://github.com/neplextech/typedoc-nextra" target="_blank" style={{
                textDecoration: 'underline',
                color: 'royalblue'
            }}>TypeDoc Nextra</a>.
        </span>,
    },
    head: () => {
        const { frontMatter } = useConfig();

        return <>
            <meta property="og:url" content="https://discord-player.js.org" />
            <meta property="og:title" content={frontMatter.title || 'Discord Player'} />
            <meta property="og:description" content={frontMatter.description || 'A complete framework to build your discord music bot in JavaScript/TypeScript.'} />
        </>;
    },
    useNextSeoProps() {
        const { asPath } = useRouter();

        if (asPath !== '/') {
            return {
                titleTemplate: '%s – Discord Player'
            };
        }

        return { titleTemplate: 'Discord Player' };
    },
    feedback: {
        useLink: () => `https://github.com/Androz2091/discord-player/issues/new?title=${encodeURIComponent('Feedback for Documentation')}&labels=documentation`
    }
};
