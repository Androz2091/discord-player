/**
 * Normalized API documentation model shared by the generation pipeline and the Fumadocs renderer.
 *
 * TypeDoc reflections and rustdoc items are both converted into these types. Language-specific data
 * stays available through {@link SymbolBase.ts} and {@link SymbolBase.rust} rather than being flattened.
 * This file contains only types so the Next.js app can import it without bundling the generator.
 */

/** Source language of a documented symbol. */
export type Language = 'typescript' | 'rust';

/** Normalized symbol kind. Language-specific names are kept in {@link SymbolBase.languageKind}. */
export type SymbolKind =
  | 'package'
  | 'module'
  | 'namespace'
  | 'class'
  | 'interface'
  | 'type-alias'
  | 'enum'
  | 'function'
  | 'variable'
  | 'struct'
  | 'union'
  | 'trait'
  | 'trait-alias'
  | 'constant'
  | 'static'
  | 'macro'
  | 'primitive'
  | 'constructor'
  | 'method'
  | 'property'
  | 'accessor'
  | 'enum-member'
  | 'index-signature'
  | 'field'
  | 'variant'
  | 'associated-type'
  | 'associated-constant';

/**
 * Structured identity of a documented symbol. References are resolved by comparing these
 * identities (through {@link symbolKey}), never by matching display names in text.
 */
export interface SymbolId {
  language: Language;
  /** npm package name or crate package name, for example `@remedia/client` or `remedia-core`. */
  package: string;
  /**
   * TypeScript: declaring file relative to the package root (TypeDoc `packagePath`).
   * Rust: empty.
   */
  file: string;
  /**
   * TypeScript: TypeDoc qualified name split on `.`. Rust: the defining module path including
   * the item name, without the crate name.
   */
  path: string[];
  /** Rust namespace (`type`, `value`, `macro`) or empty for TypeScript. */
  namespace: string;
}

/** Canonical string form of a {@link SymbolId}, used only as a map key. */
export function symbolKey(id: SymbolId): string {
  return JSON.stringify([id.language, id.package, id.file, id.path, id.namespace]);
}

/** Link target for text inside documentation comments. */
export interface DocLink {
  /** Key of a documented symbol in the same API model. */
  target?: string;
  /** Final site-relative URL, filled by link resolution. */
  href?: string;
  /** Absolute URL of external documentation. */
  external?: string;
}

/** Markdown with structured link destinations. */
export interface DocText {
  markdown: string;
  /**
   * Link destinations keyed by the exact destination or label text used in `markdown`. TypeScript
   * `{@link}` tags are rewritten to `ref:N` destinations. Rust intra-doc links keep their written text.
   */
  links?: Record<string, DocLink>;
}

/** One `@example` block or Rust `# Examples` section. */
export interface DocExample {
  title?: string;
  body: DocText;
}

/** Named documentation section such as Rust `# Errors` or a generic block tag. */
export interface DocSection {
  title: string;
  body: DocText;
}

/** Documentation attached to a symbol or one signature. */
export interface Docs {
  summary?: DocText;
  remarks?: DocText;
  examples: DocExample[];
  /** Present when the symbol is deprecated; the markdown may be empty. */
  deprecated?: DocText;
  throws: DocText[];
  see: DocText[];
  sections: DocSection[];
  /** Release-stage and other modifier tags, for example `beta` or `experimental`. */
  modifiers: string[];
}

/** Reference to documentation that is not part of this site. */
export interface ExternalRef {
  /** Package or crate that declares the symbol, for example `typescript` or `std`. */
  package: string;
  /** Absolute documentation URL when a stable one is known. */
  url?: string;
  /** TypeScript qualified symbol name used to look up documentation, for example `Promise`. */
  symbol?: string;
}

/** Bound on a type parameter, `impl Trait`, or `dyn Trait`. */
export type Bound =
  | { kind: 'trait'; trait: TypeExpr; modifier?: string; higherRanked?: string[] }
  | { kind: 'outlives'; lifetime: string };

/** Generic parameter. */
export interface TypeParameter {
  name: string;
  /** `type`, `lifetime`, or `const`. */
  paramKind: 'type' | 'lifetime' | 'const';
  /** TypeScript `extends` constraint or Rust bounds. */
  bounds: Bound[];
  default?: TypeExpr;
  /** Type of a Rust const generic. */
  constType?: TypeExpr;
  /** TypeScript variance and `const` modifiers. */
  modifiers: string[];
  docs?: DocText;
}

/** Rust `where` predicate. */
export interface WherePredicate {
  /** Bounded type, or lifetime for lifetime predicates. */
  subject: TypeExpr | { kind: 'lifetime'; name: string };
  bounds: Bound[];
}

/** Function, method, or constructor parameter. */
export interface Parameter {
  name: string;
  type?: TypeExpr;
  optional: boolean;
  rest: boolean;
  /** Source text of a TypeScript default value. */
  defaultValue?: string;
  docs?: DocText;
}

/** One signature. TypeScript overloads are separate signatures of the same symbol. */
export interface Signature {
  name: string;
  /** `call`, `construct`, `get`, or `set` for TypeScript; `fn` for Rust. */
  signatureKind: 'call' | 'construct' | 'get' | 'set' | 'fn';
  typeParameters: TypeParameter[];
  /** Rust receiver such as `&mut self`; undefined for associated functions and TypeScript. */
  receiver?: string;
  parameters: Parameter[];
  returns?: { type: TypeExpr; docs?: DocText };
  whereClauses: WherePredicate[];
  /** Rust qualifiers such as `const`, `async`, `unsafe` or `extern "C"`. */
  qualifiers: string[];
  docs: Docs;
}

/** Type expression. Reference nodes carry structured targets, never only names. */
export type TypeExpr =
  | {
      kind: 'reference';
      name: string;
      /** Key of the referenced symbol when it belongs to this API model. */
      target?: string;
      /** Site-relative URL filled by link resolution. */
      href?: string;
      external?: ExternalRef;
      args?: TypeExpr[];
      /** Rust associated-type bindings written as `Name = Type`. */
      bindings?: { name: string; type?: TypeExpr; bounds?: Bound[] }[];
      /** Rust `Fn(A, B) -> C` sugar: `args` are the inputs and the `Output` binding the return type. */
      fnSugar?: boolean;
      /** TypeScript package-qualified name used for diagnostics when a target cannot be resolved. */
      qualified?: string;
    }
  | { kind: 'type-parameter'; name: string }
  | { kind: 'intrinsic'; name: string }
  | { kind: 'literal'; value: string }
  | { kind: 'union'; types: TypeExpr[] }
  | { kind: 'intersection'; types: TypeExpr[] }
  | { kind: 'array'; element: TypeExpr }
  | { kind: 'tuple'; elements: TypeExpr[]; names?: (string | undefined)[] }
  | { kind: 'function'; constructor: boolean; signature: Signature }
  | { kind: 'object'; members: SymbolNode[] }
  | { kind: 'operator'; operator: string; target: TypeExpr }
  | { kind: 'indexed-access'; object: TypeExpr; index: TypeExpr }
  | {
      kind: 'conditional';
      check: TypeExpr;
      extends: TypeExpr;
      trueType: TypeExpr;
      falseType: TypeExpr;
    }
  | {
      kind: 'mapped';
      parameter: string;
      source: TypeExpr;
      nameType?: TypeExpr;
      template: TypeExpr;
      readonly?: string;
      optional?: string;
    }
  | { kind: 'query'; target: TypeExpr }
  | { kind: 'predicate'; name: string; asserts: boolean; type?: TypeExpr }
  | { kind: 'template-literal'; head: string; tail: { type: TypeExpr; text: string }[] }
  | { kind: 'rest'; element: TypeExpr }
  | { kind: 'optional'; element: TypeExpr }
  | { kind: 'named-member'; name: string; optional: boolean; element: TypeExpr }
  | { kind: 'infer'; name: string; constraint?: TypeExpr }
  | { kind: 'borrowed'; mutable: boolean; lifetime?: string; type: TypeExpr }
  | { kind: 'pointer'; mutable: boolean; type: TypeExpr }
  | { kind: 'slice'; element: TypeExpr }
  | { kind: 'fixed-array'; element: TypeExpr; length: string }
  | { kind: 'impl-trait'; bounds: Bound[] }
  | { kind: 'dyn-trait'; bounds: Bound[]; lifetime?: string }
  | {
      kind: 'qualified-path';
      self: TypeExpr;
      /** `Trait` the associated item is selected through, when written as `<T as Trait>::Name`. */
      trait?: TypeExpr;
      name: string;
      /** Key of the associated item when it resolves inside this API model. */
      target?: string;
      href?: string;
    }
  | { kind: 'placeholder' }
  | { kind: 'unknown'; text: string };

/** Location of a declaration in the repository. */
export interface SourceLocation {
  /** Repository-relative path using forward slashes. */
  file: string;
  line: number;
  endLine?: number;
}

/** Entry in a module-like index. */
export interface ModuleEntry {
  name: string;
  kind: SymbolKind;
  /** Target symbol key. */
  target: string;
  /** Site-relative URL filled by link resolution. */
  href?: string;
  summary?: string;
  deprecated?: boolean;
  /** Present when the entry is shown here through a re-export under this name. */
  reexport?: boolean;
}

/** Rust `impl` block. */
export interface RustImpl {
  anchor: string;
  /** `inherent`, `trait`, `auto`, or `blanket`. */
  implKind: 'inherent' | 'trait' | 'auto' | 'blanket';
  trait?: TypeExpr;
  forType: TypeExpr;
  typeParameters: TypeParameter[];
  whereClauses: WherePredicate[];
  negative: boolean;
  unsafe: boolean;
  docs: Docs;
  items: SymbolNode[];
  source?: SourceLocation;
}

/** Type that implements a documented trait. */
export interface Implementor {
  forType: TypeExpr;
  implKind: 'trait' | 'auto' | 'blanket';
  /** Anchor of the `impl` block on the implementing type's page, when documented there. */
  anchor?: string;
  /** Key of the implementing symbol when it belongs to this model. */
  target?: string;
  href?: string;
}

/** TypeScript-specific data. */
export interface TypeScriptData {
  /** TypeDoc reflection kind name, for example `Class` or `Method`. */
  entryPoint: string;
  /** Names of base types, for inherited member provenance. */
  inheritedFrom?: TypeExpr;
  overwrites?: TypeExpr;
  implementationOf?: TypeExpr;
  /** Heritage tree children for `extendedBy` / `implementedBy`. */
  extendedBy?: TypeExpr[];
  implementedBy?: TypeExpr[];
  /** Enum member value or variable initializer source. */
  value?: string;
  /** True when the symbol is `declare`d in generated N-API declarations. */
  generated?: boolean;
}

/** Rust-specific data. */
export interface RustData {
  /** Declared visibility, for example `pub` or `pub(crate)`. */
  visibility: string;
  /** Trait-specific flags. */
  traitFlags: string[];
  /** Attribute text worth showing, such as `#[non_exhaustive]` or `#[must_use]`. */
  attributes: string[];
  /** Struct shape. */
  structKind?: 'unit' | 'tuple' | 'plain';
  /** Fields or variant payload hidden from documentation by `#[doc(hidden)]` or privacy. */
  hasStrippedFields?: boolean;
  /** Enum discriminant expression. */
  discriminant?: string;
  /** Required (`false`) or provided (`true`) trait item. */
  provided?: boolean;
  /** Implementations of the item. */
  impls: RustImpl[];
  /** Types implementing this trait. */
  implementors: Implementor[];
  /** Supertraits and trait-alias bounds. */
  bounds: Bound[];
  /** Public paths from which this item is also reachable. */
  reexportedAs: string[];
}

/** Fields shared by every documented symbol and member. */
export interface SymbolBase {
  key: string;
  id: SymbolId;
  name: string;
  kind: SymbolKind;
  /** Name used by the source language, for example `Class`, `Struct`, or `Trait`. */
  languageKind: string;
  language: Language;
  docs: Docs;
  /** Modifiers such as `static`, `readonly`, `optional`, `protected`, `abstract`, or `async`. */
  flags: string[];
  typeParameters: TypeParameter[];
  signatures: Signature[];
  /** Property, variable, alias, constant, or field type. */
  type?: TypeExpr;
  /** Initializer or constant expression source. */
  value?: string;
  /** TypeScript `extends`; Rust supertrait bounds are kept in `rust.bounds`. */
  extends: TypeExpr[];
  implements: TypeExpr[];
  whereClauses: WherePredicate[];
  source?: SourceLocation;
  ts?: TypeScriptData;
  rust?: RustData;
}

/** A symbol or member in the normalized tree. */
export interface SymbolNode extends SymbolBase {
  /** Stable fragment identifier on the page that owns the symbol. Only set for members. */
  anchor?: string;
  /** Direct members: properties, methods, enum members, struct fields, variants, trait items. */
  members: SymbolNode[];
  /** Entries for modules, namespaces and package indexes. */
  entries: ModuleEntry[];
}

/** Public package or crate. */
export interface ApiPackage {
  language: Language;
  /** npm package or crate name. */
  name: string;
  /** URL path segment under the language. */
  slug: string;
  version: string;
  description: string;
  /** Repository-relative package directory. */
  directory: string;
  /** Entry points (TypeScript) or the crate root (Rust). */
  entries: ApiEntry[];
}

/** Package entry point. */
export interface ApiEntry {
  /** Export subpath such as `.` or `./node`; Rust uses `.`. */
  subpath: string;
  /** URL path segment; empty for the primary entry point. */
  slug: string;
  title: string;
  description: string;
  /** True for generated declarations that are not a published export subpath. */
  generated: boolean;
  root: SymbolNode;
}

/** Complete normalized API model before page allocation. */
export interface ApiProject {
  packages: ApiPackage[];
}

/** Table-of-contents item in Fumadocs shape. */
export interface TocEntry {
  title: string;
  url: string;
  depth: number;
}

/** Page for one documented symbol. */
export interface ApiPage {
  /** URL segments below the docs route, for example `['api', 'typescript', 'client', 'RemediaClient']`. */
  slugs: string[];
  /** Site-relative URL with trailing slash. */
  url: string;
  title: string;
  description: string;
  language: Language;
  package: string;
  packageSlug: string;
  /** Primary symbol rendered on the page. */
  symbol: SymbolNode;
  /** Package-qualified path shown above the title. */
  qualifiedName: string;
  /** Breadcrumb items below the API Reference root. */
  breadcrumbs: { title: string; url: string }[];
  toc: TocEntry[];
  /** GitHub URL of the primary declaration. */
  sourceUrl?: string;
  /** Group label used in the sidebar, for example `Classes`. */
  group: string;
}

/** Package or crate card on an overview page. */
export interface OverviewPackage {
  name: string;
  description: string;
  url: string;
  version: string;
  language: Language;
  /** Number of documented top-level symbols. */
  symbols: number;
  entries: { title: string; url: string; description: string }[];
}

/** Overview page listing packages. */
export interface OverviewPage {
  slugs: string[];
  url: string;
  title: string;
  description: string;
  /** Language this overview covers; undefined for the API root. */
  language?: Language;
  packages: OverviewPackage[];
  toc: TocEntry[];
}

/** Contents of one generated page file. */
export type ApiPageFile = { type: 'symbol'; page: ApiPage } | { type: 'overview'; page: OverviewPage };

/** Sidebar node description used to emit Fumadocs meta files. */
export interface NavFolder {
  /** Directory below the docs content root, for example `api/typescript/client`. */
  path: string;
  title: string;
  pages: string[];
  defaultOpen?: boolean;
}

/** Lightweight page record in the manifest. Page bodies live in separate JSON files. */
export interface ManifestPage {
  type: 'symbol' | 'overview';
  slugs: string[];
  /** Virtual content path, for example `api/rust/remedia-core/index.mdx`. */
  path: string;
  url: string;
  title: string;
  description: string;
  language: Language;
  package: string;
  packageSlug: string;
  kind: SymbolKind;
  /** Page body file relative to the generated pages directory. */
  file: string;
  toc: TocEntry[];
  /** Sidebar group heading used by the package index. */
  group: string;
  /** Whether the page is a package, module, or overview index. */
  index: boolean;
  /** Repository-relative source file of the primary declaration. */
  sourceFile?: string;
  /** Plain search content split into sections. */
  search: {
    headings: { id: string; content: string }[];
    contents: { heading: string; content: string }[];
  };
}

/** Output manifest read by the Next.js app. */
export interface ApiManifest {
  /** Increment when the layout of generated files changes. */
  schemaVersion: number;
  generator: { typedoc: string };
  /** Repository ref used for source links. */
  sourceRef: string;
  pages: ManifestPage[];
  folders: NavFolder[];
  packages: {
    language: Language;
    name: string;
    slug: string;
    url: string;
    version: string;
    description: string;
  }[];
  /** Diagnostics collected during link resolution. */
  unresolved: UnresolvedReference[];
}

/** Reference that could not be linked. */
export interface UnresolvedReference {
  page: string;
  name: string;
  /** Why the reference has no link. */
  reason: 'external' | 'missing' | 'not-exported';
  qualified?: string;
}

/** Version of the generated manifest layout. */
export const MANIFEST_SCHEMA_VERSION = 1;
