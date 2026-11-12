import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createNode } from '../docs-util.ts';
import type { ApiPackage, ApiProject, SymbolId, SymbolNode } from '../model.ts';
import { symbolKey } from '../model.ts';
import { planSymbols } from '../symbols.ts';
import { validate } from '../validate.ts';
import { build, typescriptFixture } from './helpers.ts';

/** Minimal symbol for allocation tests. */
function symbol(name: string, kind: SymbolNode['kind'], members: SymbolNode[] = []): SymbolNode {
  const id: SymbolId = {
    language: 'typescript',
    package: 'pkg',
    file: 'x.ts',
    path: [name],
    namespace: '',
  };

  const node = createNode({
    key: symbolKey(id),
    id,
    name,
    kind,
    languageKind: kind,
    language: 'typescript',
  });

  node.members = members;

  return node;
}

function project(members: SymbolNode[], entrySlugs: string[] = []): ApiProject {
  const root = (title: string, slug: string, list: SymbolNode[]) => ({
    subpath: slug ? `./${slug}` : '.',
    slug,
    title,
    description: '',
    generated: false,
    root: symbol(title, 'module', list),
  });
  const pkg: ApiPackage = {
    language: 'typescript',
    name: 'pkg',
    slug: 'pkg',
    version: '1.0.0',
    description: '',
    directory: 'pkg',
    entries: [root('pkg', '', members), ...entrySlugs.map((slug) => root(`pkg/${slug}`, slug, []))],
  };

  return { packages: [pkg] };
}

describe('URL allocation', () => {
  it('is deterministic and independent of member order', () => {
    const forward = planSymbols(project([symbol('Beta', 'class'), symbol('Alpha', 'class')]));
    const reversed = planSymbols(project([symbol('Alpha', 'class'), symbol('Beta', 'class')]));

    assert.deepEqual(
      forward.pages.map((page) => page.slugs.join('/')).sort(),
      reversed.pages.map((page) => page.slugs.join('/')).sort(),
    );
  });

  it('separates names that differ only by case or kind', () => {
    const table = planSymbols(
      project([symbol('Thing', 'class'), symbol('thing', 'function'), symbol('Thing', 'interface')]),
    );
    const urls = table.pages.map((page) => page.slugs.join('/').toLowerCase());

    assert.equal(new Set(urls).size, urls.length);
    assert.ok(urls.includes('api/typescript/pkg/thing'));
    assert.ok(urls.some((url) => url.endsWith('thing-fn')) || urls.some((url) => url.endsWith('thing-interface')));
  });

  it('never lets an exported symbol shadow an entry-point folder', () => {
    const table = planSymbols(project([symbol('node', 'function')], ['node']));
    const entry = table.pages.find((page) => page.symbol.name === 'pkg/node');
    const fn = table.pages.find((page) => page.symbol.name === 'node');

    assert.deepEqual(entry?.slugs, ['api', 'typescript', 'pkg', 'node']);
    assert.notDeepEqual(fn?.slugs, entry?.slugs);
    assert.equal(fn?.slugs.at(-1), 'node-fn');
  });

  it('turns unsafe characters into safe path segments', () => {
    const table = planSymbols(project([symbol('$store', 'variable')]));

    assert.ok(table.pages.some((page) => page.slugs.at(-1) === '_store'));
  });
});

for (const [label, fixture] of [['TypeScript', typescriptFixture]] as const) {
  describe(`${label} navigation and validation`, async () => {
    const built = await fixture();
    const expected = built.project.packages.map((pkg) => pkg.name);

    it('produces stable URLs: re-planning yields identical locations', () => {
      const again = planSymbols(built.project);

      assert.deepEqual(
        again.pages.map((page) => page.filePath),
        built.table.pages.map((page) => page.filePath),
      );
    });

    it('passes validation without errors', () => {
      const result = validate(built.table, built.files, built.unresolved, expected);

      assert.deepEqual(result.errors, []);
    });

    it('lists every page in exactly one sidebar folder, grouped by kind', () => {
      const paths = new Set(built.files.map(({ page }) => page.path));
      const listed = new Set<string>();

      for (const folder of built.folders) {
        for (const name of folder.pages.filter((entry) => !entry.startsWith('---'))) {
          const target = [`${folder.path}/${name}.mdx`, `${folder.path}/${name}/index.mdx`].find((candidate) =>
            paths.has(candidate),
          );

          assert.ok(target, `${folder.path}/${name} exists as a generated page`);
          listed.add(target);
        }
      }

      for (const path of paths) {
        const isRoot =
          ['api/index.mdx', 'api/typescript/index.mdx', 'api/rust/index.mdx'].includes(path) ||
          /^api\/[^/]+\/[^/]+\/index\.mdx$/.test(path);

        if (!isRoot) assert.ok(listed.has(path), `${path} is reachable from the sidebar`);
      }

      const grouped = built.folders.filter((folder) => folder.pages.some((entry) => entry.startsWith('---')));

      assert.ok(grouped.length > 0, 'symbols are grouped under kind headings');
    });

    it('builds a table of contents whose anchors exist on the page', () => {
      for (const { content } of built.files) {
        if (content.type !== 'symbol') continue;

        const page = content.page;
        const ids = new Set<string>();

        const collect = (node: SymbolNode) => {
          if (node.anchor) ids.add(node.anchor);

          node.members.forEach(collect);
          node.rust?.impls.forEach((impl) => {
            ids.add(impl.anchor);
            impl.items.forEach(collect);
          });
        };

        collect(page.symbol);

        for (const item of page.toc.filter((entry) => entry.depth === 3)) {
          assert.ok(ids.has(item.url.slice(1)), `${page.url}${item.url} has a matching anchor`);
        }
      }
    });
  });
}

describe('validation failures', async () => {
  const built = await typescriptFixture();
  const expected = built.project.packages.map((pkg) => pkg.name);

  it('rejects case-insensitive URL collisions', () => {
    const [first] = built.files;

    assert.ok(first);

    const clash = {
      page: { ...first.page, url: first.page.url.toUpperCase() },
      content: first.content,
    };
    const result = validate(built.table, [...built.files, clash], [], expected);

    assert.ok(result.errors.some((error) => error.includes('URL collision')));
  });

  it('rejects links to pages that do not exist', () => {
    const copy = structuredClone(built.files);
    const target = copy.find(({ content }) => content.type === 'symbol' && content.page.symbol.name === 'load');

    assert.ok(target?.content.type === 'symbol');

    const signature = target.content.page.symbol.signatures[0];
    const parameter = signature?.parameters[1]?.type;

    if (parameter?.kind === 'reference') parameter.href = '/docs/v8/api/typescript/missing/Nope/';

    const first = signature?.parameters[0]?.type;

    if (first?.kind === 'union' && first.types[0]?.kind === 'reference')
      first.types[0].href = '/docs/v8/api/typescript/missing/Nope/';

    const result = validate(built.table, copy, [], expected);

    assert.ok(result.errors.some((error) => error.includes('does not exist')));
  });

  it('rejects packages that produced no symbols', () => {
    const result = validate(built.table, built.files, [], [...expected, '@fx/missing']);

    assert.ok(result.errors.some((error) => error.includes('@fx/missing')));
  });

  it('reports unlinked references as warnings, not errors', () => {
    const result = validate(built.table, built.files, built.unresolved, expected);

    assert.ok(result.warnings.some((warning) => warning.includes('Hidden')));
    assert.deepEqual(result.errors, []);
  });

  it('builds without a project that has no packages', () => {
    const empty = build({ packages: [] });

    assert.deepEqual(empty.table.pages, []);
  });
});
