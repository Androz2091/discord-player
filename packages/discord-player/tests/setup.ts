import { beforeEach, vi } from 'vitest';
import { RemediaClient } from '@remedia/client';

// Unit tests opt into a reusable fake explicitly. Unexpected external work fails immediately.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockRejectedValue(new Error('Unexpected HTTP request. Install mockFetch().')),
  );
  vi.spyOn(RemediaClient, 'create').mockRejectedValue(
    new Error('Unexpected Remedia initialization. Install a mock backend.'),
  );
});
