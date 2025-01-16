import { Orbitron } from 'next/font/google';
import Link from 'next/link';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import DiscordInvite from '@/components/discord-invite';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Metadata } from 'next';

const orbitron = Orbitron({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Discord Player',
  description:
    'Discord Player is a robust framework for developing Discord Music bots using JavaScript and TypeScript. It is built on top of discord-voip library and offers a comprehensive set of customizable tools, making it one of the most feature enrich framework in town.',
};

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col justify-center items-center text-center">
      <h1
        className={
          'scroll-m-20 tracking-tight font-extrabold lg:text-8xl md:text-7xl text-6xl uppercase select-none mb-8 ' +
          orbitron.className
        }
      >
        Discord Player
      </h1>
      <p className="text-fd-muted-foreground lg:w-1/2 text-justify px-4 md:px-0 md:text-center">
        Discord Player is a robust framework for developing Discord Music bots
        using JavaScript and TypeScript. It is built on top of{' '}
        <Link
          href="https://npm.im/discord-voip"
          className="text-fd-foreground font-semibold underline"
        >
          discord-voip
        </Link>{' '}
        library and offers a comprehensive set of customizable tools, making it
        one of the most feature enrich framework in town.
      </p>
      <div className="px-4 w-full md:w-[40%] lg:w-[30%]">
        <Tabs
          items={['npm', 'yarn', 'pnpm', 'bun']}
          className="text-start"
          persist
        >
          <Tab value="npm">
            <CodeBlock lang="bash">
              <Pre>npm add discord-player</Pre>
            </CodeBlock>
          </Tab>
          <Tab value="yarn">
            <CodeBlock lang="bash">
              <Pre>yarn add discord-player</Pre>
            </CodeBlock>
          </Tab>
          <Tab value="pnpm">
            <CodeBlock lang="bash">
              <Pre>pnpm add discord-player</Pre>
            </CodeBlock>
          </Tab>
          <Tab value="bun">
            <CodeBlock lang="bash">
              <Pre>bun add discord-player</Pre>
            </CodeBlock>
          </Tab>
        </Tabs>
      </div>
      <div className="inline-flex items-center gap-3 max-md:mx-auto">
        <Link
          className="inline-flex items-center justify-center text-sm font-medium ring-offset-fd-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring disabled:pointer-events-none disabled:opacity-50 bg-fd-background bg-gradient-to-b from-fd-primary to-fd-primary/60 text-fd-primary-foreground shadow-inner shadow-fd-background/20 hover:bg-fd-primary/90 h-11 px-6 rounded-full"
          href="/docs"
        >
          Getting Started
        </Link>
        <Link
          href="/api"
          className="inline-flex items-center justify-center text-sm font-medium ring-offset-fd-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring disabled:pointer-events-none disabled:opacity-50 border bg-gradient-to-t from-fd-primary/10 shadow-inner shadow-fd-primary/10 hover:bg-fd-accent/50 hover:text-fd-accent-foreground h-11 px-6 rounded-full bg-fd-background"
        >
          API Docs
        </Link>
      </div>
      <div className="mt-8 text-left px-4 md:px-0">
        <DiscordInvite />
      </div>
    </main>
  );
}
