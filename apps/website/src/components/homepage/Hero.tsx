import { firaCode, orbitron } from '@/lib/constants';
import { Button, cn, GitHubIcon, Heading, Label } from '@edge-ui/react';
import Link from 'next/link';
import React from 'react';

export default function Hero() {
    return (
        <div className="mt-5 flex items-center justify-center flex-col background min-h-[70vh]">
            <div className="text-center md:max-w-[90%] lg:max-w-[70%] mt-16 space-y-10">
                <Heading.H1 className={cn('lg:text-8xl md:text-7xl text-6xl uppercase select-none', orbitron.className)}>Discord Player</Heading.H1>
                <Heading.H4 className="mt-2 text-muted-foreground font-normal border-t-0">
                    Discord Player is a robust framework for developing Discord Music bots using JavaScript and TypeScript. It is built on top of the{' '}
                    <Link href="https://npm.im/@discordjs/voice" target="_blank" className="link">
                        @discordjs/voice
                    </Link>{' '}
                    library and offers a comprehensive set of customizable tools, making it one of the most feature enrich framework in town.
                </Heading.H4>
            </div>
            <div className="flex items-center gap-4 mt-6 px-4 flex-col md:flex-row w-full md:w-auto">
                <Button size="lg" className="w-full md:w-auto">
                    Get Started
                </Button>
                <Button variant="outline" className="gap-1 w-full  md:w-auto" size="lg">
                    <GitHubIcon className="h-5 w-5" />
                    GitHub
                </Button>
            </div>
            <div className="mt-5">
                <Label className={cn(firaCode.className, 'text-muted-foreground')}>
                    <span className="select-none">$</span> npm i --save discord-player
                </Label>
            </div>
        </div>
    );
}
