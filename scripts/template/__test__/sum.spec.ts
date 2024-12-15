import { add } from '../src';
import { describe, it, expect } from 'vitest';

describe('Sum', () => {
  it('should add two numbers', () => {
    expect(add(2, 2)).toBe(4);
  });
});
