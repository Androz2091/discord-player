import _rawDocs from '../data/docs.json';
import type { Documentation } from 'typedoc-nextra';

for (const prop in _rawDocs.modules) {
    // @ts-expect-error
    _rawDocs.modules[prop as keyof typeof _rawDocs.modules].classes.forEach((c) => (c.data.__type = 'class'));
    // @ts-expect-error
    _rawDocs.modules[prop as keyof typeof _rawDocs.modules].functions.forEach((c) => (c.data.__type = 'function'));
    // @ts-expect-error
    _rawDocs.modules[prop as keyof typeof _rawDocs.modules].types.forEach((c) => (c.data.__type = 'type'));
}

export const docs = _rawDocs as unknown as Documentation;
export const libNames = Object.values(_rawDocs.modules).map((m) => m.name);
