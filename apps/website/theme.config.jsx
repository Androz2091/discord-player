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
    darkMode: false,
    nextThemes: {
        defaultTheme: 'light'
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
    head: (
        <>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta property="og:title" content="Discord Player" />
            <meta property="og:description" content="Discord Player documentation" />
        </>
    ),
    feedback: {
        useLink: () => `https://github.com/Androz2091/discord-player/issues/new?title=${encodeURIComponent('Feedback for Documentation')}&labels=documentation`
    }
};
