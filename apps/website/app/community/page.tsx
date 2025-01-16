'use client';

import { Heading } from '@/components/heading';
import Link from 'next/link';
import {
  IExtractorShowcase,
  IMusicBotShowcase,
  ShowcaseResource,
} from '@/lib/data/showcase';
import { useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { Card } from 'fumadocs-ui/components/card';

export default function CommunityPage() {
  const [extractors, setExtractors] = useState<IExtractorShowcase[]>(() => {
    return ShowcaseResource.extractors;
  });
  const [musicBots, setMusicBots] = useState<IMusicBotShowcase[]>(() => {
    return ShowcaseResource.bots;
  });

  const [search, setSearch] = useState('');

  const term = useDebounce(search, 300);

  useEffect(() => {
    if (!term) {
      setExtractors(ShowcaseResource.extractors);
      setMusicBots(ShowcaseResource.bots);
    } else {
      setExtractors(
        ShowcaseResource.extractors.filter((extractor) => {
          return (
            extractor.name.toLowerCase().includes(term.toLowerCase()) ||
            extractor.description.toLowerCase().includes(term.toLowerCase())
          );
        }),
      );
      setMusicBots(
        ShowcaseResource.bots.filter((bot) => {
          return (
            bot.name.toLowerCase().includes(term.toLowerCase()) ||
            bot.description.toLowerCase().includes(term.toLowerCase())
          );
        }),
      );
    }
  }, [term]);

  return (
    <main className="container">
      <div className="py-8">
        <Heading as="h1" className="text-3xl font-bold">
          Community Showcase
        </Heading>
        <p className="mt-2 mb-4 text-lg text-fd-muted-foreground">
          A curated list of resources like open-source music bots and
          extractors, built by the Discord Player community.
        </p>
        <Link
          className="inline-flex items-center justify-center text-sm font-medium ring-offset-fd-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring disabled:pointer-events-none disabled:opacity-50 bg-fd-background bg-gradient-to-b from-fd-primary to-fd-primary/60 text-fd-primary-foreground shadow-inner shadow-fd-background/20 hover:bg-fd-primary/90 h-11 px-6 rounded-full"
          href="https://github.com/Androz2091/discord-player/blob/master/apps/website/lib/data/showcase.ts"
        >
          Add your own
        </Link>
      </div>
      <div>
        <input
          className="flex h-10 w-full rounded-md border bg-transparent px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 max-w-xl"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="my-8">
        <Heading as="h2" className="text-2xl font-bold">
          Extractors ({extractors.length})
        </Heading>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 grid-flow-row gap-8 my-4">
          {extractors.map((extractor) => (
            <Card
              key={extractor.url}
              title={extractor.name}
              description={extractor.description}
              external
              href={extractor.url}
            />
          ))}
        </div>
      </div>
      <div>
        <Heading as="h2" className="text-2xl font-bold">
          Music Bots ({musicBots.length})
        </Heading>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 grid-flow-row gap-8 my-4">
          {musicBots.map((bot) => (
            <Card
              key={bot.url}
              title={bot.name}
              description={
                <span className="flex flex-col space-y-2">
                  <span>{bot.description}</span>{' '}
                  <span className="max-w-fit border rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors dark:bg-fd-ring dark:hover:bg-fd-secondary bg-fd-ring hover:bg-fd-muted-foreground border-transparent dark:text-fd-muted-foreground text-fd-muted">
                    {bot.version}
                  </span>
                </span>
              }
              external
              href={bot.url}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
