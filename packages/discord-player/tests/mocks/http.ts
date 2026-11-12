import { vi } from 'vitest';

/** Install a typed fetch fake; no unit test needs a network connection. */
export function mockFetch() {
  const fetch = vi.fn<typeof globalThis.fetch>();

  fetch.mockRejectedValue(new Error('Unexpected HTTP request in unit test.'));
  vi.stubGlobal('fetch', fetch);

  return fetch;
}

/** Build a real Response around a controlled JSON body. */
export function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers });
}
