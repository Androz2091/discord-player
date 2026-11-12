import type { Bound, Parameter, Signature, SymbolNode, TypeExpr, TypeParameter, WherePredicate } from './model.ts';

/**
 * Source text of types, signatures and declarations as a list of segments. Linked segments carry the
 * documentation URL of the referenced symbol, so the renderer can syntax-highlight the joined text
 * as real TypeScript or Rust and then turn the tokens inside a link range into anchors.
 */
export interface Segment {
  text: string;
  /** Site-relative URL of a documented symbol. */
  href?: string;
  /** Absolute URL of external documentation. */
  external?: string;
  /** Tooltip, for example the package an external type comes from. */
  title?: string;
}

type Segments = Segment[];

const t = (text: string): Segments => [{ text }];

function join(items: Segments[], separator: string): Segments {
  return items.flatMap((item, index) => (index === 0 ? item : [{ text: separator }, ...item]));
}

/** Concatenate segments to the source text they represent. */
export function segmentsToText(segments: Segments): string {
  return segments.map((segment) => segment.text).join('');
}

function indent(depth: number): string {
  return '  '.repeat(depth);
}

function wrap(type: TypeExpr, wrapped: TypeExpr['kind'][], depth: number): Segments {
  const inner = typeSegments(type, depth);

  return wrapped.includes(type.kind) ? [...t('('), ...inner, ...t(')')] : inner;
}

/** Segments of a type expression. */
export function typeSegments(type: TypeExpr, depth = 0): Segments {
  switch (type.kind) {
    case 'reference': {
      const name: Segment = {
        text: type.name,
        ...(type.href ? { href: type.href } : {}),
        ...(!type.href && type.external?.url ? { external: type.external.url } : {}),
        ...(type.external ? { title: `Defined in ${type.external.package}` } : {}),
      };

      if (type.fnSugar) {
        const output = type.bindings?.find((binding) => binding.name === 'Output')?.type;

        return [
          name,
          ...t('('),
          ...join(
            (type.args ?? []).map((arg) => typeSegments(arg, depth)),
            ', ',
          ),
          ...t(')'),
          ...(output ? [...t(' -> '), ...typeSegments(output, depth)] : []),
        ];
      }

      const args: Segments[] = [
        ...(type.args ?? []).map((arg) => typeSegments(arg, depth)),
        ...(type.bindings ?? []).map((binding) =>
          binding.type
            ? [...t(`${binding.name} = `), ...typeSegments(binding.type, depth)]
            : [...t(`${binding.name}: `), ...boundsSegments(binding.bounds ?? [])],
        ),
      ];

      return args.length > 0 ? [name, ...t('<'), ...join(args, ', '), ...t('>')] : [name];
    }
    case 'type-parameter':
    case 'intrinsic':
      return t(type.name);
    case 'literal':
      return t(type.value);
    case 'union':
      return join(
        type.types.map((member) => wrap(member, ['function', 'conditional'], depth)),
        ' | ',
      );
    case 'intersection':
      return join(
        type.types.map((member) => wrap(member, ['function', 'conditional', 'union'], depth)),
        ' & ',
      );
    case 'array':
      return [
        ...wrap(type.element, ['union', 'intersection', 'function', 'conditional', 'operator'], depth),
        ...t('[]'),
      ];
    case 'tuple':
      return [
        ...t('['),
        ...join(
          type.elements.map((element, index) => {
            const name = type.names?.[index];

            return [...(name ? t(`${name}: `) : []), ...typeSegments(element, depth)];
          }),
          ', ',
        ),
        ...t(']'),
      ];
    case 'function':
      return [...(type.constructor ? t('new ') : []), ...signatureSegments(type.signature, { arrow: true, depth })];
    case 'object':
      return objectSegments(type.members, depth);
    case 'operator':
      return [...t(`${type.operator} `), ...typeSegments(type.target, depth)];
    case 'indexed-access':
      return [...typeSegments(type.object, depth), ...t('['), ...typeSegments(type.index, depth), ...t(']')];
    case 'conditional':
      return [
        ...typeSegments(type.check, depth),
        ...t(' extends '),
        ...typeSegments(type.extends, depth),
        ...t(' ? '),
        ...typeSegments(type.trueType, depth),
        ...t(' : '),
        ...typeSegments(type.falseType, depth),
      ];
    case 'mapped':
      return [
        ...t(`{ ${type.readonly ?? ''}[${type.parameter} in `),
        ...typeSegments(type.source, depth),
        ...(type.nameType ? [...t(' as '), ...typeSegments(type.nameType, depth)] : []),
        ...t(`]${type.optional ?? ''}: `),
        ...typeSegments(type.template, depth),
        ...t(' }'),
      ];
    case 'query':
      return [...t('typeof '), ...typeSegments(type.target, depth)];
    case 'predicate':
      return [
        ...t(`${type.asserts ? 'asserts ' : ''}${type.name}`),
        ...(type.type ? [...t(' is '), ...typeSegments(type.type, depth)] : []),
      ];
    case 'template-literal':
      return [
        ...t(`\`${type.head}`),
        ...type.tail.flatMap((part) => [...t('${'), ...typeSegments(part.type, depth), ...t(`}${part.text}`)]),
        ...t('`'),
      ];
    case 'rest':
      return [...t('...'), ...typeSegments(type.element, depth)];
    case 'optional':
      return [...typeSegments(type.element, depth), ...t('?')];
    case 'named-member':
      return [...t(`${type.name}${type.optional ? '?' : ''}: `), ...typeSegments(type.element, depth)];
    case 'infer':
      return [
        ...t(`infer ${type.name}`),
        ...(type.constraint ? [...t(' extends '), ...typeSegments(type.constraint, depth)] : []),
      ];
    case 'borrowed':
      return [
        ...t(`&${type.lifetime ? `${type.lifetime} ` : ''}${type.mutable ? 'mut ' : ''}`),
        ...typeSegments(type.type, depth),
      ];
    case 'pointer':
      return [...t(`*${type.mutable ? 'mut' : 'const'} `), ...typeSegments(type.type, depth)];
    case 'slice':
      return [...t('['), ...typeSegments(type.element, depth), ...t(']')];
    case 'fixed-array':
      return [...t('['), ...typeSegments(type.element, depth), ...t(`; ${type.length}]`)];
    case 'impl-trait':
      return [...t('impl '), ...boundsSegments(type.bounds)];
    case 'dyn-trait':
      return [...t('dyn '), ...boundsSegments(type.bounds), ...(type.lifetime ? t(` + ${type.lifetime}`) : [])];
    case 'qualified-path': {
      const name: Segment = { text: type.name, ...(type.href ? { href: type.href } : {}) };

      return type.trait
        ? [
            ...t('<'),
            ...typeSegments(type.self, depth),
            ...t(' as '),
            ...typeSegments(type.trait, depth),
            ...t('>::'),
            name,
          ]
        : [...typeSegments(type.self, depth), ...t('::'), name];
    }
    case 'placeholder':
      return t('_');
    case 'unknown':
      return t(type.text);
  }
}

/** Segments of trait or outlives bounds joined with `+`. */
export function boundsSegments(bounds: Bound[]): Segments {
  return join(
    bounds.map((bound) =>
      bound.kind === 'outlives'
        ? t(bound.lifetime)
        : [
            ...(bound.higherRanked?.length ? t(`for<${bound.higherRanked.join(', ')}> `) : []),
            ...t(bound.modifier ?? ''),
            ...typeSegments(bound.trait),
          ],
    ),
    ' + ',
  );
}

/** Segments of one TypeScript or Rust generic parameter. */
export function typeParameterSegments(parameter: TypeParameter, language: 'typescript' | 'rust'): Segments {
  const prefix = parameter.modifiers.length > 0 ? `${parameter.modifiers.join(' ')} ` : '';
  const head =
    parameter.paramKind === 'const'
      ? [...t(`const ${parameter.name}: `), ...(parameter.constType ? typeSegments(parameter.constType) : t('_'))]
      : t(`${prefix}${parameter.name}`);
  const bounds =
    parameter.bounds.length > 0
      ? [...t(language === 'typescript' ? ' extends ' : ': '), ...boundsSegments(parameter.bounds)]
      : [];
  const def = parameter.default ? [...t(' = '), ...typeSegments(parameter.default)] : [];

  return [...head, ...bounds, ...def];
}

/** Segments of `<T, U>` or nothing. */
export function typeParametersSegments(parameters: TypeParameter[], language: 'typescript' | 'rust'): Segments {
  if (parameters.length === 0) return [];

  return [
    ...t('<'),
    ...join(
      parameters.map((parameter) => typeParameterSegments(parameter, language)),
      ', ',
    ),
    ...t('>'),
  ];
}

/** Segments of a Rust `where` clause, one predicate per line. */
export function whereSegments(clauses: WherePredicate[]): Segments {
  if (clauses.length === 0) return [];

  return [
    ...t('\nwhere'),
    ...clauses.flatMap((clause, index) => [
      ...t('\n    '),
      ...(clause.subject.kind === 'lifetime' ? t(clause.subject.name) : typeSegments(clause.subject)),
      ...t(': '),
      ...boundsSegments(clause.bounds),
      ...t(index < clauses.length - 1 ? ',' : ''),
    ]),
  ];
}

/** Segments of a parameter as written in a signature. */
export function parameterSegments(parameter: Parameter, depth = 0): Segments {
  return [
    ...t(
      `${parameter.rest ? '...' : ''}${parameter.name}${parameter.optional && parameter.defaultValue === undefined ? '?' : ''}`,
    ),
    ...(parameter.type ? [...t(': '), ...typeSegments(parameter.type, depth)] : []),
    ...t(parameter.defaultValue === undefined ? '' : ` = ${parameter.defaultValue}`),
  ];
}

/** Options for {@link signatureSegments}. */
export interface SignatureOptions {
  /** Function type: `(a) => R` instead of `name(a): R`. */
  arrow?: boolean;
  /** Name used instead of the signature's own, for example the member name. */
  name?: string;
  /** Put each parameter on its own line. */
  multiline?: boolean;
  /** Declaration keywords written before the name, such as `static` or `pub`. */
  prefix?: string;
  depth?: number;
  /** Write `function` before a TypeScript signature name. */
  functionKeyword?: boolean;
}

/** Plain length of the one-line form of a signature. */
export function signatureLength(signature: Signature): number {
  return segmentsToText(signatureSegments(signature, { name: signature.name })).length;
}

/** Segments of a signature. */
export function signatureSegments(signature: Signature, options: SignatureOptions = {}): Segments {
  const rust = signature.signatureKind === 'fn';
  const depth = options.depth ?? 0;
  const generics = typeParametersSegments(signature.typeParameters, rust ? 'rust' : 'typescript');
  const parameters: Segments[] = [
    ...(signature.receiver ? [t(signature.receiver)] : []),
    ...signature.parameters.map((parameter) => parameterSegments(parameter, options.multiline ? depth + 1 : depth)),
  ];
  const list: Segments = options.multiline
    ? [
        ...t('(\n'),
        ...parameters.flatMap((parameter) => [...t(`${indent(depth + 1)}`), ...parameter, ...t(',\n')]),
        ...t(`${indent(depth)})`),
      ]
    : [...t('('), ...join(parameters, ', '), ...t(')')];
  const name = options.name ?? signature.name;

  if (rust) {
    const qualifiers = signature.qualifiers.length > 0 ? `${signature.qualifiers.join(' ')} ` : '';

    return [
      ...t(`${options.prefix ?? ''}${qualifiers}fn${options.arrow ? '' : ` ${name}`}`),
      ...generics,
      ...list,
      ...(signature.returns ? [...t(' -> '), ...typeSegments(signature.returns.type, depth)] : []),
      ...whereSegments(signature.whereClauses),
    ];
  }

  if (signature.signatureKind === 'get') {
    return [
      ...t(`${options.prefix ?? ''}get ${name}(): `),
      ...(signature.returns ? typeSegments(signature.returns.type, depth) : t('unknown')),
    ];
  }

  if (signature.signatureKind === 'set') return [...t(`${options.prefix ?? ''}set ${name}`), ...list];

  const returns = signature.returns ? typeSegments(signature.returns.type, depth) : t('void');

  if (options.arrow) return [...generics, ...list, ...t(' => '), ...returns];

  if (signature.signatureKind === 'construct')
    return [...t(`${options.prefix ?? ''}constructor`), ...generics, ...list];

  return [
    ...t(`${options.prefix ?? ''}${options.functionKeyword ? 'function ' : ''}${name}`),
    ...generics,
    ...list,
    ...t(': '),
    ...returns,
  ];
}

function objectSegments(members: SymbolNode[], depth: number): Segments {
  if (members.length === 0) return t('{}');

  return [
    ...t('{\n'),
    ...members.flatMap((member) => [...t(indent(depth + 1)), ...memberSegments(member, depth + 1), ...t(';\n')]),
    ...t(`${indent(depth)}}`),
  ];
}

/** Property, method or index signature as written inside an object type. */
function memberSegments(member: SymbolNode, depth: number): Segments {
  const readonly = member.flags.includes('readonly') ? 'readonly ' : '';

  if (member.signatures.length > 0 && member.kind === 'method') {
    return signatureSegments(member.signatures[0] as Signature, { name: member.name, depth });
  }

  return [
    ...t(`${readonly}${member.name}${member.flags.includes('optional') ? '?' : ''}`),
    ...(member.type ? [...t(': '), ...typeSegments(member.type, depth)] : []),
  ];
}

/** Declaration modifiers worth writing in front of a member. */
function memberPrefix(symbol: SymbolNode): string {
  const flags = symbol.flags.filter((flag) => ['static', 'abstract', 'protected', 'readonly'].includes(flag));
  const visibility = symbol.rust?.visibility ? `${symbol.rust.visibility} ` : '';

  return `${visibility}${flags.length > 0 ? `${flags.join(' ')} ` : ''}`;
}

/** Highlighting mode for a code fragment, so the right syntax context can be supplied. */
export type CodeContext =
  | 'ts-statement'
  | 'ts-member'
  | 'ts-type'
  | 'rust-statement'
  | 'rust-field'
  | 'rust-variant'
  | 'rust-type';

/** A declaration or signature ready to be highlighted. */
export interface CodeFragment {
  segments: Segments;
  context: CodeContext;
}

/**
 * Declaration of a page symbol: `class X<T> extends Y`, `pub struct Z`, `type A = B`, or a function
 * signature.
 */
export function declarationFragment(symbol: SymbolNode): CodeFragment {
  const rust = symbol.language === 'rust';
  const generics = typeParametersSegments(symbol.typeParameters, symbol.language);
  const context: CodeContext = rust ? 'rust-statement' : 'ts-statement';
  const visibility = rust && symbol.rust?.visibility ? `${symbol.rust.visibility} ` : '';
  const attributes = (symbol.rust?.attributes ?? []).map((attribute) => `${attribute}\n`).join('');
  const heritage = (keyword: string, types: TypeExpr[]): Segments =>
    types.length > 0
      ? [
          ...t(` ${keyword} `),
          ...join(
            types.map((type) => typeSegments(type)),
            ', ',
          ),
        ]
      : [];
  let body: Segments;

  switch (symbol.kind) {
    case 'class':
      body = [
        ...t(`${symbol.flags.includes('abstract') ? 'abstract ' : ''}class ${symbol.name}`),
        ...generics,
        ...heritage('extends', symbol.extends),
        ...heritage('implements', symbol.implements),
      ];
      break;
    case 'interface':
      body = [...t(`interface ${symbol.name}`), ...generics, ...heritage('extends', symbol.extends)];
      break;
    case 'type-alias':
      body = [
        ...t(`${visibility}type ${symbol.name}`),
        ...generics,
        ...(symbol.type ? [...t(' = '), ...typeSegments(symbol.type)] : []),
        ...whereSegments(symbol.whereClauses),
        ...t(rust ? ';' : ''),
      ];
      break;
    case 'enum':
      body = [...t(`${visibility}enum ${symbol.name}`), ...generics, ...whereSegments(symbol.whereClauses)];
      break;
    case 'struct':
    case 'union':
      body = [...t(`${visibility}${symbol.kind} ${symbol.name}`), ...generics, ...whereSegments(symbol.whereClauses)];
      break;
    case 'trait': {
      const flags = [
        symbol.rust?.traitFlags.includes('unsafe') ? 'unsafe ' : '',
        symbol.rust?.traitFlags.includes('auto') ? 'auto ' : '',
      ].join('');

      body = [
        ...t(`${visibility}${flags}trait ${symbol.name}`),
        ...generics,
        ...(symbol.rust?.bounds.length ? [...t(': '), ...boundsSegments(symbol.rust.bounds)] : []),
        ...whereSegments(symbol.whereClauses),
      ];
      break;
    }
    case 'variable':
      body = [
        ...t(`${symbol.flags.includes('const') ? 'const' : 'let'} ${symbol.name}`),
        ...(symbol.type ? [...t(': '), ...typeSegments(symbol.type)] : []),
        ...t(symbol.value ? ` = ${symbol.value}` : ''),
      ];
      break;
    case 'constant':
    case 'static':
      body = [
        ...t(
          `${visibility}${symbol.kind === 'static' ? `static ${symbol.flags.includes('mut') ? 'mut ' : ''}` : 'const '}${symbol.name}`,
        ),
        ...(symbol.type ? [...t(': '), ...typeSegments(symbol.type)] : []),
        ...t(`${symbol.value ? ` = ${symbol.value}` : ''};`),
      ];
      break;
    case 'macro':
      body = t(`macro_rules! ${symbol.name}`);
      break;
    case 'module':
    case 'namespace':
    case 'package':
      body = t(`${visibility}${symbol.kind === 'namespace' ? 'namespace' : 'mod'} ${symbol.name}`);
      break;
    default:
      body = t(symbol.name);
  }

  return { segments: [...t(attributes), ...body], context };
}

/**
 * A member declaration: field, variant, property, enum member, associated item or index signature.
 */
export function memberDeclarationFragment(member: SymbolNode): CodeFragment {
  const rust = member.language === 'rust';

  if (member.kind === 'variant') {
    const shape = member.rust?.structKind;
    let tail: Segments = [];

    if (shape === 'tuple') {
      tail = [
        ...t('('),
        ...join(
          member.members.map((field) => (field.type ? typeSegments(field.type) : [])),
          ', ',
        ),
        ...t(')'),
      ];
    } else if (shape === 'plain') {
      tail = [
        ...t(' {\n'),
        ...member.members.flatMap((field) => [
          ...t(`    ${field.name}: `),
          ...(field.type ? typeSegments(field.type) : []),
          ...t(',\n'),
        ]),
        ...t('}'),
      ];
    }

    return {
      segments: [...t(member.name), ...tail, ...t(member.rust?.discriminant ? ` = ${member.rust.discriminant}` : '')],
      context: 'rust-variant',
    };
  }

  if (member.kind === 'associated-type') {
    return {
      segments: [
        ...t(`type ${member.name}`),
        ...typeParametersSegments(member.typeParameters, 'rust'),
        ...(member.type ? [...t(' = '), ...typeSegments(member.type)] : []),
        ...(member.rust?.bounds.length ? [...t(': '), ...boundsSegments(member.rust.bounds)] : []),
        ...whereSegments(member.whereClauses),
      ],
      context: 'rust-statement',
    };
  }

  if (member.kind === 'associated-constant') {
    return {
      segments: [
        ...t(`const ${member.name}: `),
        ...(member.type ? typeSegments(member.type) : t('_')),
        ...t(member.value ? ` = ${member.value}` : ''),
      ],
      context: 'rust-statement',
    };
  }

  const prefix = rust ? (member.kind === 'field' ? 'pub ' : '') : memberPrefix(member);
  const segments = [
    ...t(`${prefix}${member.name}${member.flags.includes('optional') ? '?' : ''}`),
    ...(member.type ? [...t(': '), ...typeSegments(member.type)] : []),
    ...t(member.kind === 'enum-member' && member.value ? ` = ${member.value}` : ''),
  ];

  return { segments, context: rust ? 'rust-field' : 'ts-member' };
}

/**
 * A method, function, constructor or accessor signature.
 *
 * @param symbol Owning symbol.
 * @param signature Signature to write.
 * @param topLevel True for module-level functions, which are written with the `function` keyword.
 */
export function signatureFragment(symbol: SymbolNode, signature: Signature, topLevel = false): CodeFragment {
  const rust = signature.signatureKind === 'fn';
  const long = signature.parameters.length > 2 || signatureLength(signature) > 88;
  const prefix = rust ? `${symbol.rust?.visibility ? `${symbol.rust.visibility} ` : ''}` : memberPrefix(symbol);
  const segments = signatureSegments(signature, {
    name: signature.signatureKind === 'construct' ? 'constructor' : symbol.name,
    multiline: long,
    prefix,
    functionKeyword: topLevel && !rust,
  });

  if (rust) return { segments, context: 'rust-statement' };

  return { segments, context: topLevel ? 'ts-statement' : 'ts-member' };
}

/** Heading of a Rust impl block: `impl<T> Trait for Type where ...`. */
export function implSegments(impl: {
  unsafe: boolean;
  typeParameters: TypeParameter[];
  trait?: TypeExpr;
  negative: boolean;
  forType: TypeExpr;
  whereClauses: WherePredicate[];
}): Segments {
  return [
    ...t(`${impl.unsafe ? 'unsafe ' : ''}impl`),
    ...typeParametersSegments(impl.typeParameters, 'rust'),
    ...t(' '),
    ...(impl.trait ? [...t(impl.negative ? '!' : ''), ...typeSegments(impl.trait), ...t(' for ')] : []),
    ...typeSegments(impl.forType),
    ...whereSegments(impl.whereClauses),
  ];
}
