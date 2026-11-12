import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'fumadocs-ui/components/tabs';
import { ServerCodeBlock } from 'fumadocs-ui/components/codeblock.rsc';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { DiscordInvite } from '@/components/discord-invite';
import { Topology } from '@/components/topology';
import { VersionBadge } from '@/components/version-badge';
import { communityResources } from '@/data/community';
import { communityRoute, discordInviteUrl, gitConfig } from '@/lib/shared';
import {
  defaultVersionId,
  getDocsVersion,
  getDocsVersions,
  getVersionBaseUrl,
  type DocsVersionId,
} from '@/lib/versions';

export const metadata = {
  title: { absolute: 'Discord Player | Music bots on a Rust audio engine' },
  description:
    'Discord Player manages queues, playback controls, and events for Discord music bots. v8 runs audio in Remedia, a Rust engine you can embed in your bot or scale out across machines.',
};

/** The hero presents this version. It is the one the page encourages visitors to try. */
const featuredVersionId = 'v8' satisfies DocsVersionId;

/** Setups shown in the "one API" section. */
const setups = [
  {
    id: 'embedded',
    label: 'Embedded',
    code: `import { Player } from 'discord-player';

const player = new Player({
  // Remedia runs inside your bot process.
  nodes: [{ id: 'local', type: 'embedded' }],
  plugins: [mySources()],
  send, // Your gateway callback
});`,
  },
  {
    id: 'distributed',
    label: 'Distributed',
    code: `import { Player, definePlugin } from 'discord-player';

const auth = { username: 'bot', password: process.env.REMEDIA_PASSWORD! };

// Search through a source host that runs your plugins and extractors.
const sources = definePlugin({
  id: 'example.sources',
  remoteHost: {
    hostId: 'sources-1',
    url: 'https://sources.example.com',
    token: process.env.SOURCE_TOKEN,
  },
});

const player = new Player({
  // Audio is decoded and sent to Discord by separate Remedia servers.
  nodes: [
    { id: 'audio-1', type: 'remote', url: 'remedias://audio-1.example.com', auth },
    { id: 'audio-2', type: 'remote', url: 'remedias://audio-2.example.com', auth },
  ],
  plugins: [sources()],
  send, // Your gateway callback
});`,
  },
] as const;

const reasons = [
  [
    'A native audio engine',
    'Decoding, filters, volume, Opus encoding, and encrypted voice transport run in Remedia, which is written in Rust. Your JavaScript handles queues and commands.',
  ],
  [
    'Scale by adding nodes',
    'Run remedia-server on more machines. Each guild is placed on the node with the most spare capacity and stays there. On a remote node, decoding happens in another process, away from your bot.',
  ],
  [
    'Services all the way down',
    'Source plugins and extractors can run as their own service. The audio node pulls media straight from them, so provider code and credentials stay off your bot.',
  ],
  [
    'The API you already know',
    'Players, queues, history, repeat, shuffle, filters, crossfade, and events keep their v7 names. Supported v7 extractors keep working through an adapter.',
  ],
] as const;

const versionNotes: Record<DocsVersionId, { points: string[]; start: { label: string; path: string } }> = {
  v7: {
    points: [
      'Audio through discord-voip and FFmpeg.',
      'Ready-made extractors in @discord-player/extractor.',
      'API reference for every package.',
    ],
    start: { label: 'Build a music bot', path: '/creating-a-music-bot/01_integrating' },
  },
  v8: {
    points: [
      'Remedia, a Rust audio engine, embedded or on separate servers.',
      'Source plugins that can run as services. Your v7 extractors keep working.',
      'Your Discord library keeps the gateway connection.',
    ],
    start: { label: 'Getting started', path: '/getting-started' },
  },
};

const buttonBase =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[0.9375rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 focus-visible:ring-offset-fd-background';

const pills = [
  ['Rust engine', 'bg-fd-primary'],
  ['Scales out', 'bg-emerald-500'],
  ['Sources as services', 'bg-teal-500'],
] as const;

function Heading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-balance text-3xl font-semibold tracking-[-0.03em] md:text-4xl">{title}</h2>
      {description ? (
        <p className="mt-4 text-pretty text-lg leading-8 text-fd-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export default function HomePage() {
  const featured = getDocsVersion(featuredVersionId);
  const versions = getDocsVersions();
  const stable = featuredVersionId === defaultVersionId ? null : getDocsVersion(defaultVersionId);
  const { extractors, bots } = communityResources;
  const community = [...bots.slice(0, 1), ...extractors.slice(0, 3)];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 md:px-6">
      <section className="grid items-center gap-14 pb-24 pt-12 md:pt-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
        <div>
          <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.045em] md:text-6xl xl:text-7xl">
            Build music bots on a <span className="text-fd-primary">Rust</span> audio engine.
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-fd-muted-foreground md:text-xl md:leading-9">
            Discord Player {featured.name} hands decoding and voice to Remedia. Run it inside your bot, or scale it out
            across machines together with your source plugins.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href={`${getVersionBaseUrl(featured.id)}/getting-started`}
              className={`${buttonBase} bg-fd-primary text-fd-primary-foreground hover:opacity-90`}
            >
              Get started with {featured.name}
              {featured.badge ? (
                <span className="rounded-full bg-black/15 px-2 py-0.5 text-xs font-semibold">
                  {featured.badge.text}
                </span>
              ) : null}
            </Link>
            {stable ? (
              <Link
                href={getVersionBaseUrl(stable.id)}
                className={`${buttonBase} border bg-fd-background hover:bg-fd-accent`}
              >
                {stable.name} docs
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            ) : null}
          </div>

          <ul className="mt-8 flex flex-wrap gap-2">
            {pills.map(([label, dot]) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full border bg-fd-card px-3.5 py-1.5 text-sm font-medium"
              >
                <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />
                {label}
              </li>
            ))}
          </ul>

          <DiscordInvite />
        </div>

        <div className="min-w-0 rounded-3xl border bg-fd-card p-3 sm:p-6 md:p-8">
          <Topology />
        </div>
      </section>

      <section className="py-14 md:py-20">
        <Heading
          title="One API, from one process to many machines"
          description="Start embedded. Move audio and sources to other machines when you need to."
        />

        <div className="mt-10 max-w-4xl">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117] text-zinc-100 shadow-xl [--color-fd-border:#ffffff1a] [--color-fd-card:#0d1117] [--color-fd-foreground:#fafafa] [--color-fd-muted-foreground:#a1a1aa] [--color-fd-primary:#b794f6]">
            <Tabs defaultValue={setups[0].id} className="!my-0 !rounded-none !border-0 !bg-transparent">
              <TabsList className="px-3">
                {setups.map((setup) => (
                  <TabsTrigger key={setup.id} value={setup.id}>
                    {setup.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {setups.map((setup) => (
                <TabsContent key={setup.id} value={setup.id}>
                  <ServerCodeBlock
                    lang="ts"
                    code={setup.code}
                    themes={{ light: 'github-dark', dark: 'github-dark' }}
                    codeblock={{
                      className: '!my-0 !rounded-none !border-0 !bg-transparent text-[0.8125rem] md:text-sm',
                    }}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </div>
          <p className="mt-5 text-[0.9375rem] leading-7 text-fd-muted-foreground">
            Queues, history, and events work the same either way. Plugins that return a local stream need an embedded
            node. Read about{' '}
            <Link
              href={`${getVersionBaseUrl(featured.id)}/remedia/remote`}
              className="font-medium text-fd-foreground underline underline-offset-4"
            >
              remote playback
            </Link>{' '}
            and{' '}
            <Link
              href={`${getVersionBaseUrl(featured.id)}/plugins/remote-hosts`}
              className="font-medium text-fd-foreground underline underline-offset-4"
            >
              remote source hosts
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <Heading
          title={`What ${featured.name} changes`}
          description="The engine and the deployment model. Not your commands."
        />

        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border bg-fd-border sm:grid-cols-2">
          {reasons.map(([name, text]) => (
            <div key={name} className="bg-fd-background p-8 md:p-10">
              <h3 className="text-2xl font-semibold tracking-tight">{name}</h3>
              <p className="mt-3 leading-7 text-fd-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-14 md:py-20">
        <Heading title="Documentation" description="Choose the version you are building with." />

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {versions.map((version) => {
            const note = versionNotes[version.id];
            const isFeatured = version.id === featured.id;

            return (
              <div
                key={version.id}
                className={`flex flex-col rounded-2xl border p-8 ${isFeatured ? 'border-fd-primary/50 bg-fd-card ring-1 ring-fd-primary/20' : 'bg-fd-background'}`}
              >
                <p className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
                  {version.name}
                  {version.badge ? <VersionBadge badge={version.badge} className="text-xs" /> : null}
                </p>
                <p className="mt-1 text-sm text-fd-muted-foreground">
                  {version.description}
                  {version.id === defaultVersionId ? ' · default' : ''}
                </p>

                <ul className="mt-6 list-disc space-y-2 ps-5 leading-7 text-fd-muted-foreground marker:text-fd-border">
                  {note.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>

                <div className="mt-auto flex flex-wrap gap-x-6 gap-y-2 pt-8 text-sm font-medium">
                  <Link
                    href={`${getVersionBaseUrl(version.id)}${note.start.path}`}
                    className="inline-flex items-center gap-1.5 text-fd-primary hover:underline"
                  >
                    {note.start.label} <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                  <Link
                    href={getVersionBaseUrl(version.id)}
                    className="inline-flex items-center gap-1.5 hover:text-fd-primary"
                  >
                    Documentation
                  </Link>
                  {isFeatured ? (
                    <Link
                      href={`${getVersionBaseUrl(version.id)}/migration`}
                      className="inline-flex items-center gap-1.5 hover:text-fd-primary"
                    >
                      Migration guide
                    </Link>
                  ) : null}
                  {version.apiReference ? (
                    <Link
                      href={`${getVersionBaseUrl(version.id)}/${version.apiReference}`}
                      className="inline-flex items-center gap-1.5 hover:text-fd-primary"
                    >
                      API reference
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="py-14 md:py-20">
        <Heading
          title="Built by the community"
          description={`${bots.length} open-source bots and ${extractors.length} extractors you can learn from or plug into your own bot.`}
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {community.map((project) => (
            <a
              key={project.url}
              href={project.url}
              target="_blank"
              rel="noreferrer"
              className="group flex flex-col rounded-2xl border bg-fd-card p-6 transition-colors hover:border-fd-primary/50"
            >
              <span className="flex items-start justify-between gap-4">
                <span className="text-lg font-semibold tracking-tight">{project.name}</span>
                <ArrowUpRight
                  className="mt-1 size-4 shrink-0 text-fd-muted-foreground group-hover:text-fd-primary"
                  aria-hidden="true"
                />
              </span>
              <span className="mt-2 line-clamp-2 leading-7 text-fd-muted-foreground">{project.description}</span>
            </a>
          ))}
        </div>
        <Link
          href={communityRoute}
          className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-fd-primary hover:underline"
        >
          Browse all projects <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>

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
