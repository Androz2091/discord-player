import { OverloadTabs } from './overload-tabs';
import type { Parameter, Signature, SymbolNode, TypeExpr, TypeParameter } from '@docs-scripts/model.ts';
import { declarationFragment, signatureFragment, typeSegments } from '@docs-scripts/segments.ts';
import { CodeSignature, InlineCode } from './code';
import { DeprecatedNotice, DocsDetails, DocsMarkdown } from './docs-view';

/** Inline highlighted type, linking every documented symbol it mentions. */
export function TypeCode({ type, language }: { type: TypeExpr; language: 'typescript' | 'rust' }) {
  return (
    <InlineCode
      fragment={{
        segments: typeSegments(type),
        context: language === 'rust' ? 'rust-type' : 'ts-type',
      }}
    />
  );
}

/** Source-level declaration of a symbol such as `class RemediaClient`, `pub struct Foo`, or `type Alias = ...`. */
export function DeclarationCode({ symbol }: { symbol: SymbolNode }) {
  return <CodeSignature fragment={declarationFragment(symbol)} />;
}

/** Signature of a method, function, constructor, or accessor as a highlighted code block. */
export function SignatureCode({ symbol, signature }: { symbol: SymbolNode; signature: Signature }) {
  return <CodeSignature fragment={signatureFragment(symbol, signature, symbol.kind === 'function')} />;
}

/** Parameter table with types and documentation. */
export function ParametersTable({
  parameters,
  language,
}: {
  parameters: Parameter[];
  language: 'typescript' | 'rust';
}) {
  if (parameters.length === 0) return null;

  return (
    <div className="my-3">
      <h4 className="mb-1 text-sm font-semibold text-fd-foreground">Parameters</h4>
      <div className="not-prose overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-fd-muted/50 text-start">
            <tr>
              <th className="px-3 py-2 text-start font-medium">Name</th>
              <th className="px-3 py-2 text-start font-medium">Type</th>
              <th className="px-3 py-2 text-start font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {parameters.map((parameter, index) => (
              <tr key={index} className="border-t align-top">
                <td className="px-3 py-2 font-mono text-[0.8125rem]">
                  {parameter.rest ? '...' : null}
                  {parameter.name}
                  {parameter.optional && parameter.defaultValue === undefined ? (
                    <span className="text-fd-muted-foreground" title="Optional">
                      ?
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 font-mono text-[0.8125rem] whitespace-pre-wrap">
                  {parameter.type ? <TypeCode type={parameter.type} language={language} /> : null}
                  {parameter.defaultValue === undefined ? null : (
                    <span className="block text-fd-muted-foreground">Default: {parameter.defaultValue}</span>
                  )}
                </td>
                <td className="px-3 py-2">{parameter.docs ? <DocsMarkdown doc={parameter.docs} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Documented generic parameters. Parameters without documentation are already visible in the signature. */
function TypeParametersTable({ parameters }: { parameters: TypeParameter[] }) {
  const documented = parameters.filter((parameter) => parameter.docs?.markdown.trim());

  if (documented.length === 0) return null;

  return (
    <div className="my-3">
      <h4 className="mb-1 text-sm font-semibold text-fd-foreground">Type parameters</h4>
      <ul className="space-y-1">
        {documented.map((parameter) => (
          <li key={parameter.name}>
            <code>{parameter.name}</code>
            {parameter.docs ? <DocsMarkdown doc={parameter.docs} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Return type and its documentation. */
async function ReturnsBlock({ signature }: { signature: Signature }) {
  if (!signature.returns) return null;

  return (
    <div className="my-3">
      <h4 className="mb-1 text-sm font-semibold text-fd-foreground">Returns</h4>
      <p>
        <TypeCode type={signature.returns.type} language={signature.signatureKind === 'fn' ? 'rust' : 'typescript'} />
      </p>
      {signature.returns.docs ? <DocsMarkdown doc={signature.returns.docs} /> : null}
    </div>
  );
}

/** Documentation of one signature: summary, deprecation, parameters, returns, throws, examples. */
export async function SignatureDocs({
  signature,
  fallback,
}: {
  signature: Signature;
  /** Symbol-level documentation used when the signature has none of its own. */
  fallback?: SymbolNode['docs'];
}) {
  const docs =
    signature.docs.summary || signature.docs.remarks || signature.docs.examples.length
      ? signature.docs
      : (fallback ?? signature.docs);

  return (
    <>
      <DeprecatedNotice docs={docs} />
      {docs.summary ? <DocsMarkdown doc={docs.summary} /> : null}
      <TypeParametersTable parameters={signature.typeParameters} />
      <ParametersTable
        parameters={signature.parameters}
        language={signature.signatureKind === 'fn' ? 'rust' : 'typescript'}
      />
      <ReturnsBlock signature={signature} />
      <DocsDetails docs={docs} />
    </>
  );
}

/**
 * Signature(s) of a callable symbol. A single signature renders inline; overloads render as tabs
 * labelled "Overload 1", "Overload 2", and so on, each with its own signature, parameters, return
 * information, and examples. All tab panels are present in the server-rendered HTML.
 */
export async function CallableView({ symbol, idPrefix }: { symbol: SymbolNode; idPrefix: string }) {
  const signatures = symbol.signatures;
  const overloads = signatures.filter(
    (signature) =>
      signature.signatureKind === 'call' || signature.signatureKind === 'construct' || signature.signatureKind === 'fn',
  );

  if (overloads.length > 1) {
    return (
      <OverloadTabs
        id={idPrefix}
        panels={overloads.map((signature, index) => (
          <div key={index} id={`${idPrefix}-overload-${index + 1}`}>
            <SignatureCode symbol={symbol} signature={signature} />
            <SignatureDocs signature={signature} fallback={symbol.docs} />
          </div>
        ))}
      />
    );
  }

  return (
    <>
      {signatures.map((signature, index) => (
        <div key={index}>
          <SignatureCode symbol={symbol} signature={signature} />
          {signature.signatureKind === 'set' ? null : <SignatureDocs signature={signature} fallback={symbol.docs} />}
        </div>
      ))}
    </>
  );
}

/** Provenance line for inherited, overriding, or implementing members. */
export function Provenance({ symbol }: { symbol: SymbolNode }) {
  const lines: [string, SymbolNode['extends'][number] | undefined][] = [
    ['Inherited from', symbol.ts?.inheritedFrom],
    ['Overrides', symbol.ts?.overwrites],
    ['Implementation of', symbol.ts?.implementationOf],
  ];
  const shown = lines.filter(([, type]) => type?.kind === 'reference');

  if (shown.length === 0) return null;

  return (
    <p className="text-sm text-fd-muted-foreground">
      {shown.map(([label, type], index) =>
        type ? (
          <span key={label}>
            {index > 0 ? ' · ' : null}
            {label} <TypeCode type={type} language="typescript" />
          </span>
        ) : null,
      )}
    </p>
  );
}
