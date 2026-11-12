import { GITHUB } from './config.ts';
import { firstParagraph, inlineSummary, markdownToPlainText } from './docs-util.ts';
import type {
  ApiPage,
  ApiPageFile,
  ApiProject,
  ManifestPage,
  ModuleEntry,
  NavFolder,
  OverviewPackage,
  OverviewPage,
  Language,
  SymbolNode,
} from './model.ts';
import { ENTRY_GROUPS, isModuleLike, pageSections, tocOf } from './sections.ts';
import type { PagePlan, SymbolTable } from './symbols.ts';
import { pageUrl } from './symbols.ts';
import { declarationToText, typeToText } from './text.ts';

/** Generated pages, navigation, and search data. */
export interface BuiltPages {
  files: { page: ManifestPage; content: ApiPageFile }[];
  folders: NavFolder[];
}

/** One-line summary of a symbol used in index tables and descriptions. */
export function summaryOf(symbol: SymbolNode): string {
  const docs = symbol.docs.summary ?? symbol.signatures[0]?.docs.summary;

  return firstParagraph(docs?.markdown);
}

/**
 * Fill index entries of every module-like page from its members, keeping re-export aliases.
 *
 * @param table Planned symbols.
 */
export function buildModuleEntries(table: SymbolTable): void {
  for (const page of table.pages) {
    const symbol = page.symbol;

    if (!isModuleLike(symbol)) continue;

    const own: ModuleEntry[] = symbol.members.map((member) => ({
      name: member.name,
      kind: member.kind,
      target: member.key,
      summary: inlineSummary(summaryOf(member)),
      ...(member.docs.deprecated ? { deprecated: true } : {}),
    }));
    const aliases = symbol.entries.map((alias): ModuleEntry => {
      const target = table.byKey.get(alias.target)?.node;

      return {
        ...alias,
        kind: target?.kind ?? alias.kind,
        summary: target ? inlineSummary(summaryOf(target)) : '',
        ...(target?.docs.deprecated ? { deprecated: true } : {}),
      };
    });
    const rank = (entry: ModuleEntry) => {
      const index = ENTRY_GROUPS.findIndex((group) => group.kinds.includes(entry.kind));

      return index === -1 ? ENTRY_GROUPS.length : index;
    };

    symbol.entries = [...own, ...aliases].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }
}

/** Pinned GitHub URL for a source location. */
export function sourceUrl(ref: string, symbol: SymbolNode): string | undefined {
  const source = symbol.source;

  if (!source) return undefined;

  const range =
    source.endLine && source.endLine > source.line ? `#L${source.line}-L${source.endLine}` : `#L${source.line}`;

  return `https://github.com/${GITHUB.owner}/${GITHUB.repo}/blob/${ref}/${source.file}${range}`;
}

/** Package-qualified display path of a page's symbol. */
function qualifiedNameOf(plan: PagePlan): string {
  const { pkg, entry, symbol } = plan;

  if (pkg.language === 'rust') {
    const path = symbol.id.path;

    return [pkg.name.replaceAll('-', '_'), ...path].join('::');
  }

  const base =
    entry.subpath === '.'
      ? pkg.name
      : entry.generated
        ? `${pkg.name} (N-API)`
        : `${pkg.name}/${entry.subpath.replace(/^\.\//, '')}`;

  return isModuleLike(symbol) && symbol === entry.root ? base : `${base} › ${symbol.id.path.join('.')}`;
}

function languageLabel(language: Language): string {
  return language === 'typescript' ? 'TypeScript' : 'Rust';
}

function describe(plan: PagePlan, qualified: string): string {
  const summary = markdownToPlainText(summaryOf(plan.symbol));
  const lead = `${plan.symbol.languageKind} ${plan.symbol.name} in ${plan.pkg.name} (${languageLabel(plan.pkg.language)} API).`;

  if (!summary) return lead;

  const text = summary.length > 220 ? `${summary.slice(0, 217).trimEnd()}…` : summary;

  void qualified;

  return text;
}

/** Searchable content for a symbol page: the declaration, summary, and one entry per member. */
function searchOf(plan: PagePlan, page: ApiPage, symbol: SymbolNode, entries: ModuleEntry[]): ManifestPage['search'] {
  const headings: ManifestPage['search']['headings'] = [];
  const contents: ManifestPage['search']['contents'] = [];
  const cap = (text: string) => (text.length > 240 ? `${text.slice(0, 237)}…` : text);

  contents.push({
    heading: '',
    content: cap(
      [
        `${page.qualifiedName}`,
        isModuleLike(symbol) ? '' : declarationToText(symbol),
        markdownToPlainText(summaryOf(symbol)),
      ]
        .filter(Boolean)
        .join(' — '),
    ),
  });

  const addMember = (member: SymbolNode) => {
    if (!member.anchor) return;

    headings.push({ id: member.anchor, content: `${symbol.name}.${member.name}` });
    contents.push({
      heading: member.anchor,
      content: cap(
        [
          member.signatures[0]
            ? declarationToText(member)
            : member.type
              ? `${member.name}: ${typeToText(member.type)}`
              : '',
          markdownToPlainText(summaryOf(member)),
        ]
          .filter(Boolean)
          .join(' — '),
      ),
    });
  };

  for (const member of symbol.members) addMember(member);

  for (const impl of symbol.rust?.impls ?? []) {
    if (impl.implKind === 'inherent') for (const member of impl.items) addMember(member);
  }

  // Index entries are not searched: each target has a page of its own, and listing them again would
  // roughly double the size of the static search index.
  void entries;

  void plan;

  return { headings, contents };
}

/**
 * Build the page content, search data, and sidebar folders.
 *
 * @param table Planned and link-resolved symbols.
 * @param project Normalized packages, used for overview pages.
 * @param sourceRef Git ref used for source links.
 * @returns Page files and navigation folders.
 */
export function buildPages(table: SymbolTable, project: ApiProject, sourceRef: string): BuiltPages {
  const files: BuiltPages['files'] = [];

  for (const plan of table.pages) {
    const symbol = plan.symbol;
    const view: SymbolNode = isModuleLike(symbol) ? { ...symbol, members: [] } : symbol;
    const sections = pageSections(view, symbol.entries);
    const qualified = qualifiedNameOf(plan);
    const title = symbol === plan.entry.root ? plan.entry.title : symbol.name;
    const page: ApiPage = {
      slugs: plan.slugs,
      url: pageUrl(plan.slugs),
      title,
      description: describe(plan, qualified),
      language: plan.pkg.language,
      package: plan.pkg.name,
      packageSlug: plan.pkg.slug,
      symbol: view,
      qualifiedName: qualified,
      breadcrumbs: breadcrumbsOf(plan),
      toc: tocOf(sections),
      group: plan.group,
      ...(sourceUrl(sourceRef, symbol) ? { sourceUrl: sourceUrl(sourceRef, symbol) as string } : {}),
    };
    const manifest: ManifestPage = {
      type: 'symbol',
      slugs: page.slugs,
      path: plan.filePath,
      url: page.url,
      title: page.title,
      description: page.description,
      language: page.language,
      package: page.package,
      packageSlug: page.packageSlug,
      kind: symbol.kind,
      file: `pages/${plan.slugs.join('/')}${plan.isIndex ? '/index' : ''}.json`,
      toc: page.toc,
      group: plan.group,
      index: plan.isIndex,
      ...(symbol.source ? { sourceFile: symbol.source.file } : {}),
      search: searchOf(plan, page, view, symbol.entries),
    };

    files.push({ page: manifest, content: { type: 'symbol', page } });
  }

  files.push(...overviewPages(table, project));

  return { files, folders: buildFolders(table, files) };
}

function breadcrumbsOf(plan: PagePlan): { title: string; url: string }[] {
  const crumbs: { title: string; url: string }[] = [];
  const language = plan.pkg.language;

  crumbs.push({ title: languageLabel(language), url: pageUrl(['api', language]) });

  const chain: PagePlan[] = [];

  for (let current: PagePlan | undefined = plan; current; current = current.parent) chain.unshift(current);

  for (const link of chain) {
    if (link === plan) continue;

    crumbs.push({
      title: link.symbol === link.entry.root ? link.entry.title : link.symbol.name,
      url: pageUrl(link.slugs),
    });
  }

  return crumbs;
}

function overviewPages(table: SymbolTable, project: ApiProject): BuiltPages['files'] {
  const files: BuiltPages['files'] = [];
  const cards = (language: Language): OverviewPackage[] =>
    project.packages
      .filter((pkg) => pkg.language === language)
      .map((pkg) => {
        const primary = table.roots.find((root) => root.pkg === pkg && root.entry.slug === '');
        const symbols = table.pages.filter((page) => page.pkg === pkg && !page.isIndex).length;

        return {
          name: pkg.name,
          description: pkg.description,
          url: pageUrl(primary?.slugs ?? ['api', language, pkg.slug]),
          version: pkg.version,
          language,
          symbols,
          entries: pkg.entries
            .filter((entry) => entry.slug !== '')
            .map((entry) => ({
              title: entry.title,
              url: pageUrl(table.roots.find((root) => root.entry === entry)?.slugs ?? []),
              description: entry.description,
            })),
        };
      });

  const make = (language: Language | undefined): ApiPageFile => {
    const packages = language ? cards(language) : cards('typescript');
    const slugs = language ? ['api', language] : ['api'];
    const title = language ? `${languageLabel(language)} API reference` : 'API reference';
    const page: OverviewPage = {
      slugs,
      url: pageUrl(slugs),
      title,
      description: language
        ? `Generated ${languageLabel(language)} API documentation for ${packages.map((pkg) => pkg.name).join(', ')}.`
        : 'Generated TypeScript API documentation for every public Discord Player package, built from the source on each documentation build.',
      ...(language ? { language } : {}),
      packages,
      toc: language
        ? packages.map((pkg) => ({ title: pkg.name, url: `#${anchorId(pkg.name)}`, depth: 2 }))
        : (['typescript'] as const).map((lang) => ({
            title: languageLabel(lang),
            url: `#${lang}`,
            depth: 2,
          })),
    };

    return { type: 'overview', page };
  };

  for (const language of [undefined, 'typescript'] as const) {
    const content = make(language);
    const page = content.page as OverviewPage;
    const dir = page.slugs.join('/');

    files.push({
      page: {
        type: 'overview',
        slugs: page.slugs,
        path: `${dir}/index.mdx`,
        url: page.url,
        title: page.title,
        description: page.description,
        language: language ?? 'typescript',
        package: '',
        packageSlug: '',
        kind: 'package',
        file: `pages/${dir}/index.json`,
        toc: page.toc,
        group: 'Overview',
        index: true,
        search: {
          headings: [],
          contents: [
            { heading: '', content: page.description },
            ...page.packages.map((pkg) => ({
              heading: '',
              content: `${pkg.name} ${pkg.description}`,
            })),
          ],
        },
      },
      content,
    });
  }

  return files;
}

/** Anchor id for a package card. */
export function anchorId(name: string): string {
  return name
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function buildFolders(table: SymbolTable, _files: BuiltPages['files']): NavFolder[] {
  const folders: NavFolder[] = [];
  const projectLanguages = new Set(table.pages.map((page) => page.pkg.language));
  const languages = (['typescript'] as const).filter((language) => projectLanguages.has(language));

  folders.push({ path: 'api', title: 'Generated API', pages: [...languages], defaultOpen: false });

  for (const language of languages) {
    const packages = [
      ...new Set(table.pages.filter((page) => page.pkg.language === language).map((page) => page.pkg.slug)),
    ];

    folders.push({
      path: `api/${language}`,
      title: languageLabel(language),
      pages: packages,
    });
  }

  for (const plan of table.pages) {
    if (!plan.isIndex) continue;

    const dir = plan.filePath.replace(/\/index\.mdx$/, '');
    const pages: string[] = [];
    const children = [...plan.children].sort(
      (a, b) => groupRank(a.group) - groupRank(b.group) || a.symbol.name.localeCompare(b.symbol.name),
    );
    let group = '';

    for (const child of children) {
      if (child.group !== group) {
        group = child.group;
        pages.push(`---${group}---`);
      }

      pages.push(
        child.filePath
          .replace(/\/index\.mdx$/, '')
          .replace(/\.mdx$/, '')
          .split('/')
          .pop() as string,
      );
    }

    folders.push({
      path: dir,
      title: plan.symbol === plan.entry.root ? plan.entry.title : plan.symbol.name,
      pages,
    });
  }

  return folders;
}

function groupRank(group: string): number {
  const index = ENTRY_GROUPS.findIndex((candidate) => candidate.title === group);

  return index === -1 ? ENTRY_GROUPS.length : index;
}
