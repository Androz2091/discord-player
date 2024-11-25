import { jbMono, orbitron } from '@/lib/constants';
import { Separator, Button, cn, GitHubIcon, Heading, Label } from '@edge-ui/react';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import React from 'react';
import DiscordInvite from './DiscordInvite';

export default function Hero() {
    return (
        <div className="mt-5 flex items-center justify-center flex-col background min-h-[75vh]">
            <div className="text-center md:max-w-[90%] lg:max-w-[70%] mt-16 space-y-10">
                <Heading.H1
                    className={cn('lg:text-8xl md:text-7xl text-6xl uppercase select-none', orbitron.className)}
                >
                    Discord Player
                </Heading.H1>
                <Heading.H5 className="mt-2 text-muted-foreground font-normal border-t-0 text-start md:text-center">
                    Discord Player is a robust framework for developing Discord Music bots using JavaScript and
                    TypeScript. It is built on top of the{' '}
                    <Link href="https://npm.im/discord-voip" target="_blank" className="link">
                        discord-voip
                    </Link>{' '}
                    library and offers a comprehensive set of customizable tools, making it one of the most feature
                    enrich framework in town.
                </Heading.H5>
            </div>
            <div className="mt-5">
                <Link
                    href={'https://github.com/twlite/music-bot'}
                    className="inline-flex items-center rounded-lg bg-muted px-3 py-1 text-sm font-medium"
                >
                    🎉 <Separator orientation="vertical" /> Get started with our music bot example{' '}
                    <ArrowRight className="h-4 w-4" />
                </Link>
            </div>
            <div className="flex items-center gap-4 mt-6 px-4 flex-col md:flex-row w-full md:w-auto">
                <Link href="/docs" className="w-full md:w-auto">
                    <Button size="lg" className="w-full md:w-auto">
                        Get Started
                    </Button>
                </Link>
                <Link
                    href="https://github.com/androz2091/discord-player"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="w-full md:w-auto"
                >
                    <Button variant="outline" className="gap-1 w-full  md:w-auto" size="lg">
                        <GitHubIcon className="h-5 w-5" />
                        GitHub
                    </Button>
                </Link>
            </div>
            <div className="mt-5">
                <Label className={cn(jbMono.className, 'text-muted-foreground')}>
                    <span className="select-none">$</span> npm i --save discord-player
                </Label>
            </div>

            <div className="mt-5">
                <DiscordInvite />
            </div>
        </div>
    );
}
