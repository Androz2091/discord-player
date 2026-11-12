import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { OUTPUT_DIR, REPO_ROOT } from '../config.ts';
import { verifyExport } from '../verify-export.ts';

const outDir = join(REPO_ROOT, 'apps', 'website', 'out');
const exported = existsSync(join(outDir, 'docs', 'api', 'index.html')) && existsSync(join(OUTPUT_DIR, 'manifest.json'));

describe('static export of the API reference', () => {
  it(
    'serves complete, searchable pages from the exported HTML',
    { skip: exported ? false : 'run `pnpm --filter @discord-player/website build` first to produce apps/website/out' },
    () => {
      assert.deepEqual(verifyExport({ outDir, basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '' }), []);
    },
  );
});
