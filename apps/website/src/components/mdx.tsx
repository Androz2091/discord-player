import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Callout } from 'fumadocs-ui/components/callout';
import { Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import type { MDXComponents } from 'mdx/types';
import { ArchitectureDiagram } from './architecture-diagram';
import { Mermaid } from './mermaid';
import { NextStep } from './next-step';

/** Notice used by pages that document features available only in a development release. */
function DevelopmentOnly() {
  return <Callout type="info">This feature is currently available in dev release only.</Callout>;
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    ArchitectureDiagram,
    DevelopmentOnly,
    Mermaid,
    NextStep,
    Steps,
    Tab,
    Tabs,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
