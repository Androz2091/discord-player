import { JetBrains_Mono, Inter, Orbitron } from 'next/font/google';

interface IFeature {
    title: string;
    description: string;
}

interface ITools extends IFeature {
    link: string;
}

export const features: IFeature[] = [
    {
        title: 'Beginner-friendly with easy-to-understand features',
        description: 'Discord Player is designed to be user-friendly, making it easy for beginners to understand and use its features.'
    },
    {
        title: 'TypeScript support',
        description: 'Discord Player provides TypeScript support, allowing developers to take advantage of strong typing and improved code quality.'
    },
    {
        title: 'Offers hackable APIs',
        description: 'Discord Player offers APIs that can be easily customized and extended, giving developers the flexibility to create unique experiences.'
    },
    {
        title: 'Supports audio player sharing',
        description: 'With Discord Player, you can easily share your audio player across multiple queues, enabling collaborative listening experiences.'
    },
    {
        title: 'Quick and easy setup process',
        description: 'Setting up Discord Player is a breeze, allowing you to get started quickly and effortlessly.'
    },
    {
        title: 'Wide range of player management features',
        description: 'Discord Player provides an extensive set of features for managing and controlling audio playback in your application.'
    },
    {
        title: 'Offers 64+ built-in audio filter presets',
        description: 'With over 64 built-in audio filter presets, Discord Player gives you the ability to enhance and modify audio playback according to your preferences.'
    },
    {
        title: 'Highly customizable according to your needs',
        description: 'Discord Player is highly customizable, allowing you to tailor its functionality and appearance to suit your specific requirements.'
    },
    {
        title: 'Automatic queue management',
        description: 'Discord Player takes care of queue management automatically, simplifying the process of playing multiple audio tracks in sequence.'
    },
    {
        title: 'Query caching support',
        description: 'Discord Player supports query caching, which improves performance by caching search results and reducing the number of API calls.'
    },
    {
        title: 'Extensible sources through the Extractors API',
        description: 'With the Extractors API, Discord Player allows you to add and extend audio sources, giving you access to a wider range of content.'
    },
    {
        title: 'Object-oriented design',
        description: 'Discord Player follows an object-oriented design approach, making it easier to organize and maintain your audio player code.'
    },
    {
        title: 'Offers easy debugging methods',
        description: 'Discord Player provides various debugging methods and tools, making it simpler to troubleshoot and resolve issues.'
    },
    {
        title: 'Out-of-the-box voice states handling',
        description: 'Discord Player includes built-in support for handling voice states, making it effortless to manage and control voice-related operations.'
    },
    {
        title: 'Event-driven',
        description: 'Discord Player emits various events, allowing you to respond to different player and queue-related events in your application.'
    }
];

export const tools: ITools[] = [
    {
        title: 'discord.js',
        link: 'https://npm.im/discord.js',
        description:
            'Discord Player is built with discord.js, a powerful and popular JavaScript library for interacting with the Discord API. It provides a solid foundation for building Discord bots and applications.'
    },
    {
        title: 'ffmpeg',
        link: 'https://ffmpeg.org',
        description: 'Discord Player leverages ffmpeg, a comprehensive multimedia framework, to handle audio encoding, decoding, and streaming. It ensures efficient and high-quality audio playback.'
    },
    {
        title: 'discord-voip',
        link: 'https://npm.im/discord-voip',
        description:
            'Discord Player utilizes discord-voip, a dedicated library for voice-related functionalities in discord.js. It offers a seamless integration for handling voice connections and streaming audio.'
    }
];

export const orbitron = Orbitron({
    subsets: ['latin']
});

export const jbMono = JetBrains_Mono({
    subsets: ['latin']
});

export const inter = Inter({
    subsets: ['latin'],
    variable: '--font-sans',
    display: 'swap'
});

export const DISCORD_INVITE = 'https://androz2091.fr/discord';
export const DISCORD_ICON = 'https://cdn.discordapp.com/icons/558328638911545423/54b69e440728a954e3e52b54f3206894.webp?size=128';
