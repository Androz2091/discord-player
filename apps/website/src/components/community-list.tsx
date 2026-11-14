'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Bot, Package, Puzzle, Search, Star, X } from 'lucide-react';
import { Tabs } from 'fumadocs-ui/components/ui/tabs';
import { TabsContent, TabsList, TabsTrigger } from 'fumadocs-ui/components/tabs';
import type { IShowcase, ICommunityResource } from '@/data/community';
import { cn } from '@/lib/cn';
import { getProjectSource } from '@/lib/project-source';

type Kind = keyof IShowcase;

interface Entry extends ICommunityResource {
  kind: Kind;
  repositoryUrl?: string;
  npmUrl?: string;
  websiteUrl?: string;
  version?: string;
}

const kindFilters: { id: Kind; label: string }[] = [
  { id: 'extractors', label: 'Extractors' },
  { id: 'bots', label: 'Music bots' },
  { id: 'plugins', label: 'Plugins' },
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

/** Groups bot versions by major version, for example `v7.2.0` becomes `v7`. */
function majorOf(version: string) {
  return /^v\d+/.exec(version)?.[0] ?? version;
}

function matches(query: string, entry: Entry) {
  const term = query.trim().toLowerCase();

  return [entry.name, entry.description, entry.author, entry.repositoryUrl, entry.npmUrl, entry.websiteUrl].some(
    (value) => value?.toLowerCase().includes(term),
  );
}

function ProjectAvatar({ entry, imageUrl }: { entry: Entry; imageUrl: string | null }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const src = imageUrl === failedSource ? null : imageUrl;

  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg text-sm font-semibold',
        toneFor(entry.name),
      )}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          width={40}
          height={40}
          className="size-10 object-cover"
          onError={() => setFailedSource(src)}
        />
      ) : (
        initialsFor(entry.name)
      )}
    </span>
  );
}

function ProjectCard({ entry }: { entry: Entry }) {
  const source = entry.repositoryUrl ? getProjectSource(entry.repositoryUrl) : undefined;
  const author = entry.author ?? source?.author;
  const actions = [
    { label: 'Repository', href: entry.repositoryUrl },
    { label: 'npm', href: entry.npmUrl },
    { label: 'Website', href: entry.websiteUrl },
  ].filter((action) => action.href);

  return (
    <article
      className={cn(
        'flex h-full min-w-0 flex-col gap-3 rounded-xl border bg-fd-card p-4',
        entry.featured && 'border-fd-primary/40 bg-fd-primary/5',
      )}
    >
      <div className="flex items-start gap-3">
        <ProjectAvatar entry={entry} imageUrl={source?.imageUrl ?? null} />
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-sm font-semibold leading-5">{entry.name}</h2>
          <p className="mt-1 flex items-center gap-1 text-xs text-fd-muted-foreground">
            {entry.kind === 'extractors' ? (
              <Package className="size-3 shrink-0" aria-hidden="true" />
            ) : entry.kind === 'plugins' ? (
              <Puzzle className="size-3 shrink-0" aria-hidden="true" />
            ) : (
              <Bot className="size-3 shrink-0" aria-hidden="true" />
            )}
            {entry.kind === 'extractors' ? 'Extractor' : entry.kind === 'plugins' ? 'Plugin' : 'Music bot'}
          </p>
          {author ? <p className="mt-1 break-words text-xs text-fd-muted-foreground">by {author}</p> : null}
        </div>
      </div>
      <p className="text-sm leading-6 text-fd-muted-foreground">{entry.description}</p>
      <div className="mt-auto flex flex-col gap-3 pt-1">
        {source ? (
          <p className="min-w-0 break-words text-xs text-fd-muted-foreground">
            <span className="font-medium text-fd-foreground">{source.platform}</span> · {source.identifier}
          </p>
        ) : null}
        {entry.featured || entry.version || entry.deprecated ? (
          <div className="flex flex-wrap gap-2">
            {entry.featured ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-fd-primary/30 bg-fd-primary/10 px-2 py-0.5 text-xs font-medium text-fd-primary">
                <Star className="size-3 fill-current" aria-hidden="true" />
                Maintainer pick
              </span>
            ) : null}
            {entry.deprecated ? (
              <span className="rounded-full border border-fd-error/30 bg-fd-error/10 px-2 py-0.5 text-xs font-medium text-fd-error">
                Deprecated
              </span>
            ) : null}
            {entry.version ? (
              <span className="rounded-full border bg-fd-muted px-2 py-0.5 text-xs font-medium text-fd-muted-foreground">
                Discord Player {entry.version}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 border-t pt-3">
          {actions.map((action) => (
            <a
              key={action.label}
              href={action.href}
              target="_blank"
              rel="noreferrer"
              aria-label={`${action.label} for ${entry.name}`}
              className="inline-flex min-h-9 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-fd-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              {action.label}
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>
    </article>
  );
}

/** Search and metadata filters shared by all resource categories. */
function ResourcePanel({ kind, entries, contributionUrl }: { kind: Kind; entries: Entry[]; contributionUrl: string }) {
  const [query, setQuery] = useState('');
  const [version, setVersion] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const label = kindFilters.find((category) => category.id === kind)?.label ?? kind;
  const majors = [
    ...new Set(entries.map((entry) => majorOf(entry.version ?? '')).filter((major) => /^v\d/.test(major))),
  ].sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)));
  const visible = entries.filter(
    (entry) => matches(query, entry) && (!version || majorOf(entry.version ?? '') === version),
  );

  function reset() {
    setQuery('');
    setVersion('');
    searchRef.current?.focus();
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-5 py-12 text-center">
        <Puzzle className="size-7 text-fd-muted-foreground" aria-hidden="true" />
        <h2 className="text-base font-semibold">
          {kind === 'plugins' ? 'No community plugins yet' : `No ${label.toLowerCase()} yet`}
        </h2>
        <p className="max-w-md text-sm leading-6 text-fd-muted-foreground">
          {kind === 'plugins'
            ? 'Build beyond media extraction with lyrics providers, queue behavior extensions, and other Discord Player capabilities. Share your plugin with the community.'
            : 'Share your project with the Discord Player community.'}
        </p>
        <a
          href={contributionUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex min-h-10 items-center gap-2 rounded-lg bg-fd-primary px-4 text-sm font-medium text-fd-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 focus-visible:ring-offset-fd-background"
        >
          {kind === 'plugins' ? 'Add your plugin' : 'Add your project'}
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="relative block flex-1">
          <span className="sr-only">Search {label.toLowerCase()}</span>
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fd-muted-foreground"
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            type="search"
            placeholder={`Search ${label.toLowerCase()}…`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 w-full rounded-lg border bg-fd-card ps-9 pe-10 text-sm placeholder:text-fd-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
              className="absolute end-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-fd-muted-foreground hover:bg-fd-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </label>
        {kind === 'bots' && majors.length > 0 ? (
          <label className="flex items-center gap-2 text-sm text-fd-muted-foreground">
            <span className="shrink-0">Built with</span>
            <select
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              className="h-10 min-w-0 flex-1 rounded-lg border bg-fd-card px-3 text-sm text-fd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              <option value="">Any version</option>
              {majors.map((major) => (
                <option key={major} value={major}>
                  Discord Player {major}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <p role="status" className="mb-4 text-xs text-fd-muted-foreground">
        Showing {visible.length} of {entries.length} {label.toLowerCase()}
      </p>
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-5 py-12 text-center">
          <Search className="size-7 text-fd-muted-foreground" aria-hidden="true" />
          <h2 className="font-semibold">No projects match your filters</h2>
          <p className="text-sm text-fd-muted-foreground">Try a different search term or reset your filters.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-1 min-h-10 rounded-lg border bg-fd-card px-4 text-sm font-medium hover:bg-fd-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="grid auto-rows-fr grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((entry) => (
            <ProjectCard key={entry.repositoryUrl ?? entry.websiteUrl ?? entry.name} entry={entry} />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Community directory with shareable category tabs and contextual search.
 *
 * @param resources Community resources grouped by category.
 * @param contributionUrl Location for submitting a community project.
 */
export function CommunityList({ resources, contributionUrl }: { resources: IShowcase; contributionUrl: string }) {
  const [kind, setKind] = useState<Kind>('extractors');
  const entries = useMemo(
    () =>
      kindFilters.map((category) => ({
        ...category,
        entries: resources[category.id].map((resource): Entry => ({ ...resource, kind: category.id })),
      })),
    [resources],
  );

  useEffect(() => {
    function readLocation() {
      const hash = window.location.hash.slice(1);
      setKind(kindFilters.find((category) => category.id === hash)?.id ?? 'extractors');
    }

    readLocation();
    window.addEventListener('popstate', readLocation);
    window.addEventListener('hashchange', readLocation);

    return () => {
      window.removeEventListener('popstate', readLocation);
      window.removeEventListener('hashchange', readLocation);
    };
  }, []);

  function selectCategory(value: string) {
    const category = kindFilters.find((candidate) => candidate.id === value);

    if (!category || category.id === kind) return;

    window.history.pushState(null, '', `#${category.id}`);
    setKind(category.id);
  }

  return (
    <Tabs value={kind} onValueChange={selectCategory} className="min-w-0">
      <TabsList activateOnFocus aria-label="Community resources" className="gap-5 border-b !px-0 sm:gap-7">
        {entries.map((category) => (
          <TabsTrigger
            key={category.id}
            id={category.id}
            value={category.id}
            className="min-h-12 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fd-ring"
          >
            {category.label}{' '}
            <span className="text-xs tabular-nums text-fd-muted-foreground">({category.entries.length})</span>
          </TabsTrigger>
        ))}
      </TabsList>
      {entries.map((category) => (
        <TabsContent
          key={category.id}
          value={category.id}
          className="!rounded-none !bg-transparent !px-0 !py-5 focus-visible:ring-2 focus-visible:ring-fd-ring"
        >
          <ResourcePanel kind={category.id} entries={category.entries} contributionUrl={contributionUrl} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
