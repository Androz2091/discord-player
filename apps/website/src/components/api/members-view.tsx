import { Link } from 'fumadocs-core/link';
import { Heading } from 'fumadocs-ui/components/heading';
import type { ReactNode } from 'react';
import type { Implementor, ModuleEntry, RustImpl, SymbolNode } from '@docs-scripts/model.ts';
import { implTitle, type PageSection } from '@docs-scripts/sections.ts';
import { implSegments, memberDeclarationFragment, typeSegments } from '@docs-scripts/segments.ts';
import { DeprecatedNotice, DocsDetails, DocsMarkdown } from './docs-view';
import { CodeSignature, InlineCode } from './code';
import { CallableView, DeclarationCode, Provenance } from './signature-view';
import { KindBadge, Badge } from './ui';

const CALLABLE = new Set(['method', 'function', 'constructor', 'accessor']);

/** Modifier badges shown next to a member name. */
function MemberBadges({ member }: { member: SymbolNode }) {
  const flags = member.flags.filter((flag) => flag !== 'inherited' && flag !== 'const' && flag !== 'mut');
  const rust = member.rust;

  return (
    <>
      {flags.map((flag) => (
        <Badge key={flag}>{flag}</Badge>
      ))}
      {member.docs.modifiers.map((modifier) => (
        <Badge key={modifier} tone="warning">
          {modifier}
        </Badge>
      ))}
      {member.docs.deprecated ? <Badge tone="warning">deprecated</Badge> : null}
      {rust?.provided === true ? <Badge>provided</Badge> : null}
      {rust?.provided === false ? <Badge>required</Badge> : null}
    </>
  );
}

/** One field, variant, property, or associated item as a highlighted declaration. */
function ValueDeclaration({ member }: { member: SymbolNode }) {
  return <CodeSignature fragment={memberDeclarationFragment(member)} />;
}

/** Documented member with a stable anchor, signature(s) and documentation. */
export async function MemberView({ member, level = 3 }: { member: SymbolNode; level?: 3 | 4 }) {
  const id = member.anchor ?? member.name;
  const callable = CALLABLE.has(member.kind) && member.signatures.length > 0;

  return (
    <section id={`${id}-section`} className="mt-8 first:mt-4">
      <Heading as={level === 3 ? 'h3' : 'h4'} id={id} className="flex flex-wrap items-center gap-2">
        <span className="font-mono">{member.name}</span>
        <MemberBadges member={member} />
      </Heading>
      <Provenance symbol={member} />
      {callable ? (
        <CallableView symbol={member} idPrefix={id} />
      ) : (
        <>
          <ValueDeclaration member={member} />
          <DeprecatedNotice docs={member.docs} />
          {member.docs.summary ? <DocsMarkdown doc={member.docs.summary} /> : null}
          <DocsDetails docs={member.docs} />
          {member.members.length > 0 && member.kind !== 'variant' ? (
            <div className="ms-4 border-s ps-4">
              {member.members.map((child) => (
                <MemberView key={child.key} member={child} level={4} />
              ))}
            </div>
          ) : null}
          {member.kind === 'variant' && member.members.some((field) => field.docs.summary) ? (
            <ul className="mt-2 space-y-2">
              {member.members
                .filter((field) => field.docs.summary)
                .map((field) => (
                  <li key={field.key} id={field.anchor}>
                    <code>{field.name}</code> {field.docs.summary ? <DocsMarkdown doc={field.docs.summary} /> : null}
                  </li>
                ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}

/** Rust impl block: heading, optional documentation, and its items. */
async function ImplView({ impl, collapsed }: { impl: RustImpl; collapsed: boolean }) {
  const heading = <InlineCode fragment={{ segments: implSegments(impl), context: 'rust-statement' }} />;

  if (impl.items.length === 0 && !impl.docs.summary) {
    return (
      <div id={impl.anchor} className="mt-3 rounded-lg border px-4 py-2" title={implTitle(impl)}>
        {heading}
      </div>
    );
  }

  return (
    <details id={impl.anchor} open={!collapsed} className="group mt-3 rounded-lg border">
      <summary className="cursor-pointer select-none px-4 py-2">{heading}</summary>
      <div className="border-t px-4 pb-4">
        {impl.docs.summary ? <DocsMarkdown doc={impl.docs.summary} className="mt-3" /> : null}
        {impl.items.map((item) => (
          <MemberView key={item.key} member={item} level={4} />
        ))}
      </div>
    </details>
  );
}

function ImplementorRow({ implementor }: { implementor: Implementor }) {
  return (
    <li>
      <InlineCode fragment={{ segments: typeSegments(implementor.forType), context: 'rust-type' }} />
      {implementor.href ? (
        <>
          {' '}
          <Link href={implementor.href} className="text-fd-muted-foreground hover:underline">
            (impl)
          </Link>
        </>
      ) : null}
    </li>
  );
}

function EntriesTable({ entries }: { entries: ModuleEntry[] }) {
  return (
    <div className="not-prose overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <tbody>
          {entries.map((entry) => (
            <tr
              key={`${entry.name}-${entry.target}-${entry.reexport ? 'r' : 'd'}`}
              className="border-t first:border-t-0 align-top"
            >
              <td className="w-px px-3 py-2 font-mono text-[0.8125rem] whitespace-nowrap">
                {entry.href ? (
                  <Link href={entry.href} className="text-fd-primary hover:underline">
                    {entry.name}
                  </Link>
                ) : (
                  entry.name
                )}
                {entry.deprecated ? <Badge tone="warning">deprecated</Badge> : null}
              </td>
              <td className="px-3 py-2 text-fd-muted-foreground">
                {entry.summary ? <EntrySummary text={entry.summary} /> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Summary text from the generator: inline code spans are kept, everything else is text. */
function EntrySummary({ text }: { text: string }): ReactNode {
  return <>{text.split('`').map((part, index) => (index % 2 === 1 ? <code key={index}>{part}</code> : part))}</>;
}

/** Renders every section of a symbol page in the order computed by `pageSections`. */
export function SectionsView({ sections }: { sections: PageSection[] }) {
  return (
    <>
      {sections.map((section) => (
        <div key={section.id} className="mt-10">
          <Heading as="h2" id={section.id}>
            {section.title}
          </Heading>
          {section.kind === 'members'
            ? section.members.map((member) => <MemberView key={member.key} member={member} />)
            : null}
          {section.kind === 'impls'
            ? section.impls.map((impl) => <ImplView key={impl.anchor} impl={impl} collapsed={section.collapsed} />)
            : null}
          {section.kind === 'implementors' ? (
            <ul className="list-none space-y-1 ps-0">
              {section.implementors.map((implementor, index) => (
                <ImplementorRow key={index} implementor={implementor} />
              ))}
            </ul>
          ) : null}
          {section.kind === 'entries' ? <EntriesTable entries={section.entries} /> : null}
        </div>
      ))}
    </>
  );
}

export { DeclarationCode, KindBadge };
