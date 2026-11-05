/**
 * A bounded first-in-first-out collection.
 *
 * @template T The type of values stored in the queue.
 */
export class Queue<T> {
  /** The values currently stored in the queue, ordered from oldest to newest. */
  private items: T[] = [];

  /** The maximum number of values the queue can contain. */
  private readonly maxSize: number;

  /**
   * Creates a new queue.
   *
   * @param maxSize The maximum number of values the queue can contain.
   */
  public constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  /**
   * Adds a value to the back of the queue.
   *
   * If the queue is full, its oldest value is removed first.
   *
   * @param item The value to add.
   */
  public enqueue(item: T): void {
    if (this.maxSize > 0 && this.items.length >= this.maxSize) {
      this.items.shift();
    }

    this.items.push(item);
  }

  /**
   * Removes and returns the oldest value in the queue.
   *
   * @returns The removed value, or `undefined` when the queue is empty.
   */
  public dequeue(): T | undefined {
    return this.items.shift();
  }

  /**
   * Merges another queue or array into this queue, adding their values to the back of this queue.
   * @param otherQueueOrArray the other queue or array to merge into this queue.
   */
  public merge(otherQueueOrArray: Queue<T> | T[]): void {
    const otherItems = otherQueueOrArray instanceof Queue ? otherQueueOrArray.toArray() : otherQueueOrArray;

    this.items = this.items.concat(otherItems);
  }

  /**
   * Returns the oldest value in the queue without removing it.
   *
   * @returns The oldest value, or `undefined` when the queue is empty.
   */
  public peek(): T | undefined {
    return this.items[0];
  }

  /** The number of values currently stored in the queue. */
  public get size(): number {
    return this.items.length;
  }

  /** Removes all values from the queue. */
  public clear(): void {
    this.items = [];
  }

  /**
   * Indicates whether the queue contains no values.
   *
   * @returns `true` when the queue is empty; otherwise, `false`.
   */
  public isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Indicates whether the queue has reached its maximum size.
   *
   * @returns `true` when the queue is full; otherwise, `false`.
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
   * Runs a callback for every value in the queue.
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
   * Finds the position of a value in the queue.
   *
   * @param item The value to locate.
   * @returns The zero-based position, or `-1` when the value is not present.
   */
  public indexOf(item: T): number {
    return this.items.indexOf(item);
  }

  /**
   * Creates a shallow copy of the queue's values.
   *
   * @returns The queue values ordered from oldest to newest.
   */
  public toArray(): T[] {
    return Array.from(this.items);
  }
}
