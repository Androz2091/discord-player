import type {
  Bound,
  DocText,
  Docs,
  Implementor,
  ModuleEntry,
  Signature,
  SymbolNode,
  TypeExpr,
  TypeParameter,
  WherePredicate,
} from './model.ts';

/** Callbacks invoked by {@link walkSymbol}. Every callback may mutate the visited value. */
export interface Visitor {
  type?(type: TypeExpr): void;
  doc?(doc: DocText): void;
  entry?(entry: ModuleEntry): void;
  implementor?(implementor: Implementor): void;
  symbol?(symbol: SymbolNode): void;
}

/**
 * Visit every type, documentation text, index entry, and nested symbol reachable from a symbol.
 *
 * @param node Symbol to traverse.
 * @param visitor Callbacks.
 */
export function walkSymbol(node: SymbolNode, visitor: Visitor): void {
  visitor.symbol?.(node);
  walkDocs(node.docs, visitor);

  for (const parameter of node.typeParameters) walkTypeParameter(parameter, visitor);

  for (const signature of node.signatures) walkSignature(signature, visitor);

  if (node.type) walkType(node.type, visitor);

  for (const type of node.extends) walkType(type, visitor);

  for (const type of node.implements) walkType(type, visitor);

  for (const clause of node.whereClauses) walkWhere(clause, visitor);

  for (const type of [
    node.ts?.inheritedFrom,
    node.ts?.overwrites,
    node.ts?.implementationOf,
    ...(node.ts?.extendedBy ?? []),
    ...(node.ts?.implementedBy ?? []),
  ]) {
    if (type) walkType(type, visitor);
  }

  for (const member of node.members) walkSymbol(member, visitor);

  for (const entry of node.entries) visitor.entry?.(entry);

  if (node.rust) {
    for (const bound of node.rust.bounds) walkBound(bound, visitor);

    for (const impl of node.rust.impls) {
      walkType(impl.forType, visitor);

      if (impl.trait) walkType(impl.trait, visitor);

      for (const parameter of impl.typeParameters) walkTypeParameter(parameter, visitor);

      for (const clause of impl.whereClauses) walkWhere(clause, visitor);

      walkDocs(impl.docs, visitor);

      for (const member of impl.items) walkSymbol(member, visitor);
    }

    for (const implementor of node.rust.implementors) {
      walkType(implementor.forType, visitor);
      visitor.implementor?.(implementor);
    }
  }
}

function walkDocs(docs: Docs, visitor: Visitor): void {
  const texts: (DocText | undefined)[] = [
    docs.summary,
    docs.remarks,
    docs.deprecated,
    ...docs.examples.map((example) => example.body),
    ...docs.throws,
    ...docs.see,
    ...docs.sections.map((section) => section.body),
  ];

  for (const text of texts) if (text) visitor.doc?.(text);
}

function walkTypeParameter(parameter: TypeParameter, visitor: Visitor): void {
  for (const bound of parameter.bounds) walkBound(bound, visitor);

  if (parameter.default) walkType(parameter.default, visitor);

  if (parameter.constType) walkType(parameter.constType, visitor);

  if (parameter.docs) visitor.doc?.(parameter.docs);
}

function walkWhere(clause: WherePredicate, visitor: Visitor): void {
  if (clause.subject.kind !== 'lifetime') walkType(clause.subject, visitor);

  for (const bound of clause.bounds) walkBound(bound, visitor);
}

function walkBound(bound: Bound, visitor: Visitor): void {
  if (bound.kind === 'trait') walkType(bound.trait, visitor);
}

/** Visit a signature's parameters, return type, generics, and docs. */
export function walkSignature(signature: Signature, visitor: Visitor): void {
  walkDocs(signature.docs, visitor);

  for (const parameter of signature.typeParameters) walkTypeParameter(parameter, visitor);

  for (const parameter of signature.parameters) {
    if (parameter.type) walkType(parameter.type, visitor);

    if (parameter.docs) visitor.doc?.(parameter.docs);
  }

  if (signature.returns) {
    walkType(signature.returns.type, visitor);

    if (signature.returns.docs) visitor.doc?.(signature.returns.docs);
  }

  for (const clause of signature.whereClauses) walkWhere(clause, visitor);
}

/** Visit a type and everything nested inside it. */
export function walkType(type: TypeExpr, visitor: Visitor): void {
  visitor.type?.(type);

  switch (type.kind) {
    case 'reference':
      for (const arg of type.args ?? []) walkType(arg, visitor);

      for (const binding of type.bindings ?? []) {
        if (binding.type) walkType(binding.type, visitor);

        for (const bound of binding.bounds ?? []) walkBound(bound, visitor);
      }
      break;
    case 'union':
    case 'intersection':
      for (const member of type.types) walkType(member, visitor);
      break;
    case 'array':
    case 'slice':
    case 'fixed-array':
    case 'rest':
    case 'optional':
    case 'named-member':
      walkType(type.element, visitor);
      break;
    case 'tuple':
      for (const member of type.elements) walkType(member, visitor);
      break;
    case 'function':
      walkSignature(type.signature, visitor);
      break;
    case 'object':
      for (const member of type.members) walkSymbol(member, visitor);
      break;
    case 'operator':
    case 'query':
      walkType(type.target, visitor);
      break;
    case 'borrowed':
    case 'pointer':
      walkType(type.type, visitor);
      break;
    case 'indexed-access':
      walkType(type.object, visitor);
      walkType(type.index, visitor);
      break;
    case 'conditional':
      walkType(type.check, visitor);
      walkType(type.extends, visitor);
      walkType(type.trueType, visitor);
      walkType(type.falseType, visitor);
      break;
    case 'mapped':
      walkType(type.source, visitor);
      walkType(type.template, visitor);

      if (type.nameType) walkType(type.nameType, visitor);
      break;
    case 'predicate':
      if (type.type) walkType(type.type, visitor);
      break;
    case 'template-literal':
      for (const part of type.tail) walkType(part.type, visitor);
      break;
    case 'infer':
      if (type.constraint) walkType(type.constraint, visitor);
      break;
    case 'impl-trait':
    case 'dyn-trait':
      for (const bound of type.bounds) walkBound(bound, visitor);
      break;
    case 'qualified-path':
      walkType(type.self, visitor);

      if (type.trait) walkType(type.trait, visitor);
      break;
    default:
      break;
  }
}
