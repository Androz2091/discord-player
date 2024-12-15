import { OPUS_MOD_REGISTRY } from '../src';
import { describe, it, expect } from 'vitest';

describe('@discord-player/opus', () => {
  it('should export opus module registry', () => {
    expect(Array.isArray(OPUS_MOD_REGISTRY)).toBe(true);
  });
});
