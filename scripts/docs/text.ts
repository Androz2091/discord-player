import type { Bound, Signature, SymbolNode, TypeExpr, TypeParameter, WherePredicate } from './model.ts';
import {
  boundsSegments,
  declarationFragment,
  segmentsToText,
  signatureSegments,
  typeParametersSegments,
  typeSegments,
  whereSegments,
} from './segments.ts';

/**
 * Plain-text rendering of types and signatures, used for search content, anchors, Markdown exports
 * and tests. These are thin wrappers over the segment builders that the React renderer highlights, so
 * both always describe the same source text.
 */

/** Plain text of a type expression. */
export function typeToText(type: TypeExpr): string {
  return segmentsToText(typeSegments(type));
}

/** Plain text of bounds joined with `+`. */
export function boundsToText(bounds: Bound[]): string {
  return segmentsToText(boundsSegments(bounds));
}

/** Plain text of `<T extends X, U>` or an empty string. */
export function typeParametersToText(parameters: TypeParameter[], language: 'typescript' | 'rust'): string {
  return segmentsToText(typeParametersSegments(parameters, language));
}

/** Plain text of a Rust `where` clause, or an empty string. */
export function whereToText(clauses: WherePredicate[]): string {
  return segmentsToText(whereSegments(clauses)).trim().replace(/\s+/g, ' ');
}

/**
 * Plain text of a signature.
 *
 * @param signature Signature to render.
 * @param options `language` selects Rust or TypeScript punctuation.
 */
export function signatureToText(signature: Signature, options: { language?: 'typescript' | 'rust' } = {}): string {
  void options;

  return segmentsToText(signatureSegments(signature, { name: signature.name }));
}

/**
 * One-line declaration for a symbol, as it would be written in source.
 *
 * @param symbol Symbol to describe.
 * @returns Declaration text without bodies.
 */
export function declarationToText(symbol: SymbolNode): string {
  const first = symbol.signatures[0];

  if ((symbol.kind === 'function' || symbol.kind === 'method' || symbol.kind === 'constructor') && first) {
    return signatureToText(first);
  }

  return segmentsToText(declarationFragment(symbol).segments);
}
