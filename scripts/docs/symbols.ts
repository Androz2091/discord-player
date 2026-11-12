import { API_CONTENT_DIR } from './config.ts';
import { groupTitle, isModuleLike, ENTRY_GROUPS } from './sections.ts';
import type { ApiEntry, ApiPackage, ApiProject, Language, SymbolKind, SymbolNode } from './model.ts';

/** A page-owning symbol with its allocated location. */
export interface PagePlan {
  symbol: SymbolNode;
  pkg: ApiPackage;
  entry: ApiEntry;
  /** URL segments below the site root's `docs` route, starting with `api`. */
  slugs: string[];
  /** Virtual content path used by Fumadocs, for example `api/typescript/client/RemediaClient.mdx`. */
  filePath: string;
  /** True for package, entry, module, and namespace index pages. */
  isIndex: boolean;
  /** Sidebar group heading of the page. */
  group: string;
  parent?: PagePlan;
  /** Child pages in sidebar order. */
  children: PagePlan[];
}

/** Where a symbol is documented. */
export interface SymbolEntry {
  key: string;
  node: SymbolNode;
  page: PagePlan;
  /** Fragment identifier for members; undefined for page symbols. */
  anchor?: string;
}

/** Symbol index and page plan for the whole project. */
export interface SymbolTable {
  pages: PagePlan[];
  byKey: Map<string, SymbolEntry>;
  /** Language and package index pages in sidebar order. */
  roots: PagePlan[];
  /** Site-relative URL (with trailing slash and optional fragment) of a symbol key. */
  urlOf(key: string): string | undefined;
}

/** Route of a page below the site root. */
export function pageUrl(slugs: string[]): string {
  return `/docs/v8/${slugs.join('/')}/`;
}

/**
 * URL-safe path segment for a symbol name.
 *
 * @param name Declared name, which may contain `$` or operator characters.
 * @returns A segment containing only `A-Za-z0-9_.-`.
 */
export function sanitizeSegment(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^\.+/, '_');

  return cleaned || '_';
}

const KIND_SUFFIX = new Map<SymbolKind, string>(
  Object.entries({
    class: 'class',
    interface: 'interface',
    'type-alias': 'type',
    enum: 'enum',
    function: 'fn',
    variable: 'var',
    namespace: 'namespace',
    module: 'mod',
    struct: 'struct',
    union: 'union',
    trait: 'trait',
    'trait-alias': 'traitalias',
    constant: 'const',
    static: 'static',
    macro: 'macro',
  }) as [SymbolKind, string][],
);

/**
 * Allocate page locations and index every symbol.
 *
 * URLs are unique case-insensitively so exports work on case-insensitive file systems. Name clashes
 * are resolved by appending the symbol kind, then a counter, in a deterministic order.
 *
 * @param project Normalized packages.
 * @returns Page plan and symbol index.
 */
export function planSymbols(project: ApiProject): SymbolTable {
  const used = new Set<string>();
  const pages: PagePlan[] = [];
  const roots: PagePlan[] = [];
  const byKey = new Map<string, SymbolEntry>();

  const claim = (segments: string[], name: string, kind: SymbolKind): string => {
    const base = sanitizeSegment(name);
    const candidates = [base, `${base}-${KIND_SUFFIX.get(kind) ?? 'item'}`];
    let counter = 2;

    for (const candidate of candidates) {
      const url = [...segments, candidate].join('/').toLowerCase();

      if (!used.has(url)) {
        used.add(url);

        return candidate;
      }
    }

    for (;;) {
      const candidate = `${base}-${KIND_SUFFIX.get(kind) ?? 'item'}-${counter}`;
      const url = [...segments, candidate].join('/').toLowerCase();

      if (!used.has(url)) {
        used.add(url);

        return candidate;
      }

      counter += 1;
    }
  };

  const register = (node: SymbolNode, page: PagePlan, anchors: Set<string>) => {
    // Members of module-like symbols are pages of their own and are registered with those pages.
    if (isModuleLike(node)) return;

    for (const member of node.members) {
      if (member.anchor) {
        let anchor = member.anchor;
        let counter = 2;

        while (anchors.has(anchor)) anchor = `${member.anchor}-${counter++}`;

        anchors.add(anchor);
        member.anchor = anchor;
      }

      if (!byKey.has(member.key))
        byKey.set(member.key, {
          key: member.key,
          node: member,
          page,
          ...(member.anchor ? { anchor: member.anchor } : {}),
        });

      register(member, page, anchors);
    }

    for (const impl of node.rust?.impls ?? []) {
      anchors.add(impl.anchor);

      for (const member of impl.items) {
        if (member.anchor) {
          let anchor = member.anchor;
          let counter = 2;

          while (anchors.has(anchor)) anchor = `${member.anchor}-${counter++}`;

          anchors.add(anchor);
          member.anchor = anchor;
        }

        if (!byKey.has(member.key))
          byKey.set(member.key, {
            key: member.key,
            node: member,
            page,
            ...(member.anchor ? { anchor: member.anchor } : {}),
          });
      }
    }
  };

  const addPage = (plan: Omit<PagePlan, 'children'>): PagePlan => {
    const page: PagePlan = { ...plan, children: [] };

    pages.push(page);
    plan.parent?.children.push(page);
    byKey.set(plan.symbol.key, { key: plan.symbol.key, node: plan.symbol, page });
    register(plan.symbol, page, new Set(['implementations']));

    return page;
  };

  const kindRank = (kind: SymbolKind): number => {
    const index = ENTRY_GROUPS.findIndex((group) => group.kinds.includes(kind));

    return index === -1 ? ENTRY_GROUPS.length : index;
  };

  /** Plan the members of a module-like symbol. */
  const planChildren = (parent: PagePlan, dir: string[], contentDir: string) => {
    const ordered = [...parent.symbol.members].sort(
      (a, b) => kindRank(a.kind) - kindRank(b.kind) || a.name.localeCompare(b.name),
    );

    for (const symbol of ordered) {
      const segment = claim(['api', ...dir], symbol.name, symbol.kind);
      const slugs = ['api', ...dir, segment];

      if (isModuleLike(symbol)) {
        const folder = `${contentDir}/${segment}`;
        const page = addPage({
          symbol,
          pkg: parent.pkg,
          entry: parent.entry,
          slugs,
          filePath: `${folder}/index.mdx`,
          isIndex: true,
          group: groupTitle(symbol.kind),
          parent,
        });

        planChildren(page, [...dir, segment], folder);
      } else {
        addPage({
          symbol,
          pkg: parent.pkg,
          entry: parent.entry,
          slugs,
          filePath: `${contentDir}/${segment}.mdx`,
          isIndex: false,
          group: groupTitle(symbol.kind),
          parent,
        });
      }
    }
  };

  const languages: Language[] = ['typescript', 'rust'];

  for (const language of languages) {
    const packages = project.packages.filter((pkg) => pkg.language === language);

    for (const pkg of packages) {
      const packageDir = [language, pkg.slug];
      let primary: PagePlan | undefined;

      const orderedEntries = [...pkg.entries].sort((a, b) => Number(Boolean(a.slug)) - Number(Boolean(b.slug)));

      // Entry-point folders are reserved first so an exported symbol can never shadow one.
      for (const entry of orderedEntries) {
        if (entry.slug) used.add(['api', ...packageDir, sanitizeSegment(entry.slug)].join('/').toLowerCase());
      }

      for (const entry of orderedEntries) {
        const isPrimary = entry.slug === '';
        const dir = isPrimary ? packageDir : [...packageDir, sanitizeSegment(entry.slug)];

        if (isPrimary) used.add(['api', ...dir].join('/').toLowerCase());

        const contentDir = `${API_CONTENT_DIR}/${dir.join('/')}`;
        const page = addPage({
          symbol: entry.root,
          pkg,
          entry,
          slugs: ['api', ...dir],
          filePath: `${contentDir}/index.mdx`,
          isIndex: true,
          group: 'Modules',
          ...(isPrimary || !primary ? {} : { parent: primary }),
        });

        if (isPrimary) primary = page;

        roots.push(page);
        planChildren(page, dir, contentDir);
      }
    }
  }

  return {
    pages,
    byKey,
    roots,
    urlOf(key) {
      const entry = byKey.get(key);

      if (!entry) return undefined;

      const url = pageUrl(entry.page.slugs);

      return entry.anchor ? `${url}#${entry.anchor}` : url;
    },
  };
}
