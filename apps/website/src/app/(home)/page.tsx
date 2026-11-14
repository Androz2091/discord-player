import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { ServerCodeBlock } from 'fumadocs-ui/components/codeblock.rsc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'fumadocs-ui/components/tabs';
import { CopyCommand } from '@/components/copy-command';
import { DiscordInvite } from '@/components/discord-invite';
import { VersionBadge } from '@/components/version-badge';
import { communityResources } from '@/data/community';
import { getFundingLinks } from '@/lib/funding';
import { getProjectSource } from '@/lib/project-source';
import { communityRoute, discordInviteUrl, gitConfig } from '@/lib/shared';
import { getDefaultDocsVersion, getDocsVersion, getVersionBaseUrl, type DocsVersionId } from '@/lib/versions';

export const metadata: Metadata = {
  title: { absolute: 'Discord Player | Music playback for your Discord bot' },
  description:
    'Build Discord music bots with queues, playback controls, events, and extensible audio sources. Start with stable v7 or explore the Remedia-powered v8 development preview.',
};

const remediaUrl = 'https://github.com/twlite/remedia';
const generatorCommand = 'npm create music-bot@dev';

/** Short excerpts; the linked setup guides supply the Discord client and source configuration. */
const examples: Record<DocsVersionId, string> = {
  v7: `import { Player } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';

// Use your connected discord.js client.
const player = new Player(client);
await player.extractors.loadMulti(DefaultExtractors);

player.events.on('playerStart', (_queue, track) => {
  console.log(\`Now playing: \${track.title}\`);
});

// Inside your /play command:
await player.play(voiceChannel, query);`,
  v8: `import { player } from './player';

// Player is initialized with your Gateway and source plugins.
player.events.on('playerStart', (_queue, track) => {
  console.log(\`Now playing: \${track.title}\`);
});

// Inside your /play command:
await player.play(voiceChannel, query);`,
};

/** Runtime configuration excerpts; `send` is the application's shard-aware Gateway sender. */
const runtimes = [
  {
    id: 'embedded',
    title: 'Embedded',
    description:
      'One process for your bot and its audio. Remedia runs natively inside Node.js, with FFmpeg installed on the bot machine.',
    code: `const player = new Player({
  nodes: [{ id: 'local', type: 'embedded' }],
  send,
});

await player.initialize(botUserId);`,
    href: '/remedia/embedded',
    link: 'Set up embedded playback',
  },
  {
    id: 'remote',
    title: 'Remote',
    description:
      'Run the same engine in an independent Remedia server. Your bot keeps the queues and Gateway connection; the server handles audio and voice.',
    code: `const player = new Player({
  nodes: [{
    id: 'audio-1',
    type: 'remote',
    url: 'remedias://audio.example.com',
    auth: { username: 'bot', password: remediaPassword },
  }],
  send,
});

await player.initialize(botUserId);`,
    href: '/remedia/remote',
    link: 'Set up remote playback',
  },
] as const;

const linkClass =
  'inline-flex items-center gap-2 text-sm font-medium underline decoration-fd-border underline-offset-4 transition-colors hover:decoration-fd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring';
const buttonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 focus-visible:ring-offset-fd-background';
const headingClass = 'text-balance text-3xl font-semibold leading-tight tracking-[-0.035em] md:text-4xl';

function CodePanel({ code, title }: { code: string; title?: string }) {
  return (
    <ServerCodeBlock
      lang="ts"
      code={code}
      codeblock={{ title, className: '!my-0 min-w-0 !rounded-lg !shadow-none text-[0.8125rem]' }}
    />
  );
}

export default function HomePage() {
  const stable = getDefaultDocsVersion();
  const preview = getDocsVersion('v8');
  const stableBase = getVersionBaseUrl(stable.id);
  const previewBase = getVersionBaseUrl(preview.id);
  const stableStart = `${stableBase}${stable.startPath ?? ''}`;
  const previewStart = `${previewBase}${preview.startPath ?? ''}`;
  const categories = [
    { id: 'extractors', title: 'Extractors', projects: communityResources.extractors },
    { id: 'plugins', title: 'Plugins', projects: communityResources.plugins },
    { id: 'bots', title: 'Music bots', projects: communityResources.bots },
  ] as const;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 md:px-8">
      <section aria-labelledby="hero-heading" className="pb-12 pt-12 md:pb-16 md:pt-20">
        <div className="grid items-end gap-7 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
          <h1
            id="hero-heading"
            className="text-balance text-[2.75rem] font-semibold leading-[1.04] tracking-[-0.05em] sm:text-6xl lg:text-[4.25rem]"
          >
            Music playback for <span className="block text-fd-muted-foreground">your Discord bot.</span>
          </h1>
          <div>
            <p className="max-w-lg text-base leading-7 text-fd-muted-foreground">
              Queues, playback controls, and events, ready for your commands. Extend your audio sources and keep your
              bot’s behavior in your own code.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={stableStart}
                className={`${buttonClass} bg-fd-foreground text-fd-background hover:bg-fd-foreground/85`}
              >
                Get started <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href={previewBase} className={`${buttonClass} border hover:bg-fd-accent`}>
                Explore {preview.name} <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-3 text-xs text-fd-muted-foreground">
              {stable.name} is stable. {preview.name} is a development preview.
            </p>
          </div>
        </div>

        <div className="mt-9 grid items-start gap-6 lg:mt-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
          <div className="min-w-0">
            <CodePanel title={`play.ts · ${stable.name}`} code={examples[stable.id]} />
            <p className="mt-3 text-xs leading-5 text-fd-muted-foreground">
              A play command and its first event listener.{' '}
              <Link href={stableStart} className="underline underline-offset-4 hover:text-fd-foreground">
                Connect your client in the setup guide.
              </Link>
            </p>
          </div>
          <div className="min-w-0 lg:pt-1">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-medium">
              Start a {preview.name} project
              {preview.badge ? <VersionBadge badge={preview.badge} /> : null}
            </div>
            <div className="[&_code]:px-2 [&_code]:text-xs [&_button]:w-14 sm:[&_code]:px-4 sm:[&_code]:text-sm sm:[&_button]:w-24">
              <CopyCommand command={generatorCommand} label={`Create a ${preview.name} project`} />
            </div>
            <p className="mt-3 text-xs leading-5 text-fd-muted-foreground">
              A TypeScript or JavaScript starter with playback and queue commands.{' '}
              <Link href={previewStart} className="underline underline-offset-4 hover:text-fd-foreground">
                See the setup requirements.
              </Link>
            </p>
            <DiscordInvite />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="capabilities-heading"
        className="grid gap-8 border-t py-12 md:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16"
      >
        <div>
          <h2 id="capabilities-heading" className={headingClass}>
            The playback layer.
            <br />
            <span className="text-fd-muted-foreground">Your bot’s behavior.</span>
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-7 text-fd-muted-foreground">
            Work with tracks and queues. Connect playback to your commands, messages, and application logic.
          </p>
          <Link href={`${stableBase}/api`} className={`${linkClass} mt-5`}>
            Explore the {stable.name} API <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
        <dl className="divide-y border-y">
          <div className="grid gap-2 py-5 sm:grid-cols-[8rem_1fr] sm:gap-6">
            <dt className="text-sm font-semibold">Queue management</dt>
            <dd className="text-sm leading-6 text-fd-muted-foreground">
              Add tracks, reorder what plays next, shuffle, and repeat. Each guild keeps its own queue and history.
            </dd>
          </div>
          <div className="grid gap-2 py-5 sm:grid-cols-[8rem_1fr] sm:gap-6">
            <dt className="text-sm font-semibold">Playback controls</dt>
            <dd className="text-sm leading-6 text-fd-muted-foreground">
              Pause, seek, skip, and adjust volume through{' '}
              <code className="text-xs text-fd-foreground">queue.node</code>. Use the same controls from slash commands
              or buttons.
            </dd>
          </div>
          <div className="grid gap-2 py-5 sm:grid-cols-[8rem_1fr] sm:gap-6">
            <dt className="text-sm font-semibold">Application events</dt>
            <dd className="text-sm leading-6 text-fd-muted-foreground">
              React to track starts, queue completion, and playback errors with{' '}
              <code className="text-xs text-fd-foreground">player.events</code>.
            </dd>
          </div>
          <div className="grid gap-2 py-5 sm:grid-cols-[8rem_1fr] sm:gap-6">
            <dt className="text-sm font-semibold">Extensible sources</dt>
            <dd className="text-sm leading-6 text-fd-muted-foreground">
              Use extractors to resolve and stream your audio sources. In {preview.name}, capability-based plugins also
              extend search, lyrics, and queue behavior.
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="v8-heading" className="border-t py-12 md:py-16">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <h2 id="v8-heading" className="text-lg font-semibold">
            Discord Player {preview.name}
          </h2>
          {preview.badge ? <VersionBadge badge={preview.badge} /> : null}
          <span className="text-sm text-fd-muted-foreground">Development preview</span>
        </div>
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div>
            <h3 className={headingClass}>
              Your queues in JavaScript.
              <br />
              <span className="text-fd-muted-foreground">Your audio in Rust.</span>
            </h3>
            <p className="mt-5 max-w-md text-sm leading-7 text-fd-muted-foreground">
              {preview.name} uses{' '}
              <a
                href={remediaUrl}
                target="_blank"
                rel="noreferrer"
                className="text-fd-foreground underline decoration-fd-border underline-offset-4"
              >
                Remedia
              </a>
              , a Rust-based audio engine powered by FFmpeg, for decoding, processing, and Discord voice transport.
              Choose where the engine runs.
            </p>
            <p className="mt-4 max-w-md text-sm leading-7 text-fd-muted-foreground">
              {stable.name} remains the stable default. Try the preview to evaluate the new architecture before
              migrating an existing bot.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
              <Link href={previewStart} className={linkClass}>
                {preview.name} documentation <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
              <Link href={`${previewBase}/migration`} className={linkClass}>
                Migration guide
              </Link>
            </div>
          </div>
          <div className="min-w-0 rounded-xl border bg-fd-card p-4 sm:p-5">
            <Tabs defaultValue="embedded" className="!m-0 !overflow-visible !rounded-none !border-0 !bg-transparent">
              <TabsList aria-label="Playback runtime" className="!px-0">
                {runtimes.map((runtime) => (
                  <TabsTrigger
                    key={runtime.id}
                    value={runtime.id}
                    className="min-h-10 focus-visible:ring-2 focus-visible:ring-fd-ring"
                  >
                    {runtime.title}
                  </TabsTrigger>
                ))}
              </TabsList>
              {runtimes.map((runtime) => (
                <TabsContent
                  key={runtime.id}
                  value={runtime.id}
                  className="!rounded-none !bg-transparent !px-0 !pb-0 !pt-4"
                >
                  <p className="mb-4 min-h-18 text-sm leading-6 text-fd-muted-foreground">{runtime.description}</p>
                  <CodePanel code={runtime.code} />
                  <Link href={`${previewBase}${runtime.href}`} className={`${linkClass} mt-4`}>
                    {runtime.link} <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </TabsContent>
              ))}
            </Tabs>
            <p className="mt-4 border-t pt-3 text-xs leading-5 text-fd-muted-foreground">
              Runtime configuration excerpt. The setup guide covers source plugins and Gateway wiring; remote
              credentials come from your server configuration.
            </p>
          </div>
        </div>
        <dl className="mt-10 grid gap-7 border-t pt-7 md:grid-cols-3 md:gap-8">
          <div>
            <dt className="text-sm font-semibold">Host your sources remotely</dt>
            <dd className="mt-2 text-sm leading-6 text-fd-muted-foreground">
              Run source plugins and extractors in a separate plugin host, with execution routed through Remedia.
            </dd>
            <Link href={`${previewBase}/plugins/remote-hosts`} className={`${linkClass} mt-3`}>
              Remote source hosts <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div>
            <dt className="text-sm font-semibold">Bring your Discord library</dt>
            <dd className="mt-2 text-sm leading-6 text-fd-muted-foreground">
              Use discord.js, Oceanic, or another library. Wire its Gateway to{' '}
              <code className="text-xs text-fd-foreground">send</code> and{' '}
              <code className="text-xs text-fd-foreground">receive</code>; the Player stays independent.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold">Keep familiar queue APIs</dt>
            <dd className="mt-2 text-sm leading-6 text-fd-muted-foreground">
              Tracks, queues, playback controls, and events keep familiar entry points. Initialization and source setup
              change; the migration guide walks through both.
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="community-heading" className="border-t py-12 md:py-16">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="community-heading" className={headingClass}>
              Built by the community.
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-7 text-fd-muted-foreground">
              Find an audio source, learn from a working bot, or share an extension of your own.
            </p>
          </div>
          <Link href={communityRoute} className={`${linkClass} shrink-0`}>
            Explore the directory <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-7 md:grid-cols-3 md:gap-8">
          {categories.map((category) => (
            <div key={category.id} className="min-w-0 border-t pt-4">
              <h3>
                <Link
                  href={`${communityRoute}#${category.id}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-fd-ring"
                >
                  {category.title}
                  <ArrowRight className="size-3.5 text-fd-muted-foreground" aria-hidden="true" />
                </Link>
              </h3>
              {category.projects.length > 0 ? (
                <ul className="mt-2 divide-y">
                  {category.projects
                    .filter((project) => !project.deprecated)
                    .slice(0, 2)
                    .map((project) => {
                      const url = project.repositoryUrl ?? ('websiteUrl' in project ? project.websiteUrl : undefined);

                      if (!url)
                        throw new Error(`Community project "${project.name}" needs a repository or website URL.`);

                      const author = project.author ?? getProjectSource(url).author;

                      return (
                        <li key={url}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="group block rounded-sm py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
                          >
                            <span className="flex items-start justify-between gap-2 text-sm font-medium">
                              <span className="break-words group-hover:underline group-hover:underline-offset-4">
                                {project.name}
                              </span>
                              <ArrowUpRight
                                className="mt-0.5 size-3.5 shrink-0 text-fd-muted-foreground"
                                aria-hidden="true"
                              />
                            </span>
                            {author ? (
                              <span className="mt-1 block truncate text-xs text-fd-muted-foreground">by {author}</span>
                            ) : null}
                            <span className="mt-2 line-clamp-2 block text-sm leading-6 text-fd-muted-foreground">
                              {project.description}
                            </span>
                          </a>
                        </li>
                      );
                    })}
                </ul>
              ) : (
                <div className="py-4 text-sm leading-6 text-fd-muted-foreground">
                  <p>No community plugins listed yet.</p>
                  <Link href={`${communityRoute}#plugins`} className={`${linkClass} mt-3 text-fd-foreground`}>
                    Share your plugin <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs leading-5 text-fd-muted-foreground">
          Independent projects, listed for discovery. Review compatibility and the directory’s third-party resource
          guidelines before integrating.
        </p>
      </section>

      <section
        aria-labelledby="start-heading"
        className="flex flex-col gap-7 border-t py-12 md:py-16 lg:flex-row lg:items-center lg:justify-between"
      >
        <div>
          <h2 id="start-heading" className={headingClass}>
            Start with a play command.
          </h2>
          <p className="mt-3 text-sm leading-7 text-fd-muted-foreground">
            Set up your Player, connect a source, and build from there.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={stableStart}
            className={`${buttonClass} bg-fd-foreground text-fd-background hover:bg-fd-foreground/85`}
          >
            Build with {stable.name}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link href={previewStart} className={`${buttonClass} border hover:bg-fd-accent`}>
            Try the {preview.name} preview
          </Link>
        </div>
      </section>

      <footer className="flex flex-col gap-5 border-t py-7 text-xs leading-6 text-fd-muted-foreground lg:flex-row lg:items-start lg:justify-between">
        <p>
          Discord Player
          <br />
          MIT licensed. Androz2091 and contributors.
        </p>
        <nav aria-label="Footer" className="flex max-w-2xl flex-wrap gap-x-5 gap-y-2">
          <Link href={stableBase} className="hover:text-fd-foreground">
            {stable.name} documentation
          </Link>
          <Link href={previewBase} className="hover:text-fd-foreground">
            {preview.name} preview
          </Link>
          <Link href={communityRoute} className="hover:text-fd-foreground">
            Community
          </Link>
          <a href={discordInviteUrl} target="_blank" rel="noreferrer" className="hover:text-fd-foreground">
            Discord
          </a>
          <a
            href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-fd-foreground"
          >
            GitHub
          </a>
          {getFundingLinks().map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="hover:text-fd-foreground">
              {link.label}
            </a>
          ))}
        </nav>
      </footer>
    </main>
  );
}
