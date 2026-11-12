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
  const featured = getDocsVersion(featuredVersionId);
  const versions = getDocsVersions();
  const stable = featuredVersionId === defaultVersionId ? null : getDocsVersion(defaultVersionId);
  const { extractors, bots } = communityResources;
  const community = [...bots.slice(0, 1), ...extractors.slice(0, 4)];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 md:px-6">
      <section className="grid items-center gap-12 pb-16 pt-14 md:pb-24 md:pt-24 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-16">
        <div>
          <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.03em] md:text-5xl">
            Build music bots on a Rust audio engine.
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-lg leading-8 text-fd-muted-foreground">
            Discord Player {featured.name} hands decoding and voice to Remedia. Run it inside your bot, or scale it out
            across machines together with your source plugins.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={`${getVersionBaseUrl(featured.id)}/getting-started`}
              className={`${buttonBase} bg-fd-foreground text-fd-background hover:opacity-90`}
            >
              Get started with {featured.name}
              {featured.badge ? <VersionBadge badge={featured.badge} /> : null}
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

          <dl className="mt-10 max-w-xl divide-y border-y text-sm">
            {[
              ['Rust engine', 'Decode, filter, and encode audio natively.'],
              ['Scales out', 'Add audio nodes without changing your commands.'],
              ['Distributed', 'Sources run as services too, with their own credentials.'],
            ].map(([term, text]) => (
              <div key={term} className="grid grid-cols-[7.5rem_1fr] gap-4 py-3">
                <dt className="font-medium">{term}</dt>
                <dd className="text-fd-muted-foreground">{text}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="min-w-0">
          <Topology />
          <DiscordInvite />
        </div>
      </section>

      <Section
        title="One API, from one process to many machines"
        description="Start embedded. Move audio and sources to other machines when you need to."
      >
        <div className="min-w-0">
          <div className="overflow-hidden rounded-xl border bg-fd-card">
            <Tabs defaultValue={setups[0].id} className="!my-0 !rounded-none !border-0 !bg-transparent">
              <TabsList className="px-2">
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
                    codeblock={{ className: '!my-0 !rounded-none !border-0 !bg-transparent text-[0.8125rem]' }}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </div>
          <p className="mt-4 text-sm leading-6 text-fd-muted-foreground">
            Queues, history, and events work the same either way. Plugins that return a local stream need an embedded
            node. See{' '}
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
      </Section>

      <Section
        title={`What ${featured.name} changes`}
        description="The engine and the deployment model. Not your commands."
      >
        <dl className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
          {reasons.map(([name, text]) => (
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
            const isFeatured = version.id === featured.id;
            const start = isFeatured ? { label: 'Getting started', path: '/getting-started' } : null;

            return (
              <div key={version.id} className="grid gap-4 p-6 md:grid-cols-[10rem_1fr]">
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
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium">
                  <Link
                    href={getVersionBaseUrl(version.id)}
                    className="inline-flex items-center gap-1 hover:text-fd-primary"
                  >
                    Documentation <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                  {start ? (
                    <Link
                      href={`${getVersionBaseUrl(version.id)}${start.path}`}
                      className="inline-flex items-center gap-1 hover:text-fd-primary"
                    >
                      {start.label} <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  ) : null}
                  {isFeatured ? (
                    <Link
                      href={`${getVersionBaseUrl(version.id)}/migration`}
                      className="inline-flex items-center gap-1 hover:text-fd-primary"
                    >
                      Migration guide <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  ) : null}
                  {version.apiReference ? (
                    <Link
                      href={`${getVersionBaseUrl(version.id)}/${version.apiReference}`}
                      className="inline-flex items-center gap-1 hover:text-fd-primary"
                    >
                      API reference <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        title="Community"
        description={`${bots.length} open-source bots and ${extractors.length} extractors built by the community.`}
      >
        <div>
          <ul className="divide-y rounded-xl border">
            {community.map((project) => (
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
