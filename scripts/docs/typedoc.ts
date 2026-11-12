import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Application, ReflectionKind, TSConfigReader, type JSONOutput, type NormalizedPath } from 'typedoc';

import { RAW_DIR, REPO_ROOT, TYPEDOC_SCHEMA_VERSION, TYPEDOC_VERSION, type TypeScriptPackageConfig } from './config.ts';

/** Path of the TypeScript configuration TypeDoc compiles with. */
const TSCONFIG = join(REPO_ROOT, 'scripts', 'docs', 'tsconfig.typedoc.json');

/** Overrides used by tests to document fixture packages. */
export interface TypeDocRunOptions {
  /** TypeScript configuration; defaults to the repository's documentation configuration. */
  tsconfig?: string;
  /** Directory `pkg.directory` and source paths are relative to; defaults to the repository root. */
  root?: string;
  rawDir?: string;
}

/** Result of one package conversion. */
export interface TypeDocResult {
  package: TypeScriptPackageConfig;
  /** Absolute path of the raw JSON reflection file. */
  file: string;
  /** Warnings TypeDoc reported while converting, kept for diagnostics. */
  warnings: string[];
}

/**
 * Raised when the installed TypeDoc or its JSON format differs from the pinned versions the
 * normalizer was written against.
 */
export class TypeDocFormatError extends Error {}

/**
 * Convert one package's public entry points to TypeDoc JSON.
 *
 * Only `exports`-reachable declarations are converted. `@internal`, `@hidden`, `@ignore`, and
 * private members are excluded by TypeDoc; protected members are kept because subclasses can use them.
 *
 * @param pkg Package entry points and directory.
 * @returns The raw JSON location and any conversion warnings.
 */
export async function runTypeDoc(
  pkg: TypeScriptPackageConfig,
  options: TypeDocRunOptions = {},
): Promise<TypeDocResult> {
  const rawDir = options.rawDir ?? RAW_DIR;
  const root = options.root ?? REPO_ROOT;

  const app = await Application.bootstrapWithPlugins(
    {
      name: pkg.name,
      entryPoints: pkg.entries.map((entry) => resolve(root, pkg.directory, entry.file)),
      entryPointStrategy: 'resolve',
      tsconfig: options.tsconfig ?? TSCONFIG,
      basePath: root,
      excludeInternal: true,
      excludePrivate: true,
      excludeProtected: false,
      excludeExternals: true,
      excludeNotDocumented: false,
      excludeReferences: false,
      skipErrorChecking: true,
      readme: 'none',
      sort: ['source-order'],
      logLevel: 'Warn',
      gitRevision: 'main',
      disableGit: true,
      sourceLinkTemplate: 'https://github.invalid/{path}#L{line}',
      validation: { notExported: false, invalidLink: false, notDocumented: false },
    },
    [new TSConfigReader()],
  );

  if (app.options.getValue('plugin').length > 0) {
    throw new TypeDocFormatError('Documentation generation must not load TypeDoc plugins.');
  }

  assertTypeDocFormat(Application.VERSION);

  const warnings: string[] = [];
  const project = await app.convert();

  if (!project) throw new Error(`TypeDoc could not convert ${pkg.name}.`);

  const json = app.serializer.projectToObject(project, root as NormalizedPath);

  assertSchema(json);

  await mkdir(rawDir, { recursive: true });

  const file = join(rawDir, `typedoc-${pkg.slug}.json`);

  await writeFile(file, JSON.stringify(json));

  return { package: pkg, file, warnings };
}

/**
 * Validate the TypeDoc version and reflection-kind numbering the normalizer depends on.
 *
 * @param version Installed TypeDoc version.
 * @throws {TypeDocFormatError} When the version or kind constants differ from the pinned values.
 */
export function assertTypeDocFormat(version: string): void {
  if (version !== TYPEDOC_VERSION) {
    throw new TypeDocFormatError(
      `Expected TypeDoc ${TYPEDOC_VERSION} but ${version} is installed. Update scripts/docs/config.ts and re-validate normalize.ts together.`,
    );
  }

  const expected: Record<string, number> = {
    Project: 1,
    Module: 2,
    Namespace: 4,
    Enum: 8,
    EnumMember: 16,
    Variable: 32,
    Function: 64,
    Class: 128,
    Interface: 256,
    Constructor: 512,
    Property: 1024,
    Method: 2048,
    CallSignature: 4096,
    IndexSignature: 8192,
    ConstructorSignature: 16384,
    Parameter: 32768,
    TypeLiteral: 65536,
    TypeParameter: 131072,
    Accessor: 262144,
    GetSignature: 524288,
    SetSignature: 1048576,
    TypeAlias: 2097152,
    Reference: 4194304,
  };

  for (const [name, value] of Object.entries(expected)) {
    const actual = (ReflectionKind as unknown as Record<string, number>)[name];

    if (actual !== value) {
      throw new TypeDocFormatError(`TypeDoc ReflectionKind.${name} is ${actual}, expected ${value}.`);
    }
  }
}

/**
 * Check the schema version recorded in a serialized project.
 *
 * @param json Serialized TypeDoc project.
 * @throws {TypeDocFormatError} When `schemaVersion` differs from the supported version.
 */
export function assertSchema(json: JSONOutput.ProjectReflection): void {
  if (json.schemaVersion !== TYPEDOC_SCHEMA_VERSION) {
    throw new TypeDocFormatError(
      `Unsupported TypeDoc JSON schema ${json.schemaVersion}; expected ${TYPEDOC_SCHEMA_VERSION}.`,
    );
  }
}
