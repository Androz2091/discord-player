import { randomInt } from 'node:crypto';

/**
 * A bounded last-in-first-out collection.
 *
 * @template T The type of values stored in the stack.
 */
export class Stack<T> {
  /** The values currently stored in the stack, ordered from oldest to newest. */
  private items: T[] = [];

  /** The maximum number of values the stack can contain. */
  private readonly maxSize: number;

  /**
   * Creates a new stack.
   *
   * @param maxSize The maximum number of values the stack can contain.
   */
  public constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  /**
   * Adds a value to the top of the stack.
   *
   * If the stack is full, its oldest value is removed first.
   *
   * @param item The value to add.
   */
  public push(item: T): void {
    if (this.maxSize > 0 && this.items.length >= this.maxSize) {
      this.items.shift(); // Remove the oldest item if the stack is full
    }

    this.items.push(item);
  }

  /**
   * Removes and returns the value at the top of the stack.
   *
   * @returns The removed value, or `undefined` when the stack is empty.
   */
  public pop(): T | undefined {
    return this.items.pop();
  }

  /**
   * Returns the value at the top of the stack without removing it.
   *
   * @returns The top value, or `undefined` when the stack is empty.
   */
  public peek(): T | undefined {
    return this.items.at(-1);
  }

  /** The number of values currently stored in the stack. */
  public get size(): number {
    return this.items.length;
  }

  /** Removes all values from the stack. */
  public clear(): void {
    this.items = [];
  }

  /**
   * Indicates whether the stack contains no values.
   *
   * @returns `true` when the stack is empty; otherwise, `false`.
   */
  public isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Indicates whether the stack has reached its maximum size.
   *
   * @returns `true` when the stack is full; otherwise, `false`.
   */
  public isFull(): boolean {
    return this.items.length >= this.maxSize;
  }

  /**
   * Finds the first value that matches a predicate.
   *
   * @param predicate The function used to test each value.
   * @returns The first matching value, or `undefined` when no value matches.
   */
  public find(predicate: (item: T) => boolean): T | undefined {
    return this.items.find(predicate);
  }

  /**
   * Creates an array containing all values that match a predicate.
   *
   * @param predicate The function used to test each value.
   * @returns The matching values.
   */
  public filter(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate);
  }

  /**
   * Creates an array containing the result of applying a callback to every value.
   *
   * @param callback The function used to transform each value.
   * @returns The transformed values.
   */
  public map<U>(callback: (item: T) => U): U[] {
    return this.items.map(callback);
  }

  /**
   * Runs a callback for every value in the stack.
   *
   * @param callback The function to run for each value.
   */
  public forEach(callback: (item: T) => void): void {
    this.items.forEach(callback);
  }

  /**
   * Indicates whether at least one value matches a predicate.
   *
   * @param predicate The function used to test each value.
   * @returns `true` when a value matches; otherwise, `false`.
   */
  public some(predicate: (item: T) => boolean): boolean {
    return this.items.some(predicate);
  }

  /**
   * Indicates whether every value matches a predicate.
   *
   * @param predicate The function used to test each value.
   * @returns `true` when every value matches; otherwise, `false`.
   */
  public every(predicate: (item: T) => boolean): boolean {
    return this.items.every(predicate);
  }

  /**
   * Finds the position of a value in the stack.
   *
   * @param item The value to locate.
   * @returns The zero-based position, or `-1` when the value is not present.
   */
  public indexOf(item: T): number {
    return this.items.indexOf(item);
  }

  /**
   * Returns a random value or random values from the stack.
   *
   * @returns A random value, or `undefined` when the stack is empty.
   */
  public random(): T | undefined;

  /**
   * Returns random values from the stack. Values may be selected more than once.
   *
   * @param n The number of values to return.
   * @returns The selected values.
   */
  public random(n: number): T[];

  /**
   * Returns a random value or random values from the stack.
   *
   * @param n The number of values to return when provided.
   * @returns A random value, random values, or `undefined` when the stack is empty.
   */
  public random(n?: number): T | T[] | undefined {
    if (this.isEmpty()) return undefined;
    if (!n) return this.items[randomInt(0, this.items.length)];

    return Array.from({ length: n }, () => this.items[randomInt(0, this.items.length)]!);
  }

  /**
   * Creates a shallow copy of the stack's values.
   *
   * @returns The stack values ordered from oldest to newest.
   */
  public toArray(): T[] {
    return Array.from(this.items);
  }
}
