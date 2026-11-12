import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { OUTPUT_DIR, REPO_ROOT, TYPEDOC_VERSION, TYPESCRIPT_PACKAGES } from './config.ts';
import { resolveLinks } from './links.ts';
import { MANIFEST_SCHEMA_VERSION, type ApiManifest, type ApiPackage, type ApiProject } from './model.ts';
import { normalizeTypeDoc, readTypeDocJson } from './normalize-typedoc.ts';
import { buildModuleEntries, buildPages } from './pages.ts';
import { planSymbols } from './symbols.ts';
import { runTypeDoc } from './typedoc.ts';
import { validate } from './validate.ts';

/** Command-line options of `pnpm docs:api`. */
interface Options {
  strict: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { strict: false };

  for (const arg of argv) {
    if (arg === '--strict') options.strict = true;
    else throw new Error(`Unknown argument ${arg}. Supported: --strict.`);
  }

  return options;
}

/**
 * Commit the source links point at. `DISCORD_PLAYER_DOCS_SOURCE_REF` overrides it; CI uses `GITHUB_SHA`.
 */
function sourceRef(): string {
  const configured = process.env.DISCORD_PLAYER_DOCS_SOURCE_REF ?? process.env.GITHUB_SHA;

  if (configured) return configured;

  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'master';
  }
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

async function buildProject(): Promise<ApiProject> {
  const packages: ApiPackage[] = [];

  for (const config of TYPESCRIPT_PACKAGES) {
    const manifest = await readJson<{ version: string; description?: string }>(
      join(REPO_ROOT, config.directory, 'package.json'),
    );
    const result = await runTypeDoc(config);

    packages.push(
      normalizeTypeDoc({
        package: config,
        project: await readTypeDocJson(result.file),
        version: manifest.version,
        description: manifest.description ?? '',
      }),
    );
  }

  return { packages };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const ref = sourceRef();
  const project = await buildProject();
  const table = planSymbols(project);

  buildModuleEntries(table);

  const unresolved = resolveLinks(table);
  const built = buildPages(table, project, ref);
  const expected = project.packages.map((pkg) => pkg.name);
  const result = validate(table, built.files, unresolved, expected);

  for (const warning of result.warnings) console.warn(`warning: ${warning}`);

  if (result.errors.length > 0 || (options.strict && result.warnings.length > 0)) {
    for (const error of result.errors) console.error(`error: ${error}`);

    throw new Error(`API documentation validation failed with ${result.errors.length} error(s).`);
  }

  const manifest: ApiManifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    generator: {
      typedoc: TYPEDOC_VERSION,
    },
    sourceRef: ref,
    pages: built.files.map((entry) => entry.page),
    folders: built.folders,
    packages: project.packages.map((pkg) => ({
      language: pkg.language,
      name: pkg.name,
      slug: pkg.slug,
      url: `/docs/v8/api/${pkg.language}/${pkg.slug}/`,
      version: pkg.version,
      description: pkg.description,
    })),
    unresolved,
  };

  await rm(join(OUTPUT_DIR, 'pages'), { recursive: true, force: true });

  for (const { page, content } of built.files) {
    const file = join(OUTPUT_DIR, page.file);

    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(content));
  }

  await writeFile(join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest));

  const symbols = built.files.filter((entry) => entry.page.type === 'symbol').length;

  console.log(
    `Generated ${built.files.length} API pages (${symbols} symbols) for ${project.packages.length} packages in ${((Date.now() - started) / 1000).toFixed(1)}s; ${unresolved.length} unlinked references.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
