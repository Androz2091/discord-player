import { describe, expect, it } from 'vitest';
import { Queue } from '..';

describe('Queue', () => {
  it('should create queue', () => {
    const queue = new Queue();
    expect(queue).toBeInstanceOf(Queue);
  });

  it('should create LIFO queue', () => {
    const queue = new Queue('LIFO');
    expect(queue.strategy).toBe('LIFO');
  });

  it('should dispatch first item (FIFO)', () => {
    const queue = new Queue<number>('FIFO', [1, 2, 3]);
    queue.add(0);

    expect(queue.dispatch()).toBe(1);
  });

  it('should dispatch last item (LIFO)', () => {
    const queue = new Queue<number>('LIFO', [1, 2, 3]);
    queue.add(0);

    expect(queue.dispatch()).toBe(0);
  });

  it('should shuffle items', () => {
    const data = Array.from({ length: 40 }, (_, i) => i);
    const queue = new Queue('FIFO', data);
    queue.shuffle();

    expect(data).not.toContainEqual(queue.store);
  });
});
