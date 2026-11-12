import type { ApiPageFile, ManifestPage, UnresolvedReference } from './model.ts';
import { pageSections } from './sections.ts';
import type { SymbolTable } from './symbols.ts';
import { walkSymbol } from './walk.ts';

/** Problems found in the generated model. */
export interface ValidationResult {
  /** Conditions that make the output unusable; generation fails when any exist. */
  errors: string[];
  /** Quality diagnostics such as references to types that are not exported. */
  warnings: string[];
}

/**
 * Validate generated pages before they are written.
 *
 * Hard errors cover structural problems the renderer cannot recover from: duplicate or case-colliding
 * URLs, duplicate anchors, links to pages that do not exist, and packages that produced no symbols.
 * Unlinked references are reported as warnings so internal types in public signatures stay visible
 * without blocking the build.
 *
 * @param table Symbol table.
 * @param files Generated page files.
 * @param unresolved Unlinked references from link resolution.
 * @param expectedPackages Package names that must have produced at least one page.
 * @returns Errors and warnings.
 */
export function validate(
  table: SymbolTable,
  files: { page: ManifestPage; content: ApiPageFile }[],
  unresolved: UnresolvedReference[],
  expectedPackages: string[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const urls = new Map<string, string>();
  const known = new Set(files.map(({ page }) => page.url));

  for (const { page } of files) {
    const lower = page.url.toLowerCase();
    const previous = urls.get(lower);

    if (previous) errors.push(`URL collision (case-insensitive): ${page.url} and ${previous}`);

    urls.set(lower, page.url);

    if (!page.title.trim()) errors.push(`Page ${page.url} has no title.`);

    if (page.path.endsWith('index.mdx') !== page.index)
      errors.push(`Page ${page.url} index flag disagrees with ${page.path}.`);
  }

  const checkHref = (href: string | undefined, from: string) => {
    if (!href) return;

    const [path] = href.split('#');

    if (path && !known.has(path)) errors.push(`${from}: link ${href} points to a page that does not exist.`);
  };

  for (const { content } of files) {
    if (content.type !== 'symbol') continue;

    const page = content.page;
    const anchors = new Set<string>();
    const claim = (id: string) => {
      if (anchors.has(id)) errors.push(`${page.url}: duplicate anchor #${id}`);

      anchors.add(id);
    };

    for (const section of pageSections(page.symbol, page.symbol.entries)) {
      claim(section.id);

      if (section.kind === 'members') for (const member of section.members) if (member.anchor) claim(member.anchor);

      if (section.kind === 'impls') {
        for (const impl of section.impls) {
          claim(impl.anchor);

          for (const member of impl.items) if (member.anchor) claim(member.anchor);
        }
      }
    }

    walkSymbol(page.symbol, {
      type(type) {
        if (type.kind === 'reference' || type.kind === 'qualified-path') checkHref(type.href, page.url);
      },
      doc(doc) {
        for (const link of Object.values(doc.links ?? {})) checkHref(link.href, page.url);
      },
      entry(entry) {
        checkHref(entry.href, page.url);
      },
      implementor(implementor) {
        checkHref(implementor.href, page.url);
      },
    });
  }

  for (const name of expectedPackages) {
    if (!table.pages.some((page) => page.pkg.name === name && !page.isIndex)) {
      errors.push(`Package ${name} produced no documented symbols.`);
    }
  }

  const counts = new Map<string, number>();

  for (const item of unresolved) {
    const key = `${item.reason}: ${item.name}${item.qualified ? ` (${item.qualified})` : ''}`;

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (const [key, count] of [...counts].sort()) warnings.push(`Unlinked reference ${key} ×${count}`);

  return { errors, warnings };
}
