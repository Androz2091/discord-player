import type {
  DispatchPolicy,
  HandlerOptions,
  OperationInput,
  OperationContext,
  OperationName,
  OperationResult,
  PluginRegistration,
  SourcePluginContext,
} from './types.js';
import type { ExecuteOptions } from './execution-options.js';

/** Internal registration ownership record. */
export type Entry = {
  /** Reserved plugin identifier. */
  id: string;

  /** Registration-local declaration and options. */
  registration: PluginRegistration<any>;

  /** Registration-local setup context. */
  context: SourcePluginContext<any>;

  /** Registration lifetime cancellation. */
  controller: AbortController;

  /** Owned cleanup callbacks in registration order. */
  cleanups: Array<() => void | Promise<void>>;

  /** Handler promises that teardown must drain. */
  pending: Set<Promise<unknown>>;

  /** Setup completion, including failed-setup cleanup. */
  ready: Promise<void>;

  /** Whether new invocations may select this entry. */
  active: boolean;

  /** Shared teardown promise for repeated removal. */
  removing?: Promise<boolean>;
};

/** Internal handler subscription. */
export type Handler = HandlerOptions & {
  /** Registration owning this subscription. */
  entry: Entry;

  /** Operation handled by this subscription. */
  operation: OperationName;

  /** Erased handler implementation; public registration retains operation typing. */
  fn: (input: any, context: OperationContext) => unknown;

  /** Stable registration order within a priority tier. */
  order: number;
};

/** Internal callback preserving provider identity through stream resolution.
 * @param id Responsible source ID.
 * @param signal Source registration lifetime.
 */
export type HandledCallback = (id: string, signal: AbortSignal) => void;

/** Typed operation invocation shared by the host and its stream resolver.
 * @param operation Operation name.
 * @param input Typed operation input.
 * @param options Targeting and cancellation.
 * @param handled Optional source ownership callback.
 * @returns The operation policy's typed result.
 */
export type OperationRunner = <K extends OperationName>(
  operation: K,
  input: OperationInput<K>,
  options: ExecuteOptions,
  handled?: HandledCallback,
) => Promise<OperationResult<K>>;

/** Host state read by operation dispatch. */
export interface DispatchState {
  /** Subscriptions visible to the current dispatch. */
  handlers: Handler[];

  /** Operation dispatch policies. */
  definitions: Map<OperationName, DispatchPolicy>;

  /** Owning Player's disabled provider IDs. */
  blocked: () => readonly string[];

  /** Provider provenance retained for nested bridge results. */
  resultOwners: WeakMap<object, Entry>;
}
