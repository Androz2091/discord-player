export class EventEmitter<L extends ListenerSignature<L> = DefaultListener> {
  public static defaultMaxListeners: number;
  public constructor(options?: { captureRejections?: boolean });
  public addListener<U extends keyof L>(event: U, listener: L[U]): this;
  public prependListener<U extends keyof L>(event: U, listener: L[U]): this;
  public prependOnceListener<U extends keyof L>(event: U, listener: L[U]): this;
  public removeListener<U extends keyof L>(event: U, listener: L[U]): this;
  public removeAllListeners(event?: keyof L): this;
  public once<U extends keyof L>(event: U, listener: L[U]): this;
  public on<U extends keyof L>(event: U, listener: L[U]): this;
  public off<U extends keyof L>(event: U, listener: L[U]): this;
  public emit<U extends keyof L>(event: U, ...args: Parameters<L[U]>): boolean;
  public eventNames<U extends keyof L>(): U[];
  public listenerCount(type: keyof L): number;
  public listeners<U extends keyof L>(type: U): L[U][];
  public rawListeners<U extends keyof L>(type: U): L[U][];
  public getMaxListeners(): number;
  public setMaxListeners(n: number): this;
}

export type ListenerSignature<L> = {
  [E in keyof L]: (...args: any[]) => any;
};

export type DefaultListener = {
  [k: string]: (...args: any[]) => any;
};
