interface Emittable {
  emit(...args: any[]): boolean;
}

type DerivedEmitterConstructor<T extends Emittable> = new () => Pick<T, 'emit'>;

/**
 * Creates a derived event emitter class that delegates the emit method to a target emitter.
 * @param derivationTarget The name of the property on the derived class that holds the target emitter.
 * @returns The derived event emitter class.
 */
export function DerivedEventEmitter<T extends Emittable>(derivationTarget: string): DerivedEmitterConstructor<T> {
  class Derived {
    /** The target emitter to delegate events to. */
    public emit(...args: unknown[]): boolean {
      const emitter = (this as unknown as Record<string, Emittable>)[derivationTarget];

      return emitter?.emit(...args) ?? false;
    }
  }

  return Derived as DerivedEmitterConstructor<T>;
}
