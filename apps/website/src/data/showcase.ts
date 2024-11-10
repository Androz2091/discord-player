import semver from 'semver';

interface IShowcase {
    bots: {
        name: string;
        description: string;
        version: string;
        url: string;
    }[];
    extractors: {
        name: string;
        description: string;
        url: string;
    }[];
}

// please do not edit this list, this list is updated by the maintainers of discord-player
const PromotedList: IShowcase = {
    bots: [
        {
            name: 'Music Bot',
            description: 'A complete music bot example covering topics like custom playlists, persistent config, custom extractor, redis cache, web interface and more.',
            version: '(Promoted)',
            url: 'https://github.com/twlite/music-bot'
        },
        {
            name: 'Cadence [Deprecated]',
            description: "A Free Discord Music Bot. No locked functionality, no premium tier, no ads; everything's free, always!",
            version: '(Promoted)',
            url: 'https://github.com/mariusbegby/cadence-discord-bot'
        }
    ],
    extractors: []
};

// You can edit this list. You don't need to care about sorting by version, just add your project here
export const ShowcaseResource: IShowcase = {
    bots: PromotedList.bots.concat(
        [
            {
                name: 'Mirasaki Music Bot',
                description: 'Complete (45+ commands) music bot with persistent settings, effects, filters, auto-play, DJ-roles, and much more.',
                version: 'v6.6.3',
                url: 'https://github.com/Mirasaki/mirasaki-music-bot'
            },
            {
                name: 'Discord Player Bot',
                description: 'A feature-rich, open-source Discord music bot that supports multiple streaming platforms, has no payment restrictions, and is easy to self-host with Docker.',
                version: 'v6.6.10',
                url: 'https://github.com/LakhindarPal/discord-player-bot'
            },
            {
                name: 'Naybor',
                description: 'Complete and configurable discord music bot using discord-player',
                version: 'v6.3.0',
                url: 'https://github.com/antoinemcx/naybor'
            },
            {
                name: '그린Bot',
                description: 'Very simple and based official guide music bot, written in TypeScript.',
                version: 'v6.3.0',
                url: 'https://github.com/GreenScreen410/GreenBot-Discord'
            },
            {
                name: 'Music Disc',
                description: "I am using discord-player to play music on Discord with friends. It's easy to set up and run yourself.",
                version: 'v6.6.6',
                url: 'https://github.com/hmes98318/Music-Disc-discord-player'
            },
            {
                name: 'Botanique',
                description: 'Typescript bot running on Docker, using discord-player for music and lyrics.',
                version: 'v6.6.4',
                url: 'https://git.mylloon.fr/ConfrerieDuKassoulait/Botanique'
            },
            {
                name: 'Jappan',
                description: "A simple discord bot made to make someone's life easier. Currently features Music Playback, Fun Commands, Leveling System & Moderation Tools",
                version: 'v6.6.8',
                url: 'https://github.com/febkosq8/Jappan'
            },
            {
                name: 'Mittelbot',
                description: "A moderation & utility bot with music to play everyone's favourite music.",
                version: 'v6.6.3',
                url: 'https://github.com/Mittelbots/Mittelbot'
            },
            {
                name: 'Wego Overseer',
                description: "Using discord-player to manage Wego Overseer's music functionality",
                version: 'v6.2.1',
                url: 'https://github.com/rickklaasboer/wego-overseer'
            },
            {
                name: 'Auricle',
                description: 'This is a music bot created by using the sapphire framework & discord-player with this project being written in TypeScript.',
                version: 'v6.6.1',
                url: 'https://github.com/itsauric/auricle-music-bot'
            },
            {
                name: 'Beat-Bot',
                description: 'Fun discord bot with helpful util commands and music player using discord-player.',
                version: 'v6.1.1',
                url: 'https://github.com/IslandRhythms/Beat-Bot'
            },
            {
                name: 'Melody',
                description: 'Useful Discord music bot with many commands and effects to spice up your music.',
                version: 'v6.1.1',
                url: 'https://github.com/NerdyTechy/Melody'
            },
            {
                name: 'Discord Music Bot',
                description: "I'm using discord-player to make a discord music bot, it does pretty much the same as what a normal music bot does, also has lyrics and filters.",
                version: 'v6.1.0',
                url: 'https://github.com/ervin-sungkono/Discord-Music-Bot'
            },
            {
                name: 'Bhop Music Bot',
                description:
                    'There were not many bots made with discord-player 6.0.0 and discord.js 14.7.1, I was bored and made a simple one. We are using discord-player to listen music while bhopping. 🐇',
                version: 'v6.6.4',
                url: 'https://github.com/akanora/bhop-music-bot'
            },
            {
                name: 'Lofi Girl bot',
                description: 'I made a Lofi music bot with discord-player',
                version: 'v6.0.0',
                url: 'https://github.com/Greensky-gs/Lofi-girl'
            },
            {
                name: 'Music Bot',
                description: 'Only a music bot which use discord-player.',
                version: 'v6.0.0',
                url: 'https://github.com/JazzyArmando1234/music-bot/tree/master'
            },
            {
                name: 'Yeci',
                description: 'I am using discord-player to play music with shards',
                version: 'v6.0.0',
                url: 'https://github.com/yeci226/yeci-bot'
            },
            {
                name: 'DumBot',
                description: 'Open source bot made using discord.js and discord-player that contains dice rolling and music playing functionality.',
                version: 'v5.4.0',
                url: 'https://github.com/Mateo-Wallace/MP2-Discord-DumBot-V2'
            },
            {
                name: 'Flowease',
                description: 'A discord bot that use discord-player to play music from netease-cloud-music',
                version: 'v6.6.0',
                url: 'https://github.com/Lutra-Fs/Flowease'
            },
            {
                name: 'AtlantaBot',
                description: 'We are using discord-player to manager all of our music commands.',
                version: 'v4.1.0',
                url: 'https://github.com/Androz2091/AtlantaBot'
            },
            {
                name: 'Elite Music',
                description: 'An open-source & feature-packed Discord music bot, complete with a large selection of commands, effects, customisability, Docker & Plex support and much more! 🚀💪',
                version: 'v6.6.8',
                url: 'https://github.com/ThatGuyJacobee/Elite-Music'
            },
            {
                name: 'AstroMonkey',
                description:
                    'AstroMonkey is an open-source music bot! it has support for Autocomplete search using Slash Commands, Queue management to take control of your music, and playlists to add music too for later.',
                version: 'v6.6.3',
                url: 'https://github.com/ToothlessBrush/AstroMonkey'
            },
            {
                name: 'muusik.app',
                description: 'An open-source Discord music bot with an interative dashboard, only plays music, nothing else.',
                version: 'v6.6.7',
                url: 'https://muusik.app'
            },
            {
                name: 'WD-40',
                description: 'A music, utility & fun discord bot made in JavaScript ',
                version: 'v6.7.1',
                url: 'https://github.com/iTsMaaT/WD-40'
            }
        ].sort((a, b) => semver.rcompare(a.version, b.version))
    ),
    extractors: PromotedList.extractors.concat([
        {
            name: 'discord-player-youtubei',
            description: 'An alternative unofficial youtube extractor for discord-player with better stability and performance.',
            url: 'https://github.com/retrouser955/discord-player-youtubei'
        },
        {
            name: 'discord-player-deezer',
            description: 'An official extractor for discord-player to add support for deezer source.',
            url: 'https://npm.im/discord-player-deezer'
        },
        {
            name: 'discord-player-yandexmusic',
            description: 'Unofficial discord-player extractor for Yandex Music.',
            url: 'https://npm.im/discord-player-yandexmusic'
        },
        {
            name: 'discord-player-tidal',
            description: 'An unofficial discord-player extractor to add support for tidal source.',
            url: 'https://npm.im/discord-player-tidal'
        }
    ])
};
