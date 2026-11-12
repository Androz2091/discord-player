import type { ExternalRef, TypeExpr, UnresolvedReference } from './model.ts';
import type { SymbolTable } from './symbols.ts';
import { pageUrl } from './symbols.ts';
import { walkSymbol } from './walk.ts';

const MDN = 'https://developer.mozilla.org/en-US/docs/Web';
const TS_HANDBOOK_UTILITY = 'https://www.typescriptlang.org/docs/handbook/utility-types.html';

/**
 * Documentation URLs for external TypeScript symbols, keyed by declaring package and TypeDoc
 * qualified name. Anything not listed stays unlinked and is reported as external.
 */
const EXTERNAL_TYPESCRIPT: Record<string, Record<string, string>> = {
  typescript: {
    Promise: `${MDN}/JavaScript/Reference/Global_Objects/Promise`,
    Error: `${MDN}/JavaScript/Reference/Global_Objects/Error`,
    ErrorOptions: `${MDN}/JavaScript/Reference/Global_Objects/Error/Error#options`,
    Uint8Array: `${MDN}/JavaScript/Reference/Global_Objects/Uint8Array`,
    ArrayBufferLike: `${MDN}/JavaScript/Reference/Global_Objects/ArrayBuffer`,
    AbortSignal: `${MDN}/API/AbortSignal`,
    ReadableStream: `${MDN}/API/ReadableStream`,
    Request: `${MDN}/API/Request`,
    Response: `${MDN}/API/Response`,
    Record: `${TS_HANDBOOK_UTILITY}#recordkeys-type`,
    Pick: `${TS_HANDBOOK_UTILITY}#picktype-keys`,
    Omit: `${TS_HANDBOOK_UTILITY}#omittype-keys`,
    Readonly: `${TS_HANDBOOK_UTILITY}#readonlytype`,
    NoInfer: `${TS_HANDBOOK_UTILITY}#noinfertype`,
  },
  '@types/node': {
    '__global.Buffer': 'https://nodejs.org/api/buffer.html#class-buffer',
    '"http".IncomingMessage': 'https://nodejs.org/api/http.html#class-httpincomingmessage',
    '"http".ServerResponse': 'https://nodejs.org/api/http.html#class-httpserverresponse',
    '__global.NodeJS.Platform': 'https://nodejs.org/api/process.html#processplatform',
    'Stream.Readable': 'https://nodejs.org/api/stream.html#class-streamreadable',
  },
};

/** Packages whose every symbol links to one documentation page. */
const EXTERNAL_PACKAGE_PAGES: Record<string, string> = {
  zod: 'https://zod.dev/api',
};

/**
 * Documentation URL of an external TypeScript symbol.
 *
 * @param external Package and qualified symbol name from TypeDoc's structured symbol id.
 * @returns A URL, or undefined when no stable documentation is known.
 */
export function externalTypeScriptUrl(external: ExternalRef): string | undefined {
  return (
    (external.symbol ? EXTERNAL_TYPESCRIPT[external.package]?.[external.symbol] : undefined) ??
    EXTERNAL_PACKAGE_PAGES[external.package]
  );
}

/**
 * Resolve every structured reference to a page URL.
 *
 * References are matched by symbol identity (package, declaring file, qualified path), never by display
 * name. Unresolved references keep their text, lose their link, and are returned for validation.
 *
 * @param table Symbol table produced by `planSymbols`.
 * @returns References without a link, with the reason.
 */
export function resolveLinks(table: SymbolTable): UnresolvedReference[] {
  const unresolved: UnresolvedReference[] = [];

  for (const page of table.pages) {
    const where = pageUrl(page.slugs);
    const report = (name: string, reason: UnresolvedReference['reason'], qualified?: string) => {
      unresolved.push({ page: where, name, reason, ...(qualified ? { qualified } : {}) });
    };

    walkSymbol(page.symbol, {
      type(type: TypeExpr) {
        if (type.kind === 'reference') {
          const href = type.target ? table.urlOf(type.target) : undefined;

          if (href) {
            type.href = href;

            return;
          }

          delete type.target;

          if (type.external) {
            const url = type.external.url ?? externalTypeScriptUrl(type.external);

            if (url) type.external.url = url;
            else report(type.name, 'external', type.external.symbol);
          } else {
            report(type.name, 'not-exported', type.qualified);
          }
        } else if (type.kind === 'qualified-path' && type.target) {
          const href = table.urlOf(type.target);

          if (href) type.href = href;
          else delete type.target;
        }
      },
      doc(doc) {
        for (const [name, link] of Object.entries(doc.links ?? {})) {
          const href = link.target ? table.urlOf(link.target) : undefined;

          if (href) link.href = href;
          else if (!link.external) {
            delete doc.links?.[name];
            report(name, 'missing');
          }
        }
      },
      entry(entry) {
        const href = table.urlOf(entry.target);

        if (href) entry.href = href;
      },
      implementor(implementor) {
        const href = implementor.target ? table.urlOf(implementor.target) : undefined;

        if (href)
          implementor.href = implementor.anchor
            ? `${pageUrl(table.byKey.get(implementor.target ?? '')?.page.slugs ?? [])}#${implementor.anchor}`
            : href;
      },
    });
  }

  return unresolved;
}
