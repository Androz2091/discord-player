import { Link } from 'fumadocs-core/link';
import { highlight } from 'fumadocs-core/highlight';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import type { ComponentProps, ReactNode } from 'react';
import type { CodeContext, CodeFragment, Segment } from '@docs-scripts/segments.ts';
import { segmentsToText } from '@docs-scripts/segments.ts';

type Transformer = NonNullable<NonNullable<Parameters<typeof highlight>[1]>['transformers']>[number];

const THEMES = { light: 'github-light', dark: 'github-dark' } as const;

/**
 * Real TypeScript or Rust syntax context for a fragment. TextMate grammars color a bare member such as
 * `create(options: X): Promise<Y>` as a call expression, so members are placed inside a declaration
 * that makes them parse as members; the wrapper lines are removed again after highlighting.
 */
const WRAPPERS: Record<CodeContext, { lang: 'ts' | 'rust'; before: string; after: string; lines: boolean }> = {
  'ts-statement': { lang: 'ts', before: '', after: '', lines: false },
  'ts-member': { lang: 'ts', before: 'declare class _ {\n', after: '\n}', lines: true },
  'ts-type': { lang: 'ts', before: 'type _ = ', after: ';', lines: false },
  'rust-statement': { lang: 'rust', before: '', after: '', lines: false },
  'rust-field': { lang: 'rust', before: 'struct _ {\n', after: '\n}', lines: true },
  'rust-variant': { lang: 'rust', before: 'enum _ {\n', after: '\n}', lines: true },
  'rust-type': { lang: 'rust', before: 'type _ = ', after: ';', lines: false },
};

interface Range {
  start: number;
  end: number;
  segment: Segment;
}

/** Character ranges of linked segments inside the joined text. */
function linkRanges(segments: Segment[], base: number): Range[] {
  const ranges: Range[] = [];
  let offset = base;

  for (const segment of segments) {
    if (segment.href || segment.external) ranges.push({ start: offset, end: offset + segment.text.length, segment });

    offset += segment.text.length;
  }

  return ranges;
}

/** Shiki transformers that turn tokens inside a link range into anchors and drop wrapper lines. */
function transformers(
  source: string,
  ranges: Range[],
  wrapper: { before: string; after: string; lines: boolean },
): Transformer[] {
  const hideBefore = wrapper.before.length;
  const hideAfter = source.length - wrapper.after.length;
  const lineStarts = [0];

  for (let index = 0; index < source.length; index += 1) if (source[index] === '\n') lineStarts.push(index + 1);

  return [
    {
      name: 'remedia-api-links',
      span(node, line, col) {
        const first = node.children[0];
        const length = first?.type === 'text' ? first.value.length : 0;
        const start = (lineStarts[line - 1] ?? 0) + col;
        const end = start + length;

        if (!wrapper.lines && (start < hideBefore || end > hideAfter) && first?.type === 'text') {
          // Same-line wrapper text such as `type _ = ` is trimmed from the tokens that cover it.
          const from = Math.max(hideBefore - start, 0);
          const to = Math.min(hideAfter - start, length);

          first.value = from >= to ? '' : first.value.slice(from, to);

          return;
        }

        const text = first?.type === 'text' ? first.value : '';
        const lead = text.length - text.trimStart().length;
        const trimmed = text.trim();

        if (!trimmed) return;

        const from = start + lead;
        const range = ranges.find((candidate) => from >= candidate.start && from + trimmed.length <= candidate.end);

        if (!range) return;

        // Only the identifier is the link; surrounding whitespace in the token stays plain text.
        const properties: Record<string, string | string[]> = {
          href: range.segment.href ?? range.segment.external ?? '',
          className: ['api-link'],
        };

        if (range.segment.title) properties.title = range.segment.title;

        if (!range.segment.href) {
          properties.target = '_blank';
          properties.rel = ['noreferrer', 'noopener'];
        }

        node.children = [
          ...(lead > 0 ? [{ type: 'text' as const, value: text.slice(0, lead) }] : []),
          {
            type: 'element' as const,
            tagName: 'a',
            properties,
            children: [{ type: 'text' as const, value: trimmed }],
          },
          ...(text.length > lead + trimmed.length
            ? [{ type: 'text' as const, value: text.slice(lead + trimmed.length) }]
            : []),
        ];
      },
      code(node) {
        if (!wrapper.lines) return;

        const lines = node.children.filter((child) => child.type === 'element');
        const kept = lines.slice(1, -1);

        node.children = kept.flatMap((line, index) =>
          index === 0 ? [line] : [{ type: 'text' as const, value: '\n' }, line],
        );
      },
    },
  ];
}

const components = {
  a: (props: ComponentProps<'a'>) => (
    <Link
      {...props}
      href={props.href ?? '#'}
      className="api-link hover:underline"
      external={props.target === '_blank'}
    />
  ),
};

/** Highlight segments with Shiki, keeping linked type names as anchors. */
async function highlightFragment(
  fragment: CodeFragment,
  extra?: Partial<Parameters<typeof highlight>[1]>,
): Promise<ReactNode> {
  const wrapper = WRAPPERS[fragment.context];
  const code = `${wrapper.before}${segmentsToText(fragment.segments)}${wrapper.after}`;
  const ranges = linkRanges(fragment.segments, wrapper.before.length);

  return highlight(code, {
    lang: wrapper.lang,
    themes: THEMES,
    defaultColor: false,
    transformers: transformers(code, ranges, wrapper),
    components,
    ...extra,
  });
}

/**
 * Block of highlighted TypeScript or Rust built from the model, with type names linked to their
 * documentation. It uses the same Shiki themes and code block chrome as the authored guides.
 */
export async function CodeSignature({ fragment }: { fragment: CodeFragment }) {
  const body = await highlightFragment(fragment, {
    components: {
      ...components,
      pre: (props: ComponentProps<'pre'>) => (
        <CodeBlock {...(props as ComponentProps<typeof CodeBlock>)}>
          <Pre>{props.children}</Pre>
        </CodeBlock>
      ),
    },
  });

  return body;
}

/** Inline highlighted fragment for tables and prose, for example a parameter type. */
export async function InlineCode({ fragment }: { fragment: CodeFragment }) {
  const body = await highlightFragment(fragment, { structure: 'inline' });

  return <code className="api-inline whitespace-pre-wrap break-words">{body}</code>;
}
