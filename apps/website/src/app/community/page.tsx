import { Info, Plus } from 'lucide-react';
import { Callout } from 'fumadocs-ui/components/callout';
import { CommunityList } from '@/components/community-list';
import { DiscordInvite } from '@/components/discord-invite';
import { communityResources } from '@/data/community';
import { gitConfig } from '@/lib/shared';

const dataFileUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/master/apps/website/src/data/community.ts`;
const listingGuidelinesUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/master/COMMUNITY_LISTING.md`;

export default function CommunityPage() {
  return (
    <div className="relative w-full flex-1 overflow-x-clip">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,color-mix(in_oklab,var(--color-fd-primary)_20%,transparent),transparent)] dark:bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,color-mix(in_oklab,var(--color-fd-primary)_26%,transparent),transparent)]"
      />
      <main className="relative mx-auto w-full max-w-6xl px-4 pb-12 md:px-6">
        <header className="grid items-center gap-x-10 pb-7 pt-8 md:pb-8 md:pt-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-fd-primary">Community</p>
            <h1 className="mt-2 max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
              Built with Discord Player by the community
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-fd-muted-foreground">
              Open-source music bots and extractors you can learn from, fork, or plug into your own bot.
            </p>
            <a
              href={dataFileUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-fd-primary px-4 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 focus-visible:ring-offset-fd-background"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add your project
            </a>
            <p className="mt-3 flex max-w-md items-start gap-2 text-xs leading-5 text-fd-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                By adding your project to this list, you agree to our{' '}
                <a
                  href={listingGuidelinesUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-fd-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
                >
                  community listing guidelines
                </a>
                .
              </span>
            </p>
          </div>
          <DiscordInvite />
        </header>

        <Callout type="info" className="!mb-5 !mt-0 text-xs leading-5">
          <p>
            <strong className="font-medium text-fd-foreground">Third-party resources.</strong> These independently
            developed and maintained resources are listed for discovery only and are not officially endorsed,
            maintained, or supported by Discord Player unless explicitly stated. Discord Player does not guarantee
            functionality, security, compatibility, or compliance with third-party Terms of Service or applicable laws.
            You are responsible for reviewing and evaluating resources before integrating them. See the{' '}
            <a
              href={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/master/LEGAL.md`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-fd-primary underline underline-offset-2"
            >
              Legal Notice
            </a>
            .
          </p>
        </Callout>

        <CommunityList resources={communityResources} contributionUrl={dataFileUrl} />
      </main>
    </div>
  );
}
