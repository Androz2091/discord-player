/** Compares `vMAJOR.MINOR.PATCH` strings, newest first. */
function compareVersionsDescending(a: string, b: string): number {
  const parse = (version: string) => version.replace(/^v/, '').split('.').map(Number);
  const left = parse(a);
  const right = parse(b);

  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (right[index] ?? 0) - (left[index] ?? 0);

    if (difference !== 0) return difference;
  }

  return 0;
}

/** Metadata shared by community projects. */
export interface ICommunityResource {
  /** Project's display name. */
  name: string;
  /** Short description of the project's purpose. */
  description: string;
  /** Display author; falls back to the repository owner when available. */
  author?: string;
  /** Marks a maintainer pick independently of version compatibility. */
  featured?: boolean;
  /** Marks a project that is no longer recommended for new integrations. */
  deprecated?: boolean;
}

/** An extractor or source integration built by the community. */
export interface IExtractorShowcase extends ICommunityResource {
  /** Verified upstream source repository. */
  repositoryUrl: string;
  /** Required npm package registry listing. */
  npmUrl: string;
}

/** A community plugin extending capabilities beyond media extraction, such as lyrics or queue behavior. */
export interface IPluginShowcase extends ICommunityResource {
  /** Verified upstream source repository. */
  repositoryUrl: string;
  /** Optional package registry listing. */
  npmUrl?: string;
}

/** A music bot built with Discord Player. Listing eligibility is defined in COMMUNITY_LISTING.md. */
export interface IMusicBotShowcase extends ICommunityResource {
  /** Source repository, when the project publishes one. */
  repositoryUrl?: string;
  /** Optional project website. */
  websiteUrl?: string;
  /** Declared Discord Player version; omit when compatibility has not been established. */
  version?: string;
}

/** Community-maintained resources listed on the Community page. */
export interface IShowcase {
  plugins: IPluginShowcase[];
  bots: IMusicBotShowcase[];
  extractors: IExtractorShowcase[];
}

// Do not edit this list. It is updated by the maintainers of discord-player.
const PromotedList: IShowcase = {
  plugins: [],
  bots: [
    {
      name: 'Music Bot',
      description:
        'A complete music bot example covering topics like custom playlists, persistent config, custom extractor, redis cache, web interface and more.',
      featured: true,
      repositoryUrl: 'https://github.com/twlite/music-bot',
    },
  ],
  extractors: [],
};

// Community contributions: add your project to the appropriate collection below.
// Submissions require a public GitHub repository. Private projects are not eligible.
// See COMMUNITY_LISTING.md in the repository root for listing requirements.
// Shared fields: name, description, optional author, deprecated, and featured (maintainers only).
// Extractors require both repositoryUrl and npmUrl. Plugins require repositoryUrl;
// npmUrl is optional. Plugins extend capabilities beyond media extraction
// (for example lyrics providers or queue behavior).
// Websites supplement repositoryUrl; version is optional when compatibility is unknown.
// Avatars are inferred from repository URLs; custom icons and image URLs are not accepted.
// Keep PromotedList separate. Do not use version to indicate promotion.
// Bots are sorted by version; add your project anywhere in the array.
export const communityResources: IShowcase = {
  plugins: [],
  bots: PromotedList.bots.concat(
    [
      {
        name: 'Vivace Music',
        description:
          'Discord Music Bot with custom search channel in Spanish. Built with discord.js v14 and Discord-Player V7.2.0',
        version: 'v7.2.0',
        repositoryUrl: 'https://github.com/DxriaaaN/Vivace-Music-Discord-Music-Bot.',
      },
      {
        name: 'Kunang-Kunang',
        description:
          'Discord music bot with TikTok live integration, built with discord.js v14 and discord-player v7.1.x',
        version: 'v7.1.0',
        repositoryUrl: 'https://github.com/Kiznaiverr/kunang-kunang',
      },
      {
        name: 'Cadence',
        deprecated: true,
        description:
          "A Free Discord Music Bot. No locked functionality, no premium tier, no ads; everything's free, always!",
        version: 'v6.7.1',
        repositoryUrl: 'https://github.com/mariusbegby/cadence-discord-bot',
      },
      {
        name: 'Mirasaki Music Bot',
        description:
          'Complete (45+ commands) music bot with persistent settings, effects, filters, auto-play, DJ-roles, and much more.',
        version: 'v6.6.3',
        repositoryUrl: 'https://github.com/Mirasaki/mirasaki-music-bot',
      },
      {
        name: 'Discord Player Bot',
        description:
          'Free, open-source music bot built with Bun and TypeScript. Featuring 40+ commands, audio filters, button controls, and multi-source playback. Easy Docker self-hosting.',
        version: 'v7.2.0',
        repositoryUrl: 'https://github.com/LakhindarPal/discord-player-bot',
      },
      {
        name: 'Naybor',
        description: 'Complete and configurable discord music bot using discord-player',
        version: 'v6.3.0',
        repositoryUrl: 'https://github.com/antoinemcx/naybor',
      },
      {
        name: '그린Bot',
        description: 'Very simple and based official guide music bot, written in TypeScript.',
        version: 'v6.3.0',
        repositoryUrl: 'https://github.com/GreenScreen410/GreenBot-Discord',
      },
      {
        name: 'Music Disc',
        description:
          "I am using discord-player to play music on Discord with friends. It's easy to set up and run yourself.",
        version: 'v6.6.6',
        repositoryUrl: 'https://github.com/hmes98318/Music-Disc-discord-player',
      },
      {
        name: 'Botanique',
        description: 'Typescript bot running on Docker, using discord-player for music and lyrics.',
        version: 'v7.2.0',
        repositoryUrl: 'https://git.mylloon.fr/ConfrerieDuKassoulait/Botanique',
      },
      {
        name: 'Jappan',
        description:
          "A simple discord bot made to make someone's life easier. Currently features Music Playback, Fun Commands, Leveling System & Moderation Tools",
        version: 'v6.6.8',
        repositoryUrl: 'https://github.com/febkosq8/Jappan',
      },
      {
        name: 'Mittelbot',
        description: "A moderation & utility bot with music to play everyone's favourite music.",
        version: 'v6.6.3',
        repositoryUrl: 'https://github.com/Mittelbots/Mittelbot',
      },
      {
        name: 'Wego Overseer',
        description: "Using discord-player to manage Wego Overseer's music functionality",
        version: 'v6.2.1',
        repositoryUrl: 'https://github.com/rickklaasboer/wego-overseer',
      },
      {
        name: 'Auricle',
        description:
          'This is a music bot created by using the sapphire framework & discord-player with this project being written in TypeScript.',
        version: 'v7.2.0',
        repositoryUrl: 'https://github.com/itsauric/auricle-music-bot',
      },
      {
        name: 'Beat-Bot',
        description: 'Fun discord bot with helpful util commands and music player using discord-player.',
        version: 'v6.1.1',
        repositoryUrl: 'https://github.com/IslandRhythms/Beat-Bot',
      },
      {
        name: 'Melody',
        description: 'Useful Discord music bot with many commands and effects to spice up your music.',
        version: 'v6.1.1',
        repositoryUrl: 'https://github.com/NerdyTechy/Melody',
      },
      {
        name: 'Discord Music Bot',
        description:
          "I'm using discord-player to make a discord music bot, it does pretty much the same as what a normal music bot does, also has lyrics and filters.",
        version: 'v6.1.0',
        repositoryUrl: 'https://github.com/ervin-sungkono/Discord-Music-Bot',
      },
      {
        name: 'Bhop Music Bot',
        description:
          'There were not many bots made with discord-player 6.0.0 and discord.js 14.7.1, I was bored and made a simple one. We are using discord-player to listen music while bhopping. 🐇',
        version: 'v6.6.4',
        repositoryUrl: 'https://github.com/akanora/bhop-music-bot',
      },
      {
        name: 'Lofi Girl bot',
        description: 'I made a Lofi music bot with discord-player',
        version: 'v6.0.0',
        repositoryUrl: 'https://github.com/Greensky-gs/Lofi-girl',
      },
      {
        name: 'Music Bot',
        description: 'Only a music bot which use discord-player.',
        version: 'v6.0.0',
        repositoryUrl: 'https://github.com/JazzyArmando1234/music-bot/tree/master',
      },
      {
        name: 'Yeci',
        description: 'I am using discord-player to play music with shards',
        version: 'v6.0.0',
        repositoryUrl: 'https://github.com/yeci226/yeci-bot',
      },
      {
        name: 'DumBot',
        description:
          'Open source bot made using discord.js and discord-player that contains dice rolling and music playing functionality.',
        version: 'v5.4.0',
        repositoryUrl: 'https://github.com/Mateo-Wallace/MP2-Discord-DumBot-V2',
      },
      {
        name: 'Flowease',
        description: 'A discord bot that use discord-player to play music from netease-cloud-music',
        version: 'v6.6.0',
        repositoryUrl: 'https://github.com/Lutra-Fs/Flowease',
      },
      {
        name: 'AtlantaBot',
        description: 'We are using discord-player to manager all of our music commands.',
        version: 'v4.1.0',
        repositoryUrl: 'https://github.com/Androz2091/AtlantaBot',
      },
      {
        name: 'Elite Music',
        description:
          'An open-source & feature-packed Discord music bot, complete with Plex & Subsonic API support, Docker images, localisation and much more! 🚀💪',
        version: 'v7.2.0',
        repositoryUrl: 'https://github.com/ThatGuyJacobee/Elite-Music',
      },
      {
        name: 'AstroMonkey',
        description:
          'AstroMonkey is an open-source music bot! it has support for Autocomplete search using Slash Commands, Queue management to take control of your music, and playlists to add music too for later.',
        version: 'v6.6.3',
        repositoryUrl: 'https://github.com/ToothlessBrush/AstroMonkey',
      },
      {
        name: 'WD-40',
        description: 'A music, utility & fun discord bot made in JavaScript ',
        version: 'v7.2.0',
        repositoryUrl: 'https://github.com/iTsMaaT/WD-40',
      },
      {
        name: 'Zibot',
        description:
          'Ziji-bot is a versatile Discord bot offering music playback, and interactive commands to enhance user engagement.',
        version: 'v6.7.1',
        repositoryUrl: 'https://github.com/zijipia/Ziji-bot-discord',
      },
      {
        name: 'discord-bot',
        description: '🎵 Music bot for my private Discord server, powered by discord-player',
        version: 'v7.0.0',
        repositoryUrl: 'https://github.com/xxczaki/discord-bot',
      },
    ].sort((a, b) => compareVersionsDescending(a.version ?? '', b.version ?? '')),
  ),
  extractors: PromotedList.extractors.concat([
    {
      name: 'discord-player-youtubedlp',
      description: 'A YouTube yt-dlp extractor for Discord Player.',
      repositoryUrl: 'https://github.com/dfxphoenix/discord-player-youtubedlp',
      npmUrl: 'https://www.npmjs.com/package/discord-player-youtubedlp',
    },
    {
      name: 'discord-player-youtubei',
      description:
        'An alternative unofficial youtube extractor for discord-player with better stability and performance.',
      repositoryUrl: 'https://github.com/retrouser955/discord-player-youtubei',
      npmUrl: 'https://www.npmjs.com/package/discord-player-youtubei',
    },
    {
      name: 'discord-player-deezer',
      description: 'An official extractor for discord-player to add support for deezer source.',
      repositoryUrl: 'https://github.com/retrouser955/discord-player-deezer',
      npmUrl: 'https://npm.im/discord-player-deezer',
    },
    {
      name: 'discord-player-yandexmusic',
      description: 'Unofficial discord-player extractor for Yandex Music.',
      repositoryUrl: 'https://github.com/kotisoff/discord-player-yandexmusic',
      npmUrl: 'https://npm.im/discord-player-yandexmusic',
    },
    {
      name: 'discord-player-tidal',
      description: 'An unofficial discord-player extractor to add support for tidal source.',
      repositoryUrl: 'https://github.com/LakhindarPal/discord-player-tidal',
      npmUrl: 'https://npm.im/discord-player-tidal',
    },
    {
      name: 'discord-player-soundgasm',
      description: 'An unofficial discord-player extractor to add support for Soundgasm.',
      repositoryUrl: 'https://github.com/iTsMaaT/discord-player-soundgasm',
      npmUrl: 'https://www.npmjs.com/package/discord-player-soundgasm',
    },
    {
      name: 'discord-player-tts',
      description: 'An unofficial discord-player extractor to add tts capabilities to your bot.',
      repositoryUrl: 'https://github.com/iTsMaaT/discord-player-tts',
      npmUrl: 'https://www.npmjs.com/package/discord-player-tts',
    },
    {
      name: 'discord-player-soundcloud',
      description:
        'An unofficial discord-player extractor for soundcloud, inspired from the original one at @discord-player/extractor',
      repositoryUrl: 'https://github.com/iTsMaaT/discord-player-soundcloud',
      npmUrl: 'https://www.npmjs.com/package/discord-player-soundcloud',
    },
    {
      name: 'discord-player-spotify',
      description:
        'An unofficial discord-player extractor for spotify, inspired from the original one at @discord-player/extractor',
      repositoryUrl: 'https://github.com/iTsMaaT/discord-player-spotify',
      npmUrl: 'https://www.npmjs.com/package/discord-player-spotify',
    },
    {
      name: 'discord-player-applemusic',
      description:
        'An unofficial discord-player extractor for applemusic, inspired from the original one at @discord-player/extractor',
      repositoryUrl: 'https://github.com/iTsMaaT/discord-player-applemusic',
      npmUrl: 'https://www.npmjs.com/package/discord-player-applemusic',
    },
    {
      name: 'discord-player-hifi',
      description: 'An extractor that use hifi-api instances.',
      repositoryUrl: 'https://git.mylloon.fr/Anri/discord-player-hifi',
      npmUrl: 'https://npm.im/discord-player-hifi',
    },
    {
      name: 'discord-player-qobuzdl',
      description: 'An extractor that use Qobuz-DL instances.',
      repositoryUrl: 'https://git.mylloon.fr/Anri/discord-player-qobuzdl',
      npmUrl: 'https://npm.im/discord-player-qobuzdl',
    },
    {
      name: 'discord-player-subsonic',
      description: 'An extractor for a Subsonic API.',
      repositoryUrl: 'https://github.com/iTsMaaT/discord-player-subsonic',
      npmUrl: 'https://npm.im/discord-player-subsonic',
    },
    {
      name: 'simple-folder-search',
      description: 'Not an extractor, but a small tool to be able to search for songs in a folder and play them.',
      repositoryUrl: 'https://github.com/iTsMaaT/simple-folder-search',
      npmUrl: 'https://www.npmjs.com/package/simple-folder-search',
    },
  ]),
};
