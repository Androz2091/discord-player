import { ArrowUpRight, Plus } from 'lucide-react';
import { CommunityList } from '@/components/community-list';
import { communityResources } from '@/data/community';
import { discordInviteUrl, gitConfig } from '@/lib/shared';

const dataFileUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/master/apps/website/src/data/community.ts`;

export default function CommunityPage() {
  const { extractors, bots } = communityResources;

  return (
    <div className="relative w-full flex-1 overflow-x-clip">
      {/* Full-width glow behind the page. It fades out completely before the filter bar. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,color-mix(in_oklab,var(--color-fd-primary)_20%,transparent),transparent)] dark:bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,color-mix(in_oklab,var(--color-fd-primary)_26%,transparent),transparent)]"
      />
      <main className="relative mx-auto w-full max-w-6xl px-4 pb-20 md:px-6">
        <header className="py-12 md:py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-fd-primary">Community</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">
            Built with Discord Player by the community
          </h1>
          <p className="mt-3 max-w-2xl text-base text-fd-muted-foreground md:text-lg">
            Open-source music bots and extractors you can learn from, fork, or plug into your own bot.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href={dataFileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-fd-primary px-5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 focus-visible:ring-offset-fd-background"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add your project
            </a>
            <a
              href={discordInviteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-full border bg-fd-card px-5 text-sm font-medium transition-colors hover:bg-fd-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              Join the Discord
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
          </div>

          <dl className="mt-8 flex gap-8">
            <div>
              <dt className="text-xs text-fd-muted-foreground">Extractors</dt>
              <dd className="text-2xl font-semibold">{extractors.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-fd-muted-foreground">Music bots</dt>
              <dd className="text-2xl font-semibold">{bots.length}</dd>
            </div>
          </dl>
        </header>

        <CommunityList extractors={extractors} bots={bots} />
      </main>
    </div>
  );
}
