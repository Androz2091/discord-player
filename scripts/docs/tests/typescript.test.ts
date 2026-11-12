import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TypeExpr } from '../model.ts';
import { signatureToText, typeToText } from '../text.ts';
import { walkSymbol } from '../walk.ts';
import { member, pageOf, typescriptFixture } from './helpers.ts';

/** Collect every reference type reachable from a symbol. */
function references(symbol: Parameters<typeof walkSymbol>[0]): Extract<TypeExpr, { kind: 'reference' }>[] {
  const found: Extract<TypeExpr, { kind: 'reference' }>[] = [];

  walkSymbol(symbol, {
    type(type) {
      if (type.kind === 'reference') found.push(type);
    },
  });

  return found;
}

describe('TypeScript API documentation', async () => {
  const built = await typescriptFixture();

  it('documents only exported, non-internal declarations', () => {
    const names = built.table.pages.filter((page) => page.pkg.name === '@fx/base').map((page) => page.symbol.name);

    assert.ok(names.includes('Store'));
    assert.ok(names.includes('visible'));
    assert.ok(!names.includes('internalHelper'), '@internal functions are hidden');
    assert.ok(!names.includes('Hidden'), 'declarations that are not exported are hidden');
  });

  it('omits private and @internal members', () => {
    const store = pageOf(built, '@fx/base', 'Store').symbol;
    const names = store.members.map((entry) => entry.name);

    assert.ok(!names.includes('secret'));
    assert.ok(!names.includes('debug'));
    assert.deepEqual(names.filter((name) => ['size', 'get', 'set', 'constructor'].includes(name)).sort(), [
      'constructor',
      'get',
      'set',
      'size',
    ]);
  });

  it('keeps overloads as separate signatures with their own documentation', () => {
    const get = member(pageOf(built, '@fx/base', 'Store').symbol, 'get');

    assert.equal(get.signatures.length, 2);

    const [first, second] = get.signatures;

    assert.match(first?.docs.summary?.markdown ?? '', /Read a value by key/);
    assert.match(second?.docs.summary?.markdown ?? '', /Read several values at once/);
    assert.equal(first?.parameters[0]?.name, 'key');
    assert.equal(second?.parameters[0]?.name, 'keys');
    assert.equal(first?.parameters[0]?.docs?.markdown, 'Lookup key.');
    assert.equal(second?.parameters[0]?.docs?.markdown, 'Lookup keys.');
    assert.match(first?.returns?.docs?.markdown ?? '', /undefined when missing/);
    assert.equal(signatureToText(second as NonNullable<typeof second>), 'get(keys: string[]): (T | undefined)[]');
  });

  it('preserves TSDoc blocks: examples, throws, see, remarks, deprecated', () => {
    const store = pageOf(built, '@fx/base', 'Store').symbol;
    const first = member(store, 'get').signatures[0];

    assert.equal(first?.docs.examples.length, 1);
    assert.match(first?.docs.examples[0]?.body.markdown ?? '', /^```ts\nconst store = new Store<number>\(\);/);
    assert.match(first?.docs.throws[0]?.markdown ?? '', /RangeError/);
    assert.equal(first?.docs.see.length, 1);
    assert.match(store.docs.remarks?.markdown ?? '', /not thread safe/);
    assert.ok(member(store, 'set').signatures[0]?.docs.deprecated, 'set is deprecated');
  });

  it('resolves {@link} tags through structured targets, not names', () => {
    const set = member(pageOf(built, '@fx/base', 'Store').symbol, 'set').signatures[0];
    const links = Object.values(set?.docs.deprecated?.links ?? {});

    assert.equal(links.length, 1);
    assert.match(links[0]?.href ?? '', /\/docs\/v8\/api\/typescript\/base\/Store\/#method-get$/);
  });

  it('renders generics and nested type references with links', () => {
    const later = pageOf(built, '@fx/base', 'Later').symbol;

    assert.equal(typeToText(later.type as TypeExpr), 'Promise<Map<string, T>>');

    const refs = references(later);
    const promise = refs.find((reference) => reference.name === 'Promise');
    const map = refs.find((reference) => reference.name === 'Map');

    assert.match(promise?.external?.url ?? '', /developer\.mozilla\.org.*Promise/);
    assert.equal(map?.external?.package, 'typescript');
    assert.deepEqual(
      later.typeParameters.map((parameter) => parameter.name),
      ['T'],
    );
  });

  it('links nested references inside unions, arrays and generics across packages', () => {
    const load = pageOf(built, '@fx/app', 'load').symbol;
    const signature = load.signatures[0];

    assert.equal(
      signatureToText(signature as NonNullable<typeof signature>),
      'load(input: Options | Options, signal?: AbortSignal): Promise<(Store<string> | null)[]>',
    );

    const refs = references(load);
    const hrefs = Object.fromEntries(
      refs.map((reference) => [reference.name + (reference.target ? '' : '*'), reference.href]),
    );
    const options = refs.filter((reference) => reference.name === 'Options').map((reference) => reference.href);

    // The two `Options` interfaces have the same name and are told apart by their identity.
    assert.deepEqual(options.sort(), ['/docs/v8/api/typescript/app/Options/', '/docs/v8/api/typescript/base/Options/']);
    assert.equal(hrefs.Store, '/docs/v8/api/typescript/base/Store/', 'cross-package class reference');
    assert.equal(
      refs.find((reference) => reference.name === 'AbortSignal')?.external?.url,
      'https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal',
    );
  });

  it('shows inherited members with their origin and links base classes across packages', () => {
    const limited = pageOf(built, '@fx/base', 'LimitedStore').symbol;
    const get = member(limited, 'get');
    const set = member(limited, 'set');

    assert.ok(get.flags.includes('inherited'), 'get is inherited from Store');
    assert.equal(
      get.ts?.inheritedFrom?.kind === 'reference' ? get.ts.inheritedFrom.href : undefined,
      '/docs/v8/api/typescript/base/Store/#method-get',
    );
    assert.ok(set.flags.includes('override'), 'set overrides Store.set');
    assert.equal(
      set.ts?.overwrites?.kind === 'reference' ? set.ts.overwrites.href : undefined,
      '/docs/v8/api/typescript/base/Store/#method-set',
    );
    assert.ok(!limited.members.some((entry) => entry.name === 'secret'), 'private base members stay hidden');

    const appStore = pageOf(built, '@fx/app', 'AppStore').symbol;
    const base = appStore.extends[0];

    assert.equal(base?.kind === 'reference' ? base.href : undefined, '/docs/v8/api/typescript/base/Store/');
  });

  it('handles re-exports and duplicate names', () => {
    const entry = built.project.packages.find((pkg) => pkg.name === '@fx/base')?.entries[0]?.root;
    const alias = entry?.entries.find((candidate) => candidate.name === 'AliasedStore');
    const index = built.table.pages.find((page) => page.pkg.name === '@fx/base' && page.symbol === entry);
    const listed = index?.symbol.entries.find((candidate) => candidate.name === 'AliasedStore');

    assert.ok(alias?.reexport, 'the alias is recorded as a re-export');
    assert.equal(listed?.kind, 'class', 'alias entries take the kind of their target');
    assert.equal(listed?.href, '/docs/v8/api/typescript/base/Store/');
  });

  it('reports references to types that are not exported instead of linking them', () => {
    const leak = pageOf(built, '@fx/base', 'leak').symbol;
    const hidden = references(leak).find((reference) => reference.name === 'Hidden');

    assert.ok(hidden);
    assert.equal(hidden?.href, undefined);
    assert.ok(built.unresolved.some((item) => item.name === 'Hidden' && item.reason === 'not-exported'));
  });

  it('renders enumerations with member values and documentation', () => {
    const mode = pageOf(built, '@fx/app', 'Mode').symbol;

    assert.deepEqual(
      mode.members.map((entry) => [entry.name, entry.value]),
      [
        ['Fast', '"fast"'],
        ['Slow', '"slow"'],
      ],
    );
    assert.equal(member(mode, 'Fast').docs.summary?.markdown, 'Fast mode.');
  });
});
