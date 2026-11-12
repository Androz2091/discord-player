import { readFile } from 'node:fs/promises';
import type { JSONOutput } from 'typedoc';

import { TYPESCRIPT_PACKAGES, type TypeScriptEntryConfig, type TypeScriptPackageConfig } from './config.ts';
import { createNode, docText, emptyDocs } from './docs-util.ts';
import {
  symbolKey,
  type ApiEntry,
  type ApiPackage,
  type Bound,
  type DocLink,
  type DocText,
  type Docs,
  type ModuleEntry,
  type Parameter,
  type Signature,
  type SourceLocation,
  type SymbolId,
  type SymbolKind,
  type SymbolNode,
  type TypeExpr,
  type TypeParameter,
} from './model.ts';

/** TypeDoc `ReflectionKind` values, validated against the installed TypeDoc by `assertTypeDocFormat`. */
const Kind = {
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
} as const;

type Reflection = JSONOutput.DeclarationReflection;
type SignatureReflection = JSONOutput.SignatureReflection;
type JsonType = JSONOutput.SomeType;
type Comment = JSONOutput.Comment;
type Part = JSONOutput.CommentDisplayPart;
type SymbolIdJson = JSONOutput.ReflectionSymbolId;

/** Inputs for converting one TypeDoc project. */
export interface NormalizeTypeDocOptions {
  package: TypeScriptPackageConfig;
  project: JSONOutput.ProjectReflection;
  /** Package version from package.json. */
  version: string;
  /** Package names documented together; references to them are never treated as external. */
  workspacePackages?: string[];
  description: string;
}

/** Read a raw TypeDoc JSON file. */
export async function readTypeDocJson(file: string): Promise<JSONOutput.ProjectReflection> {
  return JSON.parse(await readFile(file, 'utf8')) as JSONOutput.ProjectReflection;
}

/**
 * Convert TypeDoc reflections to the shared symbol model.
 *
 * @param options Package configuration and parsed TypeDoc output.
 * @returns A package with one root module per configured entry point.
 */
export function normalizeTypeDoc(options: NormalizeTypeDocOptions): ApiPackage {
  return new TypeDocNormalizer(options).run();
}

class TypeDocNormalizer {
  readonly #pkg: TypeScriptPackageConfig;
  readonly #project: JSONOutput.ProjectReflection;
  readonly #version: string;
  readonly #description: string;
  readonly #workspace: Set<string>;
  /** Reflection id to the key of its normalized symbol. */
  readonly #keys = new Map<number, string>();
  /** Reflection id to reflection, for type parameter and reference lookups. */
  readonly #reflections = new Map<number, Reflection | SignatureReflection>();
  #links: Record<string, DocLink> = {};
  #linkCount = 0;

  constructor(options: NormalizeTypeDocOptions) {
    this.#pkg = options.package;
    this.#project = options.project;
    this.#version = options.version;
    this.#description = options.description;
    this.#workspace = new Set(options.workspacePackages ?? TYPESCRIPT_PACKAGES.map((pkg) => pkg.name));
  }

  run(): ApiPackage {
    const modules = this.#modules();

    for (const [, children] of modules) this.#register(children);

    const entries = this.#pkg.entries.map((entry): ApiEntry => {
      const children = modules.get(entry.file) ?? [];

      return this.#entry(entry, children);
    });

    return {
      language: 'typescript',
      name: this.#pkg.name,
      slug: this.#pkg.slug,
      version: this.#version,
      description: this.#description,
      directory: this.#pkg.directory,
      entries,
    };
  }

  /** Map configured entry files to the reflections TypeDoc exported from them. */
  #modules(): Map<string, Reflection[]> {
    const result = new Map<string, Reflection[]>();
    const top = (this.#project.children ?? []) as Reflection[];
    const isModuleProject = top.length > 0 && top.every((child) => child.kind === Kind.Module);

    if (!isModuleProject) {
      const only = this.#pkg.entries[0];

      if (only) result.set(only.file, top);

      return result;
    }

    for (const entryModule of top) {
      const file = entryModule.sources?.[0]?.fileName;
      const entry = this.#pkg.entries.find((candidate) => file === `${this.#pkg.directory}/${candidate.file}`);

      if (entry) result.set(entry.file, (entryModule.children ?? []) as Reflection[]);
    }

    return result;
  }

  #entry(config: TypeScriptEntryConfig, children: Reflection[]): ApiEntry {
    const file = config.file;
    const id: SymbolId = {
      language: 'typescript',
      package: this.#pkg.name,
      file,
      path: [],
      namespace: config.slug,
    };
    const root = createNode({
      key: symbolKey(id),
      id,
      name: config.title,
      kind: 'module',
      languageKind: config.generated ? 'Generated declarations' : 'Entry point',
      language: 'typescript',
    });

    for (const child of children) {
      if (child.variant === 'reference') {
        const entry = this.#referenceEntry(child);

        if (entry) root.entries.push(entry);

        continue;
      }

      const node = this.#declaration(child, [], 'top');

      if (node) {
        if (config.generated) node.ts = { ...(node.ts ?? { entryPoint: '' }), generated: true };

        root.members.push(node);
      }
    }

    return {
      subpath: config.subpath,
      slug: config.slug,
      title: config.title,
      description: config.description,
      generated: config.generated === true,
      root,
    };
  }

  /** Re-export under another name. */
  #referenceEntry(reflection: Reflection): ModuleEntry | undefined {
    const target = (reflection as unknown as { target?: number | SymbolIdJson }).target;
    const key = this.#targetKey(target);

    if (!key) return undefined;

    return { name: reflection.name, kind: 'type-alias', target: key, reexport: true };
  }

  /** First pass: assign keys to every declaration so references can be resolved by identity. */
  #register(children: Reflection[]): void {
    const visit = (reflection: Reflection, parentPath: string[], parent: SymbolId | undefined) => {
      this.#reflections.set(reflection.id, reflection);

      if (reflection.variant === 'reference') return;

      const id = this.#symbolId(reflection, parentPath, parent);

      if (!id) return;

      this.#keys.set(reflection.id, symbolKey(id));

      for (const signature of reflection.signatures ?? []) this.#reflections.set(signature.id, signature);

      for (const parameterSource of [
        ...(reflection.signatures ?? []),
        ...(reflection.getSignature ? [reflection.getSignature] : []),
        ...(reflection.setSignature ? [reflection.setSignature] : []),
      ]) {
        this.#reflections.set(parameterSource.id, parameterSource);

        for (const typeParameter of parameterSource.typeParameters ?? []) {
          this.#reflections.set(typeParameter.id, typeParameter as unknown as Reflection);
        }
      }

      for (const typeParameter of reflection.typeParameters ?? []) {
        this.#reflections.set(typeParameter.id, typeParameter as unknown as Reflection);
      }

      for (const child of (reflection.children ?? []) as Reflection[]) {
        visit(child, id.path, id);
      }
    };

    for (const child of children) visit(child, [], undefined);
  }

  /** Structured identity for a declaration. Members are scoped by their parent's identity. */
  #symbolId(reflection: Reflection, parentPath: string[], parent: SymbolId | undefined): SymbolId | undefined {
    if (parent) {
      return {
        language: 'typescript',
        package: parent.package,
        file: parent.file,
        path: [...parentPath, reflection.name],
        namespace: reflection.flags?.isStatic ? 'static' : '',
      };
    }

    const symbol = (this.#project.symbolIdMap as unknown as Record<number, SymbolIdJson> | undefined)?.[reflection.id];

    if (!symbol) return undefined;

    return {
      language: 'typescript',
      package: symbol.packageName,
      file: symbol.packagePath,
      path: symbol.qualifiedName.split('.'),
      namespace: '',
    };
  }

  /** Resolve a TypeDoc reference target to a model symbol key. */
  #targetKey(target: number | SymbolIdJson | string | undefined): string | undefined {
    if (typeof target === 'number') return this.#keys.get(target) ?? this.#keyFromSymbolMap(target);

    if (target && typeof target === 'object') {
      return symbolKey({
        language: 'typescript',
        package: target.packageName,
        file: target.packagePath,
        path: target.qualifiedName.split('.'),
        namespace: '',
      });
    }

    return undefined;
  }

  #keyFromSymbolMap(id: number): string | undefined {
    const symbol = (this.#project.symbolIdMap as unknown as Record<number, SymbolIdJson> | undefined)?.[id];

    return symbol ? this.#targetKey(symbol) : undefined;
  }

  #declaration(
    reflection: Reflection,
    parentPath: string[],
    scope: 'top' | 'member',
    parent?: SymbolId,
  ): SymbolNode | undefined {
    if (reflection.variant === 'reference') return undefined;

    const id = this.#symbolId(reflection, parentPath, parent);

    if (!id) return undefined;

    const kind = this.#kind(reflection.kind);

    if (!kind) return undefined;

    const inherited = reflection.inheritedFrom;

    if (inherited && this.#isExternalSource(inherited)) return undefined;

    const node = createNode({
      key: symbolKey(id),
      id,
      name: reflection.name,
      kind,
      languageKind: kindName(reflection.kind),
      language: 'typescript',
      flags: this.#flags(reflection),
    });

    if (scope === 'member') node.anchor = memberAnchor(node);

    const source = this.#source(reflection.sources?.[0]);

    if (source) node.source = source;

    const comment = reflection.comment ?? reflection.signatures?.[0]?.comment;

    if (reflection.comment) node.docs = this.#docs(reflection.comment);
    else if (reflection.getSignature?.comment) node.docs = this.#docs(reflection.getSignature.comment);
    else if (!reflection.signatures && comment) node.docs = this.#docs(comment);

    node.typeParameters = (reflection.typeParameters ?? []).map((parameter) => this.#typeParameter(parameter));

    if (reflection.type) node.type = this.#type(reflection.type);

    if (reflection.defaultValue && isShortValue(reflection.defaultValue)) node.value = reflection.defaultValue;

    if (reflection.kind === Kind.EnumMember && reflection.type?.type === 'literal') {
      node.value = literalText(reflection.type.value);
    }

    node.extends = (reflection.extendedTypes ?? []).map((type) => this.#type(type));
    node.implements = (reflection.implementedTypes ?? []).map((type) => this.#type(type));

    node.signatures = this.#signatures(reflection);
    node.ts = this.#tsData(reflection);

    if (reflection.kind === Kind.Accessor && reflection.getSignature?.type) {
      node.type = this.#type(reflection.getSignature.type);
    }

    if (reflection.kind === Kind.Accessor && !reflection.setSignature && !node.flags.includes('readonly')) {
      node.flags.push('readonly');
    }

    for (const child of (reflection.children ?? []) as Reflection[]) {
      const childScope = reflection.kind === Kind.Namespace || reflection.kind === Kind.Module ? 'top' : 'member';
      const member = this.#declaration(child, id.path, childScope, id);

      if (member) node.members.push(member);
    }

    for (const index of reflection.indexSignatures ?? []) {
      node.members.push(this.#indexSignature(index, id));
    }

    this.#ensureUniqueAnchors(node);

    return node;
  }

  #ensureUniqueAnchors(node: SymbolNode): void {
    const seen = new Map<string, number>();

    for (const member of node.members) {
      if (!member.anchor) continue;

      const count = seen.get(member.anchor) ?? 0;

      seen.set(member.anchor, count + 1);

      if (count > 0) member.anchor = `${member.anchor}-${count + 1}`;
    }
  }

  #indexSignature(signature: SignatureReflection, parent: SymbolId): SymbolNode {
    const parameter = signature.parameters?.[0];
    const id: SymbolId = { ...parent, path: [...parent.path, '[index]'], namespace: '' };
    const node = createNode({
      key: symbolKey(id),
      id,
      name: `[${parameter?.name ?? 'key'}: ${parameter?.type ? textOfType(this.#type(parameter.type)) : 'string'}]`,
      kind: 'index-signature',
      languageKind: 'Index signature',
      language: 'typescript',
      anchor: 'index-signature',
    });

    if (signature.comment) node.docs = this.#docs(signature.comment);

    if (signature.type) node.type = this.#type(signature.type);

    return node;
  }

  #kind(kind: number): SymbolKind | undefined {
    switch (kind) {
      case Kind.Namespace:
        return 'namespace';
      case Kind.Enum:
        return 'enum';
      case Kind.EnumMember:
        return 'enum-member';
      case Kind.Variable:
        return 'variable';
      case Kind.Function:
        return 'function';
      case Kind.Class:
        return 'class';
      case Kind.Interface:
        return 'interface';
      case Kind.Constructor:
        return 'constructor';
      case Kind.Property:
        return 'property';
      case Kind.Method:
        return 'method';
      case Kind.Accessor:
        return 'accessor';
      case Kind.TypeAlias:
        return 'type-alias';
      default:
        return undefined;
    }
  }

  #flags(reflection: Reflection): string[] {
    const flags = reflection.flags ?? {};
    const out: string[] = [];

    if (flags.isStatic) out.push('static');

    if (flags.isAbstract) out.push('abstract');

    if (flags.isProtected) out.push('protected');

    if (flags.isReadonly) out.push('readonly');

    if (flags.isOptional) out.push('optional');

    if (flags.isConst) out.push('const');

    if (reflection.inheritedFrom) out.push('inherited');

    if (reflection.overwrites) out.push('override');

    return out;
  }

  #tsData(reflection: Reflection): NonNullable<SymbolNode['ts']> {
    const data: NonNullable<SymbolNode['ts']> = { entryPoint: kindName(reflection.kind) };

    // Constructors are not inherited members; their provenance references would only name `X.constructor`.
    if (reflection.kind === Kind.Constructor) return data;

    if (reflection.inheritedFrom) data.inheritedFrom = this.#type(reflection.inheritedFrom);

    if (reflection.overwrites) data.overwrites = this.#type(reflection.overwrites);

    if (reflection.implementationOf) data.implementationOf = this.#type(reflection.implementationOf);

    if (reflection.extendedBy?.length) data.extendedBy = reflection.extendedBy.map((type) => this.#type(type));

    if (reflection.implementedBy?.length) {
      data.implementedBy = reflection.implementedBy.map((type) => this.#type(type));
    }

    return data;
  }

  /** True when an inherited member comes from a package outside the documented workspace. */
  #isExternalSource(reference: JSONOutput.ReferenceType): boolean {
    const target = reference.target;

    if (typeof target === 'number') return !this.#reflections.has(target);

    return !this.#workspace.has(target.packageName);
  }

  #source(source: JSONOutput.SourceReference | undefined): SourceLocation | undefined {
    if (!source) return undefined;

    return { file: source.fileName.replaceAll('\\', '/'), line: source.line };
  }

  #signatures(reflection: Reflection): Signature[] {
    const result: Signature[] = [];

    for (const signature of reflection.signatures ?? []) {
      result.push(this.#signature(signature, reflection.kind === Kind.Constructor ? 'construct' : 'call'));
    }

    if (reflection.getSignature) result.push(this.#signature(reflection.getSignature, 'get'));

    if (reflection.setSignature) result.push(this.#signature(reflection.setSignature, 'set'));

    return result;
  }

  #signature(signature: SignatureReflection, signatureKind: Signature['signatureKind']): Signature {
    const docs = signature.comment ? this.#docs(signature.comment) : emptyDocs();
    const returnsTag = signature.comment?.blockTags?.find((tag) => tag.tag === '@returns');
    const result: Signature = {
      name: signature.name,
      signatureKind,
      typeParameters: (signature.typeParameters ?? []).map((parameter) => this.#typeParameter(parameter)),
      parameters: (signature.parameters ?? []).map((parameter) => this.#parameter(parameter)),
      whereClauses: [],
      qualifiers: [],
      docs,
    };

    if (signature.type && signatureKind !== 'construct' && signatureKind !== 'set') {
      const returns: NonNullable<Signature['returns']> = { type: this.#type(signature.type) };

      if (returnsTag) returns.docs = this.#partsToDocText(returnsTag.content);

      result.returns = returns;
    }

    return result;
  }

  #parameter(parameter: JSONOutput.ParameterReflection): Parameter {
    const result: Parameter = {
      name: parameter.name,
      optional: parameter.flags?.isOptional === true || parameter.defaultValue !== undefined,
      rest: parameter.flags?.isRest === true,
    };

    if (parameter.type) result.type = this.#type(parameter.type);

    if (parameter.defaultValue !== undefined && isShortValue(parameter.defaultValue)) {
      result.defaultValue = parameter.defaultValue;
    }

    if (parameter.comment) {
      const text = this.#partsToDocText(parameter.comment.summary);

      if (text.markdown.trim()) result.docs = text;
    }

    return result;
  }

  #typeParameter(parameter: JSONOutput.TypeParameterReflection): TypeParameter {
    const bounds: Bound[] = parameter.type ? [{ kind: 'trait', trait: this.#type(parameter.type) }] : [];
    const result: TypeParameter = {
      name: parameter.name,
      paramKind: 'type',
      bounds,
      modifiers: (parameter as { modifiers?: string[] }).modifiers
        ? [...((parameter as { modifiers?: string[] }).modifiers ?? [])]
        : [],
    };

    if (parameter.default) result.default = this.#type(parameter.default);

    if (parameter.comment) {
      const text = this.#partsToDocText(parameter.comment.summary);

      if (text.markdown.trim()) result.docs = text;
    }

    return result;
  }

  /** Convert a TypeDoc comment into structured documentation. */
  #docs(comment: Comment): Docs {
    const docs = emptyDocs();
    const summary = this.#partsToDocText(comment.summary);

    if (summary.markdown.trim()) docs.summary = summary;

    for (const tag of comment.blockTags ?? []) {
      const body = this.#partsToDocText(tag.content);

      switch (tag.tag) {
        case '@remarks':
          docs.remarks = body;
          break;
        case '@example':
          docs.examples.push(exampleOf(body));
          break;
        case '@deprecated':
          docs.deprecated = body;
          break;
        case '@throws':
          docs.throws.push(body);
          break;
        case '@see':
          docs.see.push(body);
          break;
        case '@returns':
        case '@param':
        case '@typeParam':
        case '@template':
        case '@privateRemarks':
          break;
        default:
          docs.sections.push({ title: sectionTitle(tag.tag), body });
      }
    }

    for (const modifier of comment.modifierTags ?? []) {
      const name = modifier.replace(/^@/, '');

      if (['beta', 'alpha', 'experimental', 'sealed', 'virtual'].includes(name)) docs.modifiers.push(name);
    }

    return docs;
  }

  #partsToDocText(parts: Part[] | undefined): DocText {
    this.#links = {};

    let markdown = '';

    for (const part of parts ?? []) {
      if (
        part.kind === 'inline-tag' &&
        (part.tag === '@link' || part.tag === '@linkcode' || part.tag === '@linkplain')
      ) {
        const key = `ref:${this.#linkCount++}`;
        const link: DocLink = {};
        const target = (part as { target?: number | string | SymbolIdJson }).target;

        if (typeof target === 'string') link.external = target;
        else {
          const symbol = this.#targetKey(target);

          if (symbol) link.target = symbol;
        }

        const text = part.text || (part as { tsLinkText?: string }).tsLinkText || '';
        const label = part.tag === '@linkplain' ? text : `\`${text}\``;

        if (link.target || link.external) {
          this.#links[key] = link;
          markdown += `[${label}](${key})`;
        } else {
          markdown += label;
        }
      } else if (part.kind === 'inline-tag') {
        markdown += `\`${part.tag} ${part.text}\``;
      } else {
        markdown += part.text;
      }
    }

    return docText(markdown, this.#links);
  }

  // ---- types ----

  #type(type: JsonType): TypeExpr {
    switch (type.type) {
      case 'intrinsic':
        return { kind: 'intrinsic', name: type.name };
      case 'literal':
        return { kind: 'literal', value: literalText(type.value) };
      case 'reference':
        return this.#reference(type);
      case 'union':
        return { kind: 'union', types: type.types.map((member) => this.#type(member)) };
      case 'intersection':
        return { kind: 'intersection', types: type.types.map((member) => this.#type(member)) };
      case 'array':
        return { kind: 'array', element: this.#type(type.elementType) };
      case 'tuple':
        return this.#tuple(type.elements ?? []);
      case 'namedTupleMember':
        return {
          kind: 'named-member',
          name: type.name,
          optional: type.isOptional,
          element: this.#type(type.element),
        };
      case 'optional':
        return { kind: 'optional', element: this.#type(type.elementType) };
      case 'rest':
        return { kind: 'rest', element: this.#type(type.elementType) };
      case 'typeOperator':
        return { kind: 'operator', operator: type.operator, target: this.#type(type.target) };
      case 'indexedAccess':
        return {
          kind: 'indexed-access',
          object: this.#type(type.objectType),
          index: this.#type(type.indexType),
        };
      case 'conditional':
        return {
          kind: 'conditional',
          check: this.#type(type.checkType),
          extends: this.#type(type.extendsType),
          trueType: this.#type(type.trueType),
          falseType: this.#type(type.falseType),
        };
      case 'mapped': {
        const mapped: Extract<TypeExpr, { kind: 'mapped' }> = {
          kind: 'mapped',
          parameter: type.parameter,
          source: this.#type(type.parameterType),
          template: this.#type(type.templateType),
        };

        if (type.nameType) mapped.nameType = this.#type(type.nameType);

        if (type.readonlyModifier) mapped.readonly = type.readonlyModifier;

        if (type.optionalModifier) mapped.optional = type.optionalModifier;

        return mapped;
      }
      case 'query':
        return { kind: 'query', target: this.#type(type.queryType) };
      case 'predicate': {
        const predicate: Extract<TypeExpr, { kind: 'predicate' }> = {
          kind: 'predicate',
          name: type.name,
          asserts: type.asserts,
        };

        if (type.targetType) predicate.type = this.#type(type.targetType);

        return predicate;
      }
      case 'templateLiteral':
        return {
          kind: 'template-literal',
          head: type.head,
          tail: type.tail.map(([member, text]) => ({ type: this.#type(member), text })),
        };
      case 'inferred': {
        const inferred: Extract<TypeExpr, { kind: 'infer' }> = { kind: 'infer', name: type.name };

        if (type.constraint) inferred.constraint = this.#type(type.constraint);

        return inferred;
      }
      case 'reflection':
        return this.#reflectionType(type.declaration);
      case 'unknown':
        return { kind: 'unknown', text: type.name };
      default:
        return { kind: 'unknown', text: `${(type as { type: string }).type}` };
    }
  }

  #tuple(elements: JsonType[]): TypeExpr {
    const names: (string | undefined)[] = [];
    const types = elements.map((element) => {
      if (element.type === 'namedTupleMember') {
        names.push(element.name);

        return element.isOptional
          ? ({ kind: 'optional', element: this.#type(element.element) } as TypeExpr)
          : this.#type(element.element);
      }

      names.push(undefined);

      return this.#type(element);
    });

    return names.some((name) => name !== undefined)
      ? { kind: 'tuple', elements: types, names }
      : { kind: 'tuple', elements: types };
  }

  #reference(type: JSONOutput.ReferenceType): TypeExpr {
    if (type.refersToTypeParameter) return { kind: 'type-parameter', name: type.name };

    const target = type.target;
    const key = this.#targetKey(target);
    const result: Extract<TypeExpr, { kind: 'reference' }> = { kind: 'reference', name: type.name };

    if (key) result.target = key;

    if (typeof target === 'object') {
      result.qualified = `${target.packageName}:${target.packagePath}#${target.qualifiedName}`;

      if (!this.#workspace.has(target.packageName)) {
        result.external = { package: target.packageName, symbol: target.qualifiedName };
      }
    } else if (!key) {
      result.qualified = type.qualifiedName ?? type.name;
    }

    if (type.typeArguments?.length) result.args = type.typeArguments.map((member) => this.#type(member));

    return result;
  }

  /** Anonymous object or function type. */
  #reflectionType(declaration: JSONOutput.DeclarationReflection): TypeExpr {
    const signatures = declaration.signatures ?? [];

    if (signatures.length === 1 && !declaration.children?.length && !declaration.indexSignatures?.length) {
      const signature = this.#signature(signatures[0] as SignatureReflection, 'call');

      return { kind: 'function', constructor: false, signature };
    }

    const parent: SymbolId = {
      language: 'typescript',
      package: this.#pkg.name,
      file: '',
      path: ['<anonymous>'],
      namespace: '',
    };
    const members: SymbolNode[] = [];

    for (const child of (declaration.children ?? []) as Reflection[]) {
      const node = this.#declaration(child, parent.path, 'member', parent);

      if (node) members.push(node);
    }

    for (const signature of signatures) {
      const id: SymbolId = { ...parent, path: [...parent.path, '(call)'] };
      const node = createNode({
        key: symbolKey(id),
        id,
        name: '(call)',
        kind: 'method',
        languageKind: 'Call signature',
        language: 'typescript',
        anchor: 'call',
      });

      node.signatures = [this.#signature(signature, 'call')];
      members.push(node);
    }

    for (const index of declaration.indexSignatures ?? []) members.push(this.#indexSignature(index, parent));

    return { kind: 'object', members };
  }
}

/** Anchor for a member inside its parent page. */
export function memberAnchor(node: Pick<SymbolNode, 'kind' | 'name' | 'flags'>): string {
  const prefix = node.flags.includes('static') ? 'static-' : '';
  const slug = node.name.replace(/[^A-Za-z0-9_$-]+/g, '-').replace(/^-+|-+$/g, '') || 'member';

  return `${prefix}${node.kind === 'constructor' ? 'constructor' : `${node.kind}-${slug}`}`;
}

function kindName(kind: number): string {
  const entry = Object.entries(Kind).find(([, value]) => value === kind);

  return entry ? entry[0].replace(/([a-z])([A-Z])/g, '$1 $2') : String(kind);
}

function isShortValue(value: string): boolean {
  return value.length <= 160 && !value.includes('\n');
}

function literalText(value: unknown): string {
  if (value === null) return 'null';

  if (typeof value === 'string') return JSON.stringify(value);

  if (typeof value === 'object' && value !== null && 'value' in value) {
    const big = value as { value: string; negative?: boolean };

    return `${big.negative ? '-' : ''}${big.value}n`;
  }

  return String(value);
}

function sectionTitle(tag: string): string {
  const name = tag.replace(/^@/, '');

  return name.charAt(0).toUpperCase() + name.slice(1).replace(/([a-z])([A-Z])/g, '$1 $2');
}

/** Convert an `@example` body into a titled example, wrapping bare code in a TypeScript fence. */
function exampleOf(body: DocText): Docs['examples'][number] {
  const text = body.markdown.trim();

  if (!text.includes('```')) {
    return { body: { ...body, markdown: `\`\`\`ts\n${text}\n\`\`\`` } };
  }

  const fence = text.indexOf('```');
  const title = text.slice(0, fence).trim();

  if (title && !title.includes('\n')) {
    return { title, body: { ...body, markdown: text.slice(fence) } };
  }

  return { body: { ...body, markdown: text } };
}

/** Compact plain-text rendering used for names, search, and diagnostics. */
export function textOfType(type: TypeExpr): string {
  switch (type.kind) {
    case 'reference':
      return type.args?.length ? `${type.name}<${type.args.map(textOfType).join(', ')}>` : type.name;
    case 'type-parameter':
    case 'intrinsic':
      return type.name;
    case 'literal':
      return type.value;
    case 'union':
      return type.types.map(textOfType).join(' | ');
    case 'intersection':
      return type.types.map(textOfType).join(' & ');
    case 'array':
      return `${textOfType(type.element)}[]`;
    case 'unknown':
      return type.text;
    default:
      return type.kind;
  }
}
