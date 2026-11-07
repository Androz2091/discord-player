import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Steps } from 'fumadocs-ui/components/steps';
import type { MDXComponents } from 'mdx/types';
import { ArchitectureDiagram } from './architecture-diagram';
import { Mermaid } from './mermaid';
import { NextStep } from './next-step';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    ArchitectureDiagram,
    Mermaid,
    NextStep,
    Steps,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
