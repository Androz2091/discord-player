import { AsyncLocalStorage } from 'node:async_hooks';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type unsafe = any;

/**
 * The receiver function that will be called when the context is provided
 */
export type ContextReceiver<R> = () => R;

export class Context<T> {
  private storage = new AsyncLocalStorage<T>();

  public constructor(private defaultValue?: T) {}

  /**
   * Exit out of this context
   */
  public exit(scope: ContextReceiver<void>) {
    this.storage.exit(scope);
  }

  /**
   * Whether the context is lost
   */
  public get isLost() {
    return this.storage.getStore() === undefined;
  }

  /**
   * Get the current value of the context. If the context is lost and no default value is provided, undefined will be returned.
   */
  public consume(): T | undefined {
    const data = this.storage.getStore();

    if (data === undefined && this.defaultValue !== undefined)
      return this.defaultValue;

    return data;
  }

  /**
   * Run a function within the context of this provider
   */
  public provide<R = unsafe>(value: T, receiver: ContextReceiver<R>): R {
    if (value === undefined) {
      throw new Error('Context value may not be undefined');
    }

    if (typeof receiver !== 'function') {
      throw new Error('Context receiver must be a function');
    }

    return this.storage.run(value, receiver);
  }
}

/**
 * Create a new context. The default value is optional.
 * @param defaultValue The default value of the context
 * @example const userContext = createContext();
 *
 *  // the value to provide
 *  const user = {
 *   id: 1,
 *   name: 'John Doe'
 *  };
 *
 *  // provide the context value to the receiver
 *  context.provide(user, handler);
 *
 *  function handler() {
 *    // get the context value
 *    const { id, name } = useContext(context);
 *
 *    console.log(id, name); // 1, John Doe
 *  }
 */
export function createContext<T = unsafe>(defaultValue?: T): Context<T> {
  return new Context(defaultValue);
}

/**
 * Get the current value of the context. If the context is lost and no default value is provided, undefined will be returned.
 * @param context The context to get the value from
 * @example const value = useContext(context);
 */
export function useContext<T = unsafe>(context: Context<T>): T | undefined {
  return context.consume();
}
