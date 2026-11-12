import type { ModuleEntry, RustImpl, SymbolKind, SymbolNode, TocEntry } from './model.ts';
import { typeToText, typeParametersToText } from './text.ts';

/** One block of a symbol page. Both the table of contents and the renderer derive from this list. */
export type PageSection =
  | { id: string; title: string; kind: 'members'; members: SymbolNode[] }
  | { id: string; title: string; kind: 'impls'; impls: RustImpl[]; collapsed: boolean }
  | {
      id: string;
      title: string;
      kind: 'implementors';
      implementors: NonNullable<SymbolNode['rust']>['implementors'];
    }
  | { id: string; title: string; kind: 'entries'; entries: ModuleEntry[] };

const MODULE_KINDS: SymbolKind[] = ['package', 'module', 'namespace'];

/** True when the symbol is an index page for other symbols. */
export function isModuleLike(symbol: Pick<SymbolNode, 'kind'>): boolean {
  return MODULE_KINDS.includes(symbol.kind);
}

/** Sidebar and index group headings in display order. */
export const ENTRY_GROUPS: { kinds: SymbolKind[]; title: string }[] = [
  { kinds: ['module', 'namespace'], title: 'Modules' },
  { kinds: ['class'], title: 'Classes' },
  { kinds: ['struct'], title: 'Structs' },
  { kinds: ['interface'], title: 'Interfaces' },
  { kinds: ['enum'], title: 'Enumerations' },
  { kinds: ['union'], title: 'Unions' },
  { kinds: ['trait', 'trait-alias'], title: 'Traits' },
  { kinds: ['function'], title: 'Functions' },
  { kinds: ['type-alias'], title: 'Type aliases' },
  { kinds: ['variable'], title: 'Variables' },
  { kinds: ['constant'], title: 'Constants' },
  { kinds: ['static'], title: 'Statics' },
  { kinds: ['macro'], title: 'Macros' },
];

/** Heading used for a symbol kind in lists. */
export function groupTitle(kind: SymbolKind): string {
  return ENTRY_GROUPS.find((group) => group.kinds.includes(kind))?.title ?? 'Other';
}

/** Anchor-safe id for a section title. */
function sectionId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Heading text for an impl block, for example `impl<T> Clone for Foo<T>`. */
export function implTitle(impl: RustImpl): string {
  const generics = typeParametersToText(impl.typeParameters, 'rust');
  const trait = impl.trait ? `${impl.negative ? '!' : ''}${typeToText(impl.trait)} for ` : '';

  return `impl${generics} ${trait}${typeToText(impl.forType)}`;
}

/**
 * Compute the ordered sections of a symbol page.
 *
 * @param symbol Primary symbol of the page.
 * @param entries Index entries when the symbol is module-like.
 * @returns Sections with stable ids.
 */
export function pageSections(symbol: SymbolNode, entries: ModuleEntry[] = []): PageSection[] {
  const sections: PageSection[] = [];

  if (isModuleLike(symbol)) {
    for (const group of ENTRY_GROUPS) {
      const matching = entries.filter((entry) => group.kinds.includes(entry.kind) && !entry.reexport);

      if (matching.length > 0) {
        sections.push({
          id: sectionId(group.title),
          title: group.title,
          kind: 'entries',
          entries: matching,
        });
      }
    }

    const reexports = entries.filter((entry) => entry.reexport);

    if (reexports.length > 0) {
      sections.push({ id: 're-exports', title: 'Re-exports', kind: 'entries', entries: reexports });
    }

    return sections;
  }

  const byKind = (...kinds: SymbolKind[]) => symbol.members.filter((member) => kinds.includes(member.kind));
  const add = (title: string, members: SymbolNode[]) => {
    if (members.length > 0) sections.push({ id: sectionId(title), title, kind: 'members', members });
  };
  const instance = (member: SymbolNode) => !member.flags.includes('static');
  const statics = (member: SymbolNode) => member.flags.includes('static');

  if (symbol.language === 'typescript') {
    add('Constructors', byKind('constructor'));
    add('Enumeration members', byKind('enum-member'));
    add('Properties', byKind('property').filter(instance));
    add('Accessors', byKind('accessor').filter(instance));
    add('Index signatures', byKind('index-signature'));
    add('Methods', byKind('method').filter(instance));
    add('Static properties', byKind('property').filter(statics));
    add('Static accessors', byKind('accessor').filter(statics));
    add('Static methods', byKind('method').filter(statics));

    return sections;
  }

  add('Fields', byKind('field'));
  add('Variants', byKind('variant'));
  add('Associated types', byKind('associated-type'));
  add('Associated constants', byKind('associated-constant'));
  add(
    'Required methods',
    byKind('method').filter((member) => member.rust?.provided === false),
  );
  add(
    'Provided methods',
    byKind('method').filter((member) => member.rust?.provided === true),
  );

  const rust = symbol.rust;

  if (rust) {
    const group = (title: string, impls: RustImpl[], collapsed: boolean) => {
      if (impls.length > 0) sections.push({ id: sectionId(title), title, kind: 'impls', impls, collapsed });
    };

    group(
      'Implementations',
      rust.impls.filter((impl) => impl.implKind === 'inherent'),
      false,
    );
    group(
      'Trait implementations',
      rust.impls.filter((impl) => impl.implKind === 'trait'),
      true,
    );
    group(
      'Auto trait implementations',
      rust.impls.filter((impl) => impl.implKind === 'auto'),
      true,
    );
    group(
      'Blanket implementations',
      rust.impls.filter((impl) => impl.implKind === 'blanket'),
      true,
    );

    if (rust.implementors.length > 0) {
      sections.push({
        id: 'implementors',
        title: 'Implementors',
        kind: 'implementors',
        implementors: rust.implementors,
      });
    }
  }

  return sections;
}

/**
 * Table of contents for a symbol page: section headings with their members as children.
 *
 * @param sections Sections from {@link pageSections}.
 * @returns Entries with `#anchor` URLs; depth 2 for sections and 3 for members.
 */
export function tocOf(sections: PageSection[]): TocEntry[] {
  const toc: TocEntry[] = [];

  for (const section of sections) {
    toc.push({ title: section.title, url: `#${section.id}`, depth: 2 });

    if (section.kind === 'members') {
      for (const member of section.members) {
        if (member.anchor) toc.push({ title: member.name, url: `#${member.anchor}`, depth: 3 });
      }
    } else if (section.kind === 'impls') {
      for (const impl of section.impls) {
        if (section.collapsed) {
          toc.push({ title: implTitle(impl), url: `#${impl.anchor}`, depth: 3 });
        } else {
          for (const member of impl.items) {
            if (member.anchor) toc.push({ title: member.name, url: `#${member.anchor}`, depth: 3 });
          }
        }
      }
    }
  }

  return toc;
}
