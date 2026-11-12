import { cpSync, rmSync } from 'node:fs';

// Templates ship inside dist/ because release tarballs may contain only dist/, README.md, and package metadata.
rmSync(new URL('../dist/templates', import.meta.url), { recursive: true, force: true });
cpSync(new URL('../templates', import.meta.url), new URL('../dist/templates', import.meta.url), { recursive: true });
