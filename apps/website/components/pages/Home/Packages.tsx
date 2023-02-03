import { NavLink, Stack, Title } from '@mantine/core';
import Link from 'next/link';
import { RightArrow } from '../../icons';

interface DPPackages {
    name: string;
    url: string;
    description: string;
}

const PackagesList: DPPackages[] = [
    {
        description: 'Main Library',
        name: 'discord-player',
        url: '/docs/classes/discord-player/Player'
    },
    {
        description: 'Equalizer & Audio Filters Provider',
        name: '@discord-player/equalizer',
        url: '/docs/classes/@discord-player/equalizer/AudioFilter'
    },
    {
        description: 'Extractors',
        name: '@discord-player/extractor',
        url: '/docs/classes/@discord-player/extractor/AttachmentExtractor'
    },
    {
        description: 'youtube-dl based downloader',
        name: '@discord-player/downloader',
        url: '/docs/classes/@discord-player/downloader/Downloader'
    },
    {
        description: 'Utilities for Discord Player',
        name: '@discord-player/utils',
        url: '/docs/classes/@discord-player/utils/Collection'
    }
];

export function Packages() {
    return (
        <div>
            <Title>Packages</Title>
            <Stack spacing="xs">
                {PackagesList.map((m, i) => {
                    return (
                        <Link href={m.url} key={i}>
                            <NavLink
                                label={m.name}
                                description={m.description}
                                rightSection={<RightArrow />}
                                variant='subtle'
                                color='indigo'
                            />
                        </Link>
                    );
                })}
            </Stack>
        </div>
    );
}
