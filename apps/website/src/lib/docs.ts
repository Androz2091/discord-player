import _rawDocs from '../data/docs.json';
import type { Documentation } from 'typedoc-nextra';

export const docs = _rawDocs as unknown as Documentation;
export const libNames = Object.values(_rawDocs.modules).map((m) => m.name);
