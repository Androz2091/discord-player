'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from 'fumadocs-ui/components/ui/popover';
import {
  getDocsVersion,
  getDocsVersions,
  getEquivalentVersionUrl,
  parseDocsPath,
  type DocsVersionId,
  type VersionPageIndex,
} from '@/lib/versions';
import { cn } from '@/lib/cn';
import { VersionBadge } from './version-badge';

/**
 * Dropdown for switching documentation versions.
 *
 * Switching keeps the current page when the other version has it, falls back to the closest parent section,
 * and finally to the version root.
 *
 * @param current Version of the documentation being viewed.
 * @param pageIndex Page lists of the other versions, used to find the equivalent page.
 */
export function VersionSelector({ current, pageIndex }: { current: DocsVersionId; pageIndex: VersionPageIndex }) {
  const pathname = usePathname();
  const { slugs } = parseDocsPath(pathname);
  const selected = getDocsVersion(current);

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Documentation version: ${selected.name}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-fd-secondary/50 px-2.5 text-sm font-medium transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
      >
        {selected.name}
        {selected.badge ? <VersionBadge badge={selected.badge} /> : null}
        <ChevronsUpDown className="size-3.5 text-fd-muted-foreground" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-64 flex-col gap-0.5 p-1.5">
        <p className="px-2 pb-1 pt-1.5 text-xs font-medium text-fd-muted-foreground">Documentation version</p>
        {getDocsVersions().map((version) => (
          <PopoverClose
            key={version.id}
            render={
              <Link
                href={version.id === current ? pathname : getEquivalentVersionUrl(version.id, slugs, pageIndex)}
                aria-current={version.id === current ? 'true' : undefined}
              />
            }
            className={cn(
              'flex items-start gap-2 rounded-md px-2 py-2 text-start text-sm transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground',
              version.id === current && 'bg-fd-accent/50',
            )}
          >
            <Check
              className={cn('mt-0.5 size-4 shrink-0 text-fd-primary', version.id !== current && 'invisible')}
              aria-hidden="true"
            />
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5 font-medium">
                {version.name}
                {version.badge ? <VersionBadge badge={version.badge} /> : null}
              </span>
              <span className="text-xs text-fd-muted-foreground">{version.description}</span>
            </span>
          </PopoverClose>
        ))}
      </PopoverContent>
    </Popover>
  );
}
