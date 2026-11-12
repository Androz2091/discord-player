import type { DocText, Docs, Signature, SymbolBase, SymbolKind, SymbolNode } from './model.ts';

/** Empty documentation record. */
export function emptyDocs(): Docs {
  return { examples: [], throws: [], see: [], sections: [], modifiers: [] };
}

/**
 * Create a documentation text value, omitting an empty link table.
 *
 * @param markdown Markdown source.
 * @param links Optional link destinations.
 * @returns Doc text.
 */
export function docText(markdown: string, links?: DocText['links']): DocText {
  return links && Object.keys(links).length > 0 ? { markdown, links } : { markdown };
}

/** True when documentation contains nothing worth rendering. */
export function isEmptyDocs(docs: Docs): boolean {
  return (
    !docs.summary?.markdown.trim() &&
    !docs.remarks?.markdown.trim() &&
    !docs.deprecated &&
    docs.examples.length === 0 &&
    docs.throws.length === 0 &&
    docs.see.length === 0 &&
    docs.sections.length === 0
  );
}

/**
 * Split Markdown into lines while tracking fenced code blocks.
 *
 * @param markdown Markdown source.
 * @param visit Called for each line with whether the line is inside a fence and the fence opener line.
 */
export function scanLines(
  markdown: string,
  visit: (line: string, state: { inFence: boolean; fenceOpen: boolean; fenceClose: boolean }) => void,
): void {
  let fence: { marker: string; length: number } | undefined;

  for (const line of markdown.split('\n')) {
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;
    const marker = trimmed[0];

    if (!fence && indent < 4 && (marker === '`' || marker === '~')) {
      let length = 0;

      while (trimmed[length] === marker) length += 1;

      if (length >= 3 && !(marker === '`' && trimmed.slice(length).includes('`'))) {
        fence = { marker, length };
        visit(line, { inFence: true, fenceOpen: true, fenceClose: false });
        continue;
      }
    } else if (fence && indent < 4 && marker === fence.marker) {
      let length = 0;

      while (trimmed[length] === marker) length += 1;

      if (length >= fence.length && trimmed.slice(length).trim() === '') {
        fence = undefined;
        visit(line, { inFence: true, fenceOpen: false, fenceClose: true });
        continue;
      }
    }

    visit(line, { inFence: Boolean(fence), fenceOpen: false, fenceClose: false });
  }
}

/**
 * First paragraph of Markdown, flattened to one line with link and emphasis syntax kept.
 *
 * @param markdown Markdown source.
 * @returns A single-paragraph summary, or an empty string.
 */
export function firstParagraph(markdown: string | undefined): string {
  if (!markdown) return '';

  const lines: string[] = [];
  let done = false;

  scanLines(markdown.trim(), (line, state) => {
    if (done) return;

    if (state.inFence) {
      if (lines.length > 0) done = true;

      return;
    }

    if (line.trim() === '') {
      if (lines.length > 0) done = true;

      return;
    }

    if (lines.length === 0 && line.trimStart().startsWith('#')) return;

    lines.push(line.trim());
  });

  return lines.join(' ');
}

/**
 * Flatten a one-paragraph Markdown summary for index tables: links and reference brackets become
 * their text, while inline code spans keep their backticks.
 */
export function inlineSummary(markdown: string): string {
  return markdown
    .replace(/\[(`[^`]+`)\]\[[^\]]*\]/g, '$1')
    .replace(/\[(`[^`]+`)\]\([^)]*\)/g, '$1')
    .replace(/\[(`[^`]+`)\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1')
    .trim();
}

/** Convert Markdown to plain text for search indexes and meta descriptions. */
export function markdownToPlainText(markdown: string): string {
  const out: string[] = [];

  scanLines(markdown, (line, state) => {
    if (state.fenceOpen || state.fenceClose) return;

    out.push(
      state.inFence
        ? line
        : line
            .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
            .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
            .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
            .replace(/^[#>\-*+\s]+/, '')
            .replace(/[`*_~]/g, ''),
    );
  });

  return out.join(' ').replace(/\s+/g, ' ').trim();
}

/** Create a node with default empty collections. */
export function createNode(
  base: Pick<SymbolBase, 'key' | 'id' | 'name' | 'kind' | 'languageKind' | 'language'> &
    Partial<SymbolBase> & { anchor?: string },
): SymbolNode {
  return {
    docs: emptyDocs(),
    flags: [],
    typeParameters: [],
    signatures: [],
    extends: [],
    implements: [],
    whereClauses: [],
    members: [],
    entries: [],
    ...base,
  };
}

/** Sort rank used to group page members. */
export const KIND_ORDER: SymbolKind[] = [
  'constructor',
  'field',
  'property',
  'variant',
  'enum-member',
  'accessor',
  'index-signature',
  'associated-type',
  'associated-constant',
  'method',
  'function',
];

/** Signature has any documentation of its own. */
export function signatureHasDocs(signature: Signature): boolean {
  return !isEmptyDocs(signature.docs) || signature.parameters.some((p) => p.docs?.markdown.trim());
}
