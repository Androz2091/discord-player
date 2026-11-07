import { describe, expect, it } from 'vitest';
import { Queue, Stack } from '../src/index.js';

describe('bounded FIFO collections', () => {
  it.each([0, -1, Infinity, NaN])('treats %s as an unlimited capacity', (limit) => {
    const queue = new Queue<number>(limit);
    expect(queue.maxSize).toBe(Infinity);
    expect(queue.getCapacity()).toBe(Infinity);
    expect(queue.isFull()).toBe(false);
    expect(queue.add([1, 2, 3])).toBe(3);
  });

  it('enforces capacity for batches, insertion and self-merge without losing order', () => {
    const queue = new Queue<number>(3.9);
    expect(queue.maxSize).toBe(3);
    expect(queue.isEmpty()).toBe(true);
    expect(queue.add(1)).toBe(1);
    expect(queue.insert([2, 3, 4], 1)).toBe(2);
    expect(queue.enqueue(5)).toBe(false);
    expect(queue.getCapacity()).toBe(0);
    expect(queue.merge(queue)).toBe(0);
    expect(queue.dequeue()).toBe(1);
    const other = new Queue<number>();
    other.add([8, 9]);
    expect(queue.merge(other)).toBe(1);
    expect([...queue]).toEqual([2, 3, 8]);
    expect(queue.store).toEqual(queue.toArray());
    const detached = queue.toArray();
    detached.pop();
    expect(queue.size).toBe(3);
    expect(queue.peek()).toBe(2);
    expect(queue.at(-1)).toBe(8);
    expect(queue.dispatch()).toBe(2);
  });

  it('validates indexes and preserves values during move, swap and removal', () => {
    const queue = new Queue<number>();
    queue.add([1, 2, 3]);
    for (const index of [-1, 4, 0.5, NaN]) expect(() => queue.insert(4, index)).toThrow(RangeError);
    for (const index of [-1, 4, 0.5]) expect(queue.removeAt(index)).toBeUndefined();
    expect(queue.move(-1, 0)).toBe(false);
    expect(queue.move(0, 3)).toBe(false);
    expect(queue.move(0, 1.5)).toBe(false);
    expect(queue.move(0, 2)).toBe(true);
    expect(queue.toArray()).toEqual([2, 3, 1]);
    expect(queue.swap(-1, 0)).toBe(false);
    expect(queue.swap(0, 3)).toBe(false);
    expect(queue.swap(0, 1)).toBe(true);
    expect(queue.remove(99)).toBe(false);
    expect(queue.remove(2)).toBe(true);
    expect(queue.removeAt(0)).toBe(3);
    queue.clear();
    expect(queue.dispatch()).toBeUndefined();
    expect(queue.isEmpty()).toBe(true);
  });

  it('shuffles without adding or losing entries and exposes ordered collection operations', () => {
    const queue = new Queue<number>();
    queue.add([1, 2, 3]);
    expect(queue.find((value) => value === 2)).toBe(2);
    expect(queue.filter((value) => value > 1)).toEqual([2, 3]);
    expect(queue.map(String)).toEqual(['1', '2', '3']);
    const visited: number[] = [];
    queue.forEach((value) => visited.push(value));
    expect(visited).toEqual([1, 2, 3]);
    expect(queue.some((value) => value === 2)).toBe(true);
    expect(queue.every((value) => value > 0)).toBe(true);
    expect(queue.indexOf(3)).toBe(2);
    queue.shuffle();
    expect(queue.toArray().sort()).toEqual([1, 2, 3]);
  });
});

describe('bounded LIFO collections', () => {
  it('retains the newest values and applies resizing immediately', () => {
    const stack = new Stack<number>(2.9);
    stack.add([1, 2, 3]);
    expect(stack.maxSize).toBe(2);
    expect(stack.isFull()).toBe(true);
    expect(stack.store).toEqual([2, 3]);
    expect(stack.peek()).toBe(3);
    expect(stack.at(-2)).toBe(2);
    stack.setMaxSize(1);
    expect([...stack]).toEqual([3]);
    stack.setMaxSize(0);
    stack.add(4);
    expect(stack.maxSize).toBe(Infinity);
    expect(stack.isFull()).toBe(false);
    expect(stack.dispatch()).toBe(4);
    expect(stack.pop()).toBe(3);
    expect(stack.isEmpty()).toBe(true);
  });

  it('samples only retained entries and rejects invalid counts', () => {
    const stack = new Stack<number>();
    expect(stack.random()).toBeUndefined();
    expect(stack.random(3)).toEqual([]);
    stack.add([4, 5]);
    expect([4, 5]).toContain(stack.random());
    expect(stack.random(8)).toHaveLength(8);
    expect(stack.random(8).every((value) => [4, 5].includes(value))).toBe(true);
    expect(stack.random(0)).toEqual([]);
    for (const count of [-1, 0.5, NaN]) expect(() => stack.random(count)).toThrow(RangeError);
  });

  it('exposes ordered queries, independent copies and clearing', () => {
    const stack = new Stack<number>();
    stack.add([1, 2, 3]);
    expect(stack.find((value) => value === 2)).toBe(2);
    expect(stack.filter((value) => value > 1)).toEqual([2, 3]);
    expect(stack.map(String)).toEqual(['1', '2', '3']);
    const visited: number[] = [];
    stack.forEach((value) => visited.push(value));
    expect(visited).toEqual([1, 2, 3]);
    expect(stack.some((value) => value === 2)).toBe(true);
    expect(stack.every((value) => value > 0)).toBe(true);
    expect(stack.indexOf(3)).toBe(2);
    stack.toArray().pop();
    expect(stack.size).toBe(3);
    stack.clear();
    expect(stack.size).toBe(0);
  });
});

it('rejects fractional swap indexes without corrupting the FIFO contents', () => {
  const queue = new Queue<number>();
  queue.add([1, 2, 3]);

  expect(queue.swap(0.5, 1)).toBe(false);
  expect(queue.swap(0, NaN)).toBe(false);
  expect(queue.swap(0, 1.5)).toBe(false);
  expect(queue.toArray()).toEqual([1, 2, 3]);
});

it('validates random sample sizes even when the stack is empty', () => {
  const stack = new Stack<number>();

  expect(() => stack.random(-1)).toThrow(RangeError);
  expect(() => stack.random(0.5)).toThrow(RangeError);
  expect(stack.random(0)).toEqual([]);
});
