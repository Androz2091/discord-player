import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ServerCodeBlock } from 'fumadocs-ui/components/codeblock.rsc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'fumadocs-ui/components/tabs';
import { DiscordInvite } from '@/components/discord-invite';
import { VersionBadge } from '@/components/version-badge';
import { communityResources } from '@/data/community';
import { getProjectSource } from '@/lib/project-source';
import { communityRoute, discordInviteUrl, gitConfig } from '@/lib/shared';
import {
  defaultVersionId,
  getDefaultDocsVersion,
  getDocsVersion,
  getDocsVersions,
  getVersionBaseUrl,
  type DocsVersionId,
} from '@/lib/versions';

export const metadata = {
  title: { absolute: 'Discord Player | Build Discord music bots in TypeScript' },
  description:
    'Discord Player manages queues, playback controls, and events for Discord music bots, and lets you plug in the audio sources you need.',
};

const remediaUrl = 'https://github.com/twlite/remedia';

/** The version the "What's new" section describes. Its name and badge still come from the version configuration. */
const newestVersionId = 'v8' satisfies DocsVersionId;

/** A working bot setup for each documentation version. Adding a version in `versions.ts` requires adding one here. */
const examples: Record<DocsVersionId, { code: string; note?: string }> = {
  v7: {
    code: `import { Client, GatewayIntentBits } from 'discord.js';
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
const { track } = await player.play(voiceChannel, query, {
  nodeOptions: { metadata: interaction.channel },
});
`,
  },
  v8: {
    code: `import { Client, Events, GatewayIntentBits } from 'discord.js';
import { Player } from 'discord-player';
import { directMedia } from './direct-media.ts';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const player = new Player({
  plugins: [directMedia()],
  send(guildId, payload) {
    const guild = client.guilds.cache.get(guildId);

    if (!guild) throw new Error(\`Unknown guild \${guildId}\`);

    return guild.shard.send(payload);
  },
});

client.on(Events.Raw, (packet) => player.receive(packet));

client.once(Events.ClientReady, async (ready) => {
  await player.initialize(ready.user.id);
});

// Inside your /play command
const { track } = await player.play(voiceChannel, url, {
  nodeOptions: { metadata: interaction.channel },
});
`,
    note: 'directMedia is the source plugin built in the tutorial.',
  },
};

/** Works in both v7 and v8. */
const coreExample = `import { QueueRepeatMode, type Track } from 'discord-player';

async function manage(guildId: string, track: Track) {
  const queue = player.nodes.get(guildId);

  if (!queue) return; // Nothing has been played in this guild yet

  // Queue
  queue.addTrack(track);
  queue.moveTrack(track, 0);
  queue.setRepeatMode(QueueRepeatMode.QUEUE);

  // Playback
  await queue.node.pause();
  await queue.node.seek(30_000);
  await queue.node.setVolume(70);
  await queue.node.skip();
}

// Events
player.events.on('playerStart', (queue, track) => {
  const channel = queue.metadata as { send(content: string): unknown };

  channel.send(\`Now playing **\${track.title}**\`);
});

player.events.on('playerError', (queue, error) => {
  console.error('Playback failed:', error);
});
`;

const coreNotes = [
  [
    'Queue',
    'addTrack, moveTrack, and setRepeatMode change what plays next. History, shuffle, and filters live on the same queue.',
  ],
  ['Playback', 'Pause, resume, seek, volume, and skip are on queue.node.'],
  [
    'Events',
    'player.events emits queue events such as playerStart, playerFinish, playerError, and emptyQueue. The queue is always the first argument.',
  ],
] as const;

const runtimes = [
  {
    title: 'Embedded',
    text: 'Remedia runs inside your bot process.',
    code: `const player = new Player({
  nodes: [{ id: 'local', type: 'embedded' }],
  plugins: [directMedia()],
  send,
});`,
  },
  {
    title: 'Remote',
    text: 'Remedia runs in remedia-server, on another machine if you like.',
    code: `const player = new Player({
  nodes: [
    {
      id: 'audio-1',
      type: 'remote',
      url: 'remedias://audio.example.com',
      auth: {
        username: 'bot',
        password: process.env.REMEDIA_PASSWORD!,
      },
    },
  ],
  plugins: [directMedia()],
  send,
});`,
  },
] as const;

const linkClass =
  'font-medium underline decoration-fd-border underline-offset-4 transition-colors hover:decoration-fd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring';

function Section({
  title,
  description,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-x-12 gap-y-6 border-t py-10 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:py-12 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
      <div>
        <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">{title}</h2>
        {description ? (
          <div className="mt-2 text-[0.9375rem] leading-7 text-fd-muted-foreground">{description}</div>
        ) : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function CodePanel({ code }: { code: string }) {
  return <ServerCodeBlock lang="ts" code={code} codeblock={{ className: '!my-0 min-w-0 text-[0.8125rem]' }} />;
}

function ProjectList({
  title,
  projects,
}: {
  title: string;
  projects: { name: string; description: string; url: string }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-3 divide-y border-y">
        {projects.map((project) => (
          <li key={project.url}>
            <a
              href={project.url}
              target="_blank"
              rel="noreferrer"
              className="group block py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              <span className="flex items-baseline justify-between gap-4">
                <span className="font-medium group-hover:underline group-hover:underline-offset-4">{project.name}</span>
                <span className="hidden shrink-0 font-mono text-xs text-fd-muted-foreground sm:block">
                  {getProjectSource(project.url).identifier.split('/')[0]}
                </span>
              </span>
              <span className="mt-0.5 line-clamp-2 block text-sm leading-6 text-fd-muted-foreground">
                {project.description}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HomePage() {
  const defaultVersion = getDefaultDocsVersion();
  const versions = getDocsVersions();
  const newest = getDocsVersion(newestVersionId);
  const { extractors, bots } = communityResources;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 md:px-6">
      <section className="grid items-start gap-10 pb-12 pt-10 md:pb-14 md:pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14">
        <div>
          <h1 className="text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.035em] md:text-5xl">
            Build Discord music bots in TypeScript.
          </h1>
          <p className="mt-5 max-w-md text-pretty text-lg leading-8 text-fd-muted-foreground">
            Discord Player gives you queues, playback controls, events, and a plugin system for audio sources, so a play
            command is a few lines of code.
          </p>

          <Link
            href={`${getVersionBaseUrl(defaultVersion.id)}${defaultVersion.startPath ?? ''}`}
            className="mt-7 inline-flex h-11 items-center gap-2 rounded-md bg-fd-foreground px-5 text-sm font-medium text-fd-background transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 focus-visible:ring-offset-fd-background"
          >
            Get started
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>

          <DiscordInvite />
        </div>

        <div className="min-w-0">
          <Tabs defaultValue={defaultVersionId} className="!my-0 !rounded-none !border-0 !bg-transparent">
            <TabsList className="!bg-transparent px-1">
              {versions.map((version) => (
                <TabsTrigger key={version.id} value={version.id} className="gap-2">
                  {version.name}
                  {version.badge ? <VersionBadge badge={version.badge} /> : null}
                </TabsTrigger>
              ))}
            </TabsList>
            {versions.map((version) => (
              <TabsContent key={version.id} value={version.id}>
                <CodePanel code={examples[version.id].code} />
                <p className="mt-3 px-1 text-xs text-fd-muted-foreground">
                  {version.name} is the {version.description.toLowerCase()}. {examples[version.id].note}
                </p>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      <Section title="Queues, playback, and events" description="The same calls work in v7 and v8.">
        <dl className="grid gap-5 text-[0.9375rem] leading-7 sm:grid-cols-3 sm:gap-8">
          {coreNotes.map(([term, text]) => (
            <div key={term}>
              <dt className="font-semibold">{term}</dt>
              <dd className="text-fd-muted-foreground">{text}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8">
          <CodePanel code={coreExample} />
        </div>
      </Section>

      <Section
        title={
          <>
            What&apos;s new in {newest.name}
            {newest.badge ? <VersionBadge badge={newest.badge} /> : null}
          </>
        }
        description={
          <>
            <p>
              {newest.name} plays audio through{' '}
              <a href={remediaUrl} target="_blank" rel="noreferrer" className={`${linkClass} text-fd-foreground`}>
                Remedia
              </a>
              , a native engine that decodes audio and sends it to Discord voice. Your queues, events, and commands keep
              the same shape.
            </p>
            <p className="mt-3">You choose where Remedia runs.</p>
          </>
        }
      >
        <div className="space-y-8">
          {runtimes.map((runtime) => (
            <div key={runtime.title} className="min-w-0">
              <h3 className="text-sm font-semibold">{runtime.title}</h3>
              <p className="mb-3 mt-1 text-sm text-fd-muted-foreground">{runtime.text}</p>
              <CodePanel code={runtime.code} />
            </div>
          ))}
        </div>
        <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href={`${getVersionBaseUrl(newest.id)}/migration`} className={linkClass}>
            Migration guide
          </Link>
          <Link href={`${getVersionBaseUrl(newest.id)}/remedia/remote`} className={linkClass}>
            Remote playback
          </Link>
          <Link href={`${getVersionBaseUrl(newest.id)}/plugins/remote-hosts`} className={linkClass}>
            Remote source hosts
          </Link>
        </p>
      </Section>

      <Section
        title="Community"
        description={`${bots.length} open-source bots and ${extractors.length} extractors, built by the community.`}
      >
        <div className="grid gap-8 md:grid-cols-2">
          <ProjectList title="Music bots" projects={bots.slice(0, 3)} />
          <ProjectList title="Extractors" projects={extractors.slice(0, 3)} />
        </div>
        <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href={communityRoute} className={linkClass}>
            Browse all projects
          </Link>
          <a href={discordInviteUrl} target="_blank" rel="noreferrer" className={linkClass}>
            Ask in the Discord server
          </a>
        </p>
      </Section>

      <Section title="Documentation">
        <ul className="divide-y border-y">
          {versions.map((version) => (
            <li
              key={version.id}
              className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            >
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex items-center gap-2 font-semibold">
                  {version.name}
                  {version.badge ? <VersionBadge badge={version.badge} /> : null}
                </span>
                <span className="text-sm text-fd-muted-foreground">
                  {version.description}
                  {version.id === defaultVersionId ? ', default' : ''}
                </span>
              </p>
              <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <Link href={getVersionBaseUrl(version.id)} className={linkClass}>
                  Documentation
                </Link>
                {version.startPath ? (
                  <Link href={`${getVersionBaseUrl(version.id)}${version.startPath}`} className={linkClass}>
                    Get started
                  </Link>
                ) : null}
                {version.apiReference ? (
                  <Link href={`${getVersionBaseUrl(version.id)}/${version.apiReference}`} className={linkClass}>
                    API reference
                  </Link>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <footer className="flex flex-col gap-3 border-t py-8 text-sm text-fd-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>MIT licensed. Built by Androz2091 and contributors.</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href={getVersionBaseUrl(defaultVersionId)} className="hover:text-fd-foreground">
            Documentation
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
