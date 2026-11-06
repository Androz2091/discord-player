import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { NextStep } from './next-step';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    NextStep,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
