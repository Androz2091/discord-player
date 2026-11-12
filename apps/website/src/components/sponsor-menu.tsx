'use client';

import { Heart } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from 'fumadocs-ui/components/ui/popover';
import type { FundingLink } from '@/lib/funding';

/**
 * Navigation entry that lists where to sponsor the project.
 *
 * @param links Funding pages, read from the repository's funding file.
 * @param icon Whether to show a heart next to the label.
 */
export function SponsorMenu({ links, icon = false }: { links: FundingLink[]; icon?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1.5 rounded-lg p-2 text-sm text-fd-muted-foreground transition-colors hover:text-fd-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring">
        {icon ? <Heart className="size-3.5" aria-hidden="true" /> : null}
        Sponsor
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-56 flex-col gap-0.5 p-1.5">
        {links.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-md px-2 py-2 text-sm transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
          >
            {link.label}
          </a>
        ))}
      </PopoverContent>
    </Popover>
  );
}
