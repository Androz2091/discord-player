// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type unsafe = any;

type FN = (...args: unsafe[]) => unsafe;
type IgnoreList = FN | Array<unsafe> | Map<unsafe, unsafe> | Set<unsafe> | WeakMap<unsafe, unsafe> | WeakSet<unsafe>;

export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends IgnoreList ? T[P] : DeepPartial<T[P]> | undefined;
};
