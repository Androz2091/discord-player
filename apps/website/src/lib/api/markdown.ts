import type { ApiPageFile, DocText, Docs, SymbolNode } from '@docs-scripts/model.ts';
import { isModuleLike, pageSections } from '@docs-scripts/sections.ts';
import { declarationToText, signatureToText, typeToText } from '@docs-scripts/text.ts';

const basePath = () => process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Documentation Markdown with `{@link}` placeholders and rustdoc links replaced by site URLs. */
function docMarkdown(doc: DocText | undefined): string {
  if (!doc) return '';

  let markdown = doc.markdown;

  for (const [key, link] of Object.entries(doc.links ?? {})) {
    const href = link.href ? `${basePath()}${link.href}` : link.external;

    if (href && key.startsWith('ref:')) markdown = markdown.replaceAll(`](${key})`, `](${href})`);
  }

  return markdown.trim();
}

function docsMarkdown(docs: Docs, level: number): string[] {
  const hashes = '#'.repeat(level);
  const out: string[] = [];

  if (docs.deprecated) out.push(`**Deprecated.** ${docMarkdown(docs.deprecated)}`.trim());

  if (docs.summary) out.push(docMarkdown(docs.summary));

  if (docs.remarks) out.push(`${hashes} Remarks`, docMarkdown(docs.remarks));

  for (const section of docs.sections) out.push(`${hashes} ${section.title}`, docMarkdown(section.body));

  if (docs.throws.length > 0) out.push(`${hashes} Throws`, ...docs.throws.map((doc) => `- ${docMarkdown(doc)}`));

  for (const example of docs.examples) out.push(`${hashes} ${example.title ?? 'Example'}`, docMarkdown(example.body));

  if (docs.see.length > 0) out.push(`${hashes} See also`, ...docs.see.map((doc) => `- ${docMarkdown(doc)}`));

  return out;
}

function fence(language: string, code: string): string {
  return `\`\`\`${language}\n${code}\n\`\`\``;
}

function memberMarkdown(member: SymbolNode, level: number): string[] {
  const language = member.language === 'rust' ? 'rust' : 'ts';
  const out: string[] = [`${'#'.repeat(level)} ${member.name}`];

  if (member.signatures.length > 0) {
    member.signatures.forEach((signature, index) => {
      if (member.signatures.length > 1) out.push(`**Overload ${index + 1}**`);

      out.push(fence(language, signatureToText(signature, { language: member.language })));

      for (const parameter of signature.parameters) {
        if (parameter.docs?.markdown.trim()) out.push(`- \`${parameter.name}\`: ${docMarkdown(parameter.docs)}`);
      }

      if (signature.returns?.docs) out.push(`Returns: ${docMarkdown(signature.returns.docs)}`);

      out.push(...docsMarkdown(signature.docs, level + 1));
    });
  } else {
    out.push(fence(language, declarationToText(member)));
  }

  out.push(...docsMarkdown(member.docs, level + 1));

  return out;
}

/**
 * Markdown rendering of a generated API page for `llms.txt` consumers and the copy-as-Markdown button.
 *
 * @param file Generated page content.
 * @returns Markdown with signatures, documentation, and absolute link destinations.
 */
export function apiPageToMarkdown(file: ApiPageFile): string {
  if (file.type === 'overview') {
    return [
      file.page.description,
      ...file.page.packages.map((pkg) => `- [${pkg.name}](${basePath()}${pkg.url}): ${pkg.description}`),
    ].join('\n\n');
  }

  const { page } = file;
  const symbol = page.symbol;
  const language = symbol.language === 'rust' ? 'rust' : 'ts';
  const out: string[] = [
    `\`${page.qualifiedName}\` — ${symbol.languageKind}${page.sourceUrl ? ` ([source](${page.sourceUrl}))` : ''}`,
  ];

  if (!isModuleLike(symbol) && symbol.signatures.length === 0) out.push(fence(language, declarationToText(symbol)));

  if (symbol.signatures.length > 0) {
    symbol.signatures.forEach((signature, index) => {
      if (symbol.signatures.length > 1) out.push(`**Overload ${index + 1}**`);

      out.push(
        fence(language, signatureToText(signature, { language: symbol.language })),
        ...docsMarkdown(signature.docs, 2),
      );
    });
  }

  out.push(...docsMarkdown(symbol.docs, 2));

  for (const section of pageSections(symbol, symbol.entries)) {
    out.push(`## ${section.title}`);

    if (section.kind === 'members') for (const member of section.members) out.push(...memberMarkdown(member, 3));

    if (section.kind === 'entries') {
      for (const entry of section.entries) {
        out.push(`- [${entry.name}](${basePath()}${entry.href ?? ''})${entry.summary ? `: ${entry.summary}` : ''}`);
      }
    }

    if (section.kind === 'impls') {
      for (const impl of section.impls) {
        out.push(`### ${impl.anchor}`, ...impl.items.flatMap((member) => memberMarkdown(member, 4)));
      }
    }

    if (section.kind === 'implementors') {
      for (const implementor of section.implementors) out.push(`- \`${typeToText(implementor.forType)}\``);
    }
  }

  return out.join('\n\n');
}
