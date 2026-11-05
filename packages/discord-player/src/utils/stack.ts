import { randomInt } from 'node:crypto';

export class Stack<T> {
  private items: T[] = [];

  public constructor(private readonly maxSize: number) {}

  public push(item: T): void {
    if (this.items.length >= this.maxSize) {
      this.items.shift(); // Remove the oldest item if the stack is full
    }

    this.items.push(item);
  }

  public pop(): T | undefined {
    return this.items.pop();
  }

  public peek(): T | undefined {
    return this.items.at(-1);
  }

  public get size(): number {
    return this.items.length;
  }

  public clear(): void {
    this.items = [];
  }

  public isEmpty(): boolean {
    return this.items.length === 0;
  }

  public isFull(): boolean {
    return this.items.length >= this.maxSize;
  }

  public find(predicate: (item: T) => boolean): T | undefined {
    return this.items.find(predicate);
  }

  public filter(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate);
  }

  public map<U>(callback: (item: T) => U): U[] {
    return this.items.map(callback);
  }

  public forEach(callback: (item: T) => void): void {
    this.items.forEach(callback);
  }

  public some(predicate: (item: T) => boolean): boolean {
    return this.items.some(predicate);
  }

  public every(predicate: (item: T) => boolean): boolean {
    return this.items.every(predicate);
  }

  public indexOf(item: T): number {
    return this.items.indexOf(item);
  }

  public random(): T | undefined;
  public random(n: number): T[];
  public random(n?: number): T | T[] | undefined {
    if (this.isEmpty()) return undefined;
    if (!n) return this.items[randomInt(0, this.items.length)];

    return Array.from({ length: n }, () => this.items[randomInt(0, this.items.length)]!);
  }

  public toArray(): T[] {
    return Array.from(this.items);
  }
}
