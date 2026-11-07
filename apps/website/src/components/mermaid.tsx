import { renderMermaidSVG } from 'beautiful-mermaid';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';

/** Renders authored Mermaid diagrams into the static HTML, with copyable source. */
export function Mermaid({ chart }: { chart: string }) {
  // Use system fonts and omit the renderer's external font imports for offline docs.
  const svg = renderMermaidSVG(chart, {
    bg: 'var(--color-fd-card)',
    fg: 'var(--color-fd-foreground)',
    accent: 'var(--color-fd-primary)',
    font: 'system-ui',
    transparent: true,
  }).replace(/^\s*@import .+;$/gm, '');

  return (
    <figure className="my-6 min-w-0">
      <div
        className="overflow-x-auto rounded-xl border border-fd-border bg-fd-card p-4"
        role="region"
        aria-label="Mermaid diagram"
        tabIndex={0}
      >
        <div className="[&_svg]:mx-auto [&_svg]:max-w-none" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-fd-muted-foreground">View Mermaid source</summary>
        <CodeBlock title="Mermaid source">
          <Pre>
            <code>{chart}</code>
          </Pre>
        </CodeBlock>
      </details>
    </figure>
  );
}
