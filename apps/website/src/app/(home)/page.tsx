import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'fumadocs-ui/components/tabs';
import { ServerCodeBlock } from 'fumadocs-ui/components/codeblock.rsc';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { DiscordInvite } from '@/components/discord-invite';
import { VersionBadge } from '@/components/version-badge';
import { communityResources } from '@/data/community';
import { communityRoute, discordInviteUrl, gitConfig } from '@/lib/shared';
import {
  defaultVersionId,
  getDefaultDocsVersion,
  getDocsVersions,
  getVersionBaseUrl,
  type DocsVersionId,
} from '@/lib/versions';

export const metadata = {
  title: { absolute: 'Discord Player | Music bots for Discord' },
  description:
    'Discord Player manages queues, playback controls, and events for Discord music bots, with extensible music sources and TypeScript types.',
};

/** A working example for each documentation version. Adding a version in `versions.ts` requires adding one here. */
const examples: Record<DocsVersionId, { lang: string; file: string; code: string }> = {
  v7: {
    lang: 'ts',
    file: 'index.ts',
    code: `// index.ts
import { Client, GatewayIntentBits } from 'discord.js';
import { Player } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const player = new Player(client);

await player.extractors.loadMulti(DefaultExtractors);

// Inside your /play command
const { track } = await player.play(channel, query, {
  nodeOptions: { metadata: interaction },
});
`,
  },
  v8: {
    lang: 'ts',
    file: 'player.ts',
    code: `// src/player.ts
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { Player } from 'discord-player';
import { directMedia } from './direct-media.ts';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

export const player = new Player({
  plugins: [directMedia()],

  send(guildId, payload) {
    const guild = client.guilds.cache.get(guildId);

    if (!guild) throw new Error(\`Guild \${guildId} is not cached.\`);

    return guild.shard.send(payload);
  },
});

client.on(Events.Raw, (packet) => player.receive(packet));
client.once(Events.ClientReady, (ready) => player.initialize(ready.user.id));

// Inside your /play command
const { track } = await player.play(voiceChannel, url, { requestedBy: interaction.user.id });
`,
  },
};

/** What each version is, written for the version table. */
const versionNotes: Record<DocsVersionId, { points: string[]; start: { label: string; path: string } }> = {
  v7: {
    points: [
      'Audio through discord-voip and FFmpeg.',
      'Ready-made extractors in @discord-player/extractor.',
      'Documented API reference for every package.',
    ],
    start: { label: 'Build a music bot', path: '/creating-a-music-bot/01_integrating' },
  },
  v8: {
    points: [
      'Audio decoded and sent to Discord by Remedia, inside your bot or on a separate server.',
      'Source plugins replace the extractor bundle. Your v7 extractors keep working.',
      'Your Discord library stays in charge of the gateway connection.',
    ],
    start: { label: 'Getting started', path: '/getting-started' },
  },
};

const capabilities = [
  ['Queues', 'Add, reorder, repeat, and shuffle tracks. History lets listeners go back.'],
  ['Playback', 'Pause, seek, volume, and a progress timeline you can render in an embed.'],
  ['Audio filters', 'Bass boost, nightcore, 8D, and dozens more presets, or your own FFmpeg filters.'],
  ['Music sources', 'Search and stream from any provider through extractors or source plugins.'],
  ['Events', 'Typed events for starts, finishes, skips, errors, and voice changes.'],
  ['Lyrics', 'Plain and synchronized lyrics that follow playback.'],
] as const;

const buttonBase =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 focus-visible:ring-offset-fd-background';

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border-t py-16 md:py-24">
      <div className="grid gap-10 md:grid-cols-[minmax(0,18rem)_1fr] md:gap-16">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {description ? <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">{description}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

export default function HomePage() {
  const defaultVersion = getDefaultDocsVersion();
  const versions = getDocsVersions();
  const nextVersion = versions.find((version) => version.id !== defaultVersionId);
  const { extractors, bots } = communityResources;
  const featured = [...bots.slice(0, 1), ...extractors.slice(0, 4)];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 md:px-6">
      <section className="grid items-center gap-12 pb-16 pt-14 md:pb-24 md:pt-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
        <div>
          <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.03em] md:text-5xl">
            Build Discord music bots in TypeScript.
          </h1>
          <p className="mt-5 max-w-md text-pretty text-lg leading-8 text-fd-muted-foreground">
            Queues, playback, filters, and music sources, without the audio plumbing.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href={getVersionBaseUrl(defaultVersionId)}
              className={`${buttonBase} bg-fd-foreground text-fd-background hover:opacity-90`}
            >
              Read the docs
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            {nextVersion ? (
              <Link
                href={`${getVersionBaseUrl(nextVersion.id)}${versionNotes[nextVersion.id].start.path}`}
                className={`${buttonBase} border bg-fd-background hover:bg-fd-accent`}
              >
                Try {nextVersion.name}
                {nextVersion.badge ? <VersionBadge badge={nextVersion.badge} /> : null}
              </Link>
            ) : null}
          </div>

          <DiscordInvite />
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border bg-fd-card shadow-sm">
          <Tabs defaultValue={defaultVersionId} className="!my-0 !rounded-none !border-0 !bg-transparent">
            <TabsList className="px-2">
              {versions.map((version) => (
                <TabsTrigger key={version.id} value={version.id} className="gap-2">
                  {version.name}
                  {version.badge ? <VersionBadge badge={version.badge} /> : null}
                </TabsTrigger>
              ))}
            </TabsList>
            {versions.map((version) => (
              <TabsContent key={version.id} value={version.id}>
                <ServerCodeBlock
                  lang={examples[version.id].lang}
                  code={examples[version.id].code}
                  codeblock={{ className: '!my-0 !rounded-none !border-0 !bg-transparent text-[0.8125rem]' }}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      <Section title="What it handles" description="The parts of a music bot you would otherwise write yourself.">
        <dl className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
          {capabilities.map(([name, text]) => (
            <div key={name}>
              <dt className="font-medium">{name}</dt>
              <dd className="mt-1.5 text-sm leading-6 text-fd-muted-foreground">{text}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Documentation" description="Choose the version you are building with.">
        <div className="divide-y rounded-xl border">
          {versions.map((version) => {
            const note = versionNotes[version.id];
            const apiPath = version.apiReference ? `/${version.apiReference}` : null;

            return (
              <div key={version.id} className="grid gap-5 p-6 md:grid-cols-[10rem_1fr]">
                <div>
                  <p className="flex items-center gap-2 text-lg font-semibold">
                    {version.name}
                    {version.badge ? <VersionBadge badge={version.badge} /> : null}
                  </p>
                  <p className="mt-1 text-sm text-fd-muted-foreground">
                    {version.description}
                    {version.id === defaultVersionId ? ' · default' : ''}
                  </p>
                </div>
                <div>
                  <ul className="list-disc space-y-1.5 ps-5 text-sm leading-6 text-fd-muted-foreground marker:text-fd-border">
                    {note.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
                    <Link
                      href={getVersionBaseUrl(version.id)}
                      className="inline-flex items-center gap-1 hover:text-fd-primary"
                    >
                      Documentation <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                    <Link
                      href={`${getVersionBaseUrl(version.id)}${note.start.path}`}
                      className="inline-flex items-center gap-1 hover:text-fd-primary"
                    >
                      {note.start.label} <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                    {apiPath ? (
                      <Link
                        href={`${getVersionBaseUrl(version.id)}${apiPath}`}
                        className="inline-flex items-center gap-1 hover:text-fd-primary"
                      >
                        API reference <ArrowRight className="size-3.5" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="sr-only">The default version is {defaultVersion.name}.</p>
      </Section>

      <Section
        title="Community"
        description={`${bots.length} open-source bots and ${extractors.length} extractors built by the community.`}
      >
        <div>
          <ul className="divide-y rounded-xl border">
            {featured.map((project) => (
              <li key={project.url}>
                <a
                  href={project.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start justify-between gap-6 p-4 transition-colors hover:bg-fd-accent/50"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{project.name}</p>
                    <p className="mt-0.5 line-clamp-1 text-sm text-fd-muted-foreground">{project.description}</p>
                  </div>
                  <ArrowUpRight
                    className="mt-1 size-4 shrink-0 text-fd-muted-foreground group-hover:text-fd-primary"
                    aria-hidden="true"
                  />
                </a>
              </li>
            ))}
          </ul>
          <Link
            href={communityRoute}
            className="mt-5 inline-flex items-center gap-1 text-sm font-medium hover:text-fd-primary"
          >
            Browse all projects <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </Section>

      <footer className="flex flex-col gap-4 border-t py-8 text-sm text-fd-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>MIT licensed. Built by Androz2091 and contributors.</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href={getVersionBaseUrl(defaultVersionId)} className="hover:text-fd-foreground">
            Docs
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
        </nav>
      </footer>
    </main>
  );
}
