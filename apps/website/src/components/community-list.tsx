'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Bot, Package, Search, Star, X } from 'lucide-react';
import type { IExtractorShowcase, IMusicBotShowcase } from '@/data/community';
import { cn } from '@/lib/cn';

type Kind = 'all' | 'extractors' | 'bots';

interface Entry {
  name: string;
  description: string;
  url: string;
  kind: 'extractors' | 'bots';
  version?: string;
}

const kindFilters: { id: Kind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'extractors', label: 'Extractors' },
  { id: 'bots', label: 'Music bots' },
];

const avatarTones = [
  'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  'bg-teal-500/15 text-teal-700 dark:text-teal-300',
];

function toneFor(name: string) {
  let hash = 0;

  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;

  return avatarTones[hash % avatarTones.length];
}

function initialsFor(name: string) {
  const letters = name.replace(/^discord-player[-_ ]?/i, '').replace(/[^a-z0-9]/gi, '');

  return (letters || name).slice(0, 2).toUpperCase();
}

/** Where a project lives, derived from its URL. Fields are only set when the URL exposes them. */
interface ProjectSource {
  /** Hosting platform, such as `GitHub` or `npm`. */
  platform: string;

  /** Repository or package identifier shown on the card, such as `owner/repo` or `package-name`. */
  identifier: string;

  /** Repository owner. Only available for GitHub URLs. */
  author?: string;
}

function parseSource(url: string): ProjectSource {
  const { hostname, pathname } = new URL(url);
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);

  if (hostname === 'github.com' && segments.length >= 2) {
    const [author, repo] = segments;
    const cleanRepo = repo!.replace(/\.git$/, '').replace(/\.+$/, '');

    return { platform: 'GitHub', identifier: `${author}/${cleanRepo}`, author };
  }

  if (hostname === 'npm.im' || hostname.endsWith('npmjs.com')) {
    const parts = hostname === 'npm.im' ? segments : segments[0] === 'package' ? segments.slice(1) : segments;
    const name = parts[0]?.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];

    if (name) return { platform: 'npm', identifier: name };
  }

  return { platform: hostname.replace(/^www\./, ''), identifier: hostname.replace(/^www\./, '') + pathname };
}

/** Groups bot versions by major version, for example `v7.2.0` becomes `v7`. */
function majorOf(version: string) {
  return /^v\d+/.exec(version)?.[0] ?? version;
}

function matches(query: string, entry: Entry) {
  const term = query.trim().toLowerCase();

  return term === '' || entry.name.toLowerCase().includes(term) || entry.description.toLowerCase().includes(term);
}

function ProjectCard({ entry }: { entry: Entry }) {
  const featured = entry.version === 'Promoted';
  const source = parseSource(entry.url);

  return (
    <a
      href={entry.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border bg-fd-card p-4 transition-all',
        'hover:-translate-y-0.5 hover:border-fd-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring',
        featured && 'border-fd-primary/40 bg-fd-primary/5',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold',
            toneFor(entry.name),
          )}
        >
          {initialsFor(entry.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold leading-6">{entry.name}</h3>
          <p className="flex items-center gap-1 truncate text-xs text-fd-muted-foreground">
            {entry.kind === 'extractors' ? (
              <Package className="size-3 shrink-0" aria-hidden="true" />
            ) : (
              <Bot className="size-3 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">
              {entry.kind === 'extractors' ? 'Extractor' : 'Music bot'}
              {source.author ? ` · by ${source.author}` : ''}
            </span>
          </p>
        </div>
        <ArrowUpRight
          className="size-4 shrink-0 text-fd-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-fd-primary"
          aria-hidden="true"
        />
      </div>

      <p className="line-clamp-3 text-sm leading-6 text-fd-muted-foreground">{entry.description}</p>

      <div className="mt-auto flex flex-col gap-2 pt-1">
        <p
          className="flex min-w-0 items-baseline gap-2 rounded-md border bg-fd-muted/60 px-2 py-1 text-xs"
          title={`${source.platform}: ${source.identifier}`}
        >
          <span className="shrink-0 font-medium text-fd-foreground">{source.platform}</span>
          <span className="min-w-0 break-all font-mono text-fd-muted-foreground">{source.identifier}</span>
        </p>

        {entry.version ? (
          featured ? (
            <span className="inline-flex w-fit items-center gap-1 rounded-full border border-fd-primary/30 bg-fd-primary/10 px-2 py-0.5 text-xs font-medium text-fd-primary">
              <Star className="size-3 fill-current" aria-hidden="true" />
              Maintainer pick
            </span>
          ) : (
            <span className="inline-flex w-fit rounded-full border bg-fd-muted px-2 py-0.5 text-xs font-medium text-fd-muted-foreground">
              Discord Player {entry.version}
            </span>
          )
        ) : null}
      </div>
    </a>
  );
}

function ProjectGrid({ title, id, entries }: { title: string; id: string; entries: Entry[] }) {
  if (entries.length === 0) return null;

  return (
    <section aria-labelledby={id} className="mt-10 first:mt-0">
      <h2 id={id} className="mb-4 flex items-baseline gap-2 text-lg font-semibold">
        {title}
        <span className="text-sm font-normal text-fd-muted-foreground">{entries.length}</span>
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <ProjectCard key={entry.url} entry={entry} />
        ))}
      </div>
    </section>
  );
}

/**
 * Searchable, filterable listing of community extractors and music bots.
 *
 * @param extractors Extractors and source plugins to list.
 * @param bots Open-source music bots to list.
 */
export function CommunityList({ extractors, bots }: { extractors: IExtractorShowcase[]; bots: IMusicBotShowcase[] }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const [version, setVersion] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const extractorEntries = useMemo<Entry[]>(
    () => extractors.map((extractor) => ({ ...extractor, kind: 'extractors' })),
    [extractors],
  );
  const botEntries = useMemo<Entry[]>(() => bots.map((bot) => ({ ...bot, kind: 'bots' })), [bots]);

  const majors = useMemo(() => {
    const unique = new Set(
      botEntries.map((bot) => majorOf(bot.version ?? '')).filter((major) => major.startsWith('v')),
    );

    return [...unique].sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)));
  }, [botEntries]);

  const visibleExtractors = useMemo(
    () => (kind === 'bots' ? [] : extractorEntries.filter((entry) => matches(query, entry))),
    [extractorEntries, kind, query],
  );
  const visibleBots = useMemo(
    () =>
      kind === 'extractors'
        ? []
        : botEntries.filter(
            (entry) =>
              matches(query, entry) &&
              (version === null || entry.version === 'Promoted' || majorOf(entry.version ?? '') === version),
          ),
    [botEntries, kind, query, version],
  );

  const total = visibleExtractors.length + visibleBots.length;
  const counts: Record<Kind, number> = {
    all: extractorEntries.length + botEntries.length,
    extractors: extractorEntries.length,
    bots: botEntries.length,
  };

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }

    window.addEventListener('keydown', focusSearch);

    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  function reset() {
    setQuery('');
    setKind('all');
    setVersion(null);
  }

  return (
    <>
      <div className="z-10 -mx-4 border-b md:sticky md:top-14 bg-fd-background/85 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fd-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              type="text"
              inputMode="search"
              aria-label="Search community projects"
              placeholder="Search projects"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 w-full rounded-lg border bg-fd-card ps-9 pe-16 text-sm placeholder:text-fd-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                className="absolute end-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute end-2.5 top-1/2 hidden -translate-y-1/2 rounded border bg-fd-muted px-1.5 text-[0.6875rem] text-fd-muted-foreground md:block">
                /
              </kbd>
            )}
          </div>

          <div
            className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0"
            role="group"
            aria-label="Project type"
          >
            {kindFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                aria-pressed={kind === filter.id}
                onClick={() => setKind(filter.id)}
                className={cn(
                  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
                  kind === filter.id
                    ? 'border-fd-primary bg-fd-primary text-fd-primary-foreground'
                    : 'bg-fd-card text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground',
                )}
              >
                {filter.label}
                <span className={cn('text-xs', kind === filter.id ? 'opacity-80' : 'opacity-70')}>
                  {counts[filter.id]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {kind !== 'extractors' && majors.length > 0 ? (
          <div className="mt-3 flex items-center gap-2 overflow-x-auto" role="group" aria-label="Bot version">
            <span className="shrink-0 text-xs font-medium text-fd-muted-foreground">Built with</span>
            {[null, ...majors].map((major) => (
              <button
                key={major ?? 'any'}
                type="button"
                aria-pressed={version === major}
                onClick={() => setVersion(major)}
                className={cn(
                  'h-7 shrink-0 rounded-md border px-2.5 text-xs font-medium transition-colors',
                  version === major
                    ? 'border-fd-primary/50 bg-fd-primary/10 text-fd-primary'
                    : 'text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground',
                )}
              >
                {major ? `Discord Player ${major}` : 'Any version'}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="py-8" aria-live="polite">
        {total === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <Search className="size-8 text-fd-muted-foreground" aria-hidden="true" />
            <p className="font-medium">No projects match your filters</p>
            <p className="max-w-sm text-sm text-fd-muted-foreground">
              Try a different search term, or build and list your own project.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-1 h-9 rounded-full border bg-fd-card px-4 text-sm font-medium hover:bg-fd-accent"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <>
            <ProjectGrid id="community-extractors" title="Extractors" entries={visibleExtractors} />
            <ProjectGrid id="community-bots" title="Music bots" entries={visibleBots} />
          </>
        )}
      </div>
    </>
  );
}
