import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { TypeScriptPackageConfig } from '../config.ts';
import { resolveLinks } from '../links.ts';
import type { ApiProject, SymbolNode } from '../model.ts';
import { normalizeTypeDoc, readTypeDocJson } from '../normalize-typedoc.ts';
import { buildModuleEntries, buildPages } from '../pages.ts';
import { planSymbols, type SymbolTable } from '../symbols.ts';
import { runTypeDoc } from '../typedoc.ts';

const here = dirname(fileURLToPath(import.meta.url));

/** Result of running the full pipeline over a normalized project. */
export interface Built {
  project: ApiProject;
  table: SymbolTable;
  files: ReturnType<typeof buildPages>['files'];
  folders: ReturnType<typeof buildPages>['folders'];
  unresolved: ReturnType<typeof resolveLinks>;
}

/** Run planning, entry building, link resolution, and page building. */
export function build(project: ApiProject): Built {
  const table = planSymbols(project);

  buildModuleEntries(table);

  const unresolved = resolveLinks(table);
  const pages = buildPages(table, project, 'testref');

  return { project, table, files: pages.files, folders: pages.folders, unresolved };
}

const tsRoot = join(here, 'fixtures', 'ts');

const tsPackages: TypeScriptPackageConfig[] = [
  {
    name: '@fx/base',
    slug: 'base',
    directory: 'base',
    entries: [
      {
        subpath: '.',
        file: 'src/index.ts',
        slug: '',
        title: '@fx/base',
        description: 'Base fixture',
      },
    ],
  },
  {
    name: '@fx/app',
    slug: 'app',
    directory: 'app',
    entries: [
      {
        subpath: '.',
        file: 'src/index.ts',
        slug: '',
        title: '@fx/app',
        description: 'App fixture',
      },
    ],
  },
];

let typescript: Promise<Built> | undefined;

/** Document the TypeScript fixture packages with the real TypeDoc pipeline (memoized). */
export function typescriptFixture(): Promise<Built> {
  typescript ??= (async () => {
    const rawDir = await mkdtemp(join(tmpdir(), 'discord-player-docs-ts-'));
    const packages = [];

    for (const config of tsPackages) {
      const result = await runTypeDoc(config, {
        root: tsRoot,
        tsconfig: join(tsRoot, 'tsconfig.json'),
        rawDir,
      });

      packages.push(
        normalizeTypeDoc({
          package: config,
          project: await readTypeDocJson(result.file),
          version: '1.0.0',
          description: config.entries[0]?.description ?? '',
          workspacePackages: tsPackages.map((pkg) => pkg.name),
        }),
      );
    }

    return build({ packages });
  })();

  return typescript;
}

/** Find a page symbol by package and name. */
export function pageOf(built: Built, pkg: string, name: string) {
  const page = built.table.pages.find((candidate) => candidate.pkg.name === pkg && candidate.symbol.name === name);

  if (!page)
    throw new Error(
      `No page ${pkg}/${name}. Pages: ${built.table.pages.map((p) => p.pkg.name + '/' + p.symbol.name).join(', ')}`,
    );

  return page;
}

/** Find a direct member by name. */
export function member(symbol: SymbolNode, name: string): SymbolNode {
  const found = symbol.members.find((candidate) => candidate.name === name);

  if (!found) throw new Error(`No member ${name} in ${symbol.name}: ${symbol.members.map((m) => m.name).join(', ')}`);

  return found;
}
