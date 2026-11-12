import { Readable } from 'node:stream';
import type { Track } from '../structures/track.js';
import { PluginError } from './plugin-error.js';
import type { ExecuteOptions } from './execution-options.js';
import type { DispatchState, HandledCallback } from './registry-internals.js';
import type { OperationInput, OperationName, OperationResult } from './types.js';

/** Select active, permitted handlers using the dispatcher's own routing rules.
 * @internal
 * @param operation Operation being inspected.
 * @param input Routing input.
 * @param options Provider targeting and block list.
 * @param state Current registry state.
 * @returns Ordered applicable subscriptions without invoking them.
 */
export function selectHandlers(
  operation: OperationName,
  input: unknown,
  options: ExecuteOptions,
  state: DispatchState,
) {
  return (state.handlers.get(operation) ?? []).filter(
    (handler) =>
      handler.entry.active &&
      (!handler.guildIds ||
        (typeof input === 'object' &&
          input !== null &&
          'guildId' in input &&
          typeof input.guildId === 'string' &&
          handler.guildIds.includes(input.guildId))) &&
      (!options.pluginId || handler.entry.id === options.pluginId) &&
      (options.hostId === undefined ||
        (handler.entry.registration.definition.remoteHost?.hostId ?? null) === options.hostId) &&
      !options.blocked?.includes(handler.entry.id) &&
      !state.blocked().includes(handler.entry.id) &&
      (!(input as { protocol?: string }).protocol ||
        !handler.protocols?.length ||
        handler.protocols?.includes((input as { protocol: string }).protocol)),
  );
}

/** Dispatch a typed operation against initialized host state.
 * @internal
 * @param operation Operation name.
 * @param input Typed payload.
 * @param options Targeting and cancellation.
 * @param state Owned host state.
 * @param handled Optional resolved-provider callback.
 * @returns Result selected by the operation's declared dispatch policy.
 */
export async function dispatchOperation<K extends OperationName>(
  operation: K,
  input: OperationInput<K>,
  options: ExecuteOptions,
  state: DispatchState,
  handled?: HandledCallback,
): Promise<OperationResult<K>> {
  const policy = state.definitions.get(operation);

  if (!policy) {
    throw new Error(`Undefined operation: ${operation}`);
  }

  const handlers = selectHandlers(operation, input, options, state);
  const results: unknown[] = [];
  let value: unknown = input;

  for (const handler of handlers) {
    if (!handler.entry.active) {
      continue;
    }

    const signal = options.signal
      ? AbortSignal.any([options.signal, handler.entry.controller.signal])
      : handler.entry.controller.signal;

    signal.throwIfAborted();

    const pending = Promise.resolve().then(() => {
      signal.throwIfAborted();

      return handler.fn(policy === 'pipe' ? value : input, { signal });
    });

    handler.entry.pending.add(pending);

    let result: unknown;

    try {
      result = await pending;

      if (signal.aborted) {
        if (result instanceof Readable) {
          result.destroy();
        } else if (result && typeof result === 'object' && 'stream' in result && result.stream instanceof Readable) {
          result.stream.destroy();
        }

        signal.throwIfAborted();
      }
    } catch (error) {
      if (
        (operation === 'stream.transform' || operation === 'media.transform') &&
        value &&
        typeof value === 'object' &&
        'stream' in value &&
        value.stream instanceof Readable
      )
        value.stream.destroy();
      if (signal.aborted) {
        throw signal.reason;
      }
      throw new PluginError(handler.entry.id, operation, error);
    } finally {
      handler.entry.pending.delete(pending);
    }

    if (result === undefined) {
      continue;
    }

    if ((operation === 'search.query.resolve' || operation === 'track.related') && result !== null) {
      for (const track of (result as { tracks: Track[] }).tracks) {
        track.sourceReference ??= { pluginId: handler.entry.id, data: { url: track.url } };
      }
    }

    if (operation === 'search.query.match' && result !== null) {
      result = {
        ...(result as object),
        pluginId: handler.entry.id,
        ...(handler.entry.registration.definition.remoteHost
          ? { hostId: handler.entry.registration.definition.remoteHost.hostId }
          : {}),
      };
    }

    if (policy === 'first') {
      let owner = handler.entry;

      if (
        (operation === 'track.stream' || operation === 'track.bridge') &&
        result !== null &&
        typeof result === 'object'
      ) {
        owner = state.resultOwners.get(result) ?? owner;
        state.resultOwners.set(result, owner);
      }

      handled?.(owner.id, owner.controller.signal);

      return result as OperationResult<K>;
    }

    if (policy === 'pipe') {
      if (operation === 'stream.transform' || operation === 'media.transform') {
        const previous = value as { track: Track; stream: Readable };
        const next = result as { track: Track; stream: Readable };
        if (!next || next.track !== previous.track || !(next.stream instanceof Readable)) {
          previous.stream.destroy();
          if (next?.stream instanceof Readable) next.stream.destroy();
          throw new PluginError(
            handler.entry.id,
            operation,
            new TypeError('Encoded transforms must preserve Track identity and return a Readable.'),
          );
        }
        const dispose = () => {
          previous.stream.destroy();
          next.stream.destroy();
        };
        signal.addEventListener('abort', dispose, { once: true });
        next.stream.once('close', () => {
          signal.removeEventListener('abort', dispose);
          if (previous.stream !== next.stream) previous.stream.destroy();
        });
      }
      value = result;
    }

    if (policy === 'collect') {
      results.push(result);
    }
  }

  if (operation === 'search.query.match') {
    // Priority tiers precede confidence, preserving legacy precedence.
    const priority = (id?: string) => handlers.find((handler) => handler.entry.id === id)?.priority ?? 0;

    results.sort(
      (a: any, b: any) =>
        priority(b?.pluginId) - priority(a?.pluginId) || (b?.score ?? -Infinity) - (a?.score ?? -Infinity),
    );
  }

  return (policy === 'collect' ? results : policy === 'pipe' ? value : undefined) as OperationResult<K>;
}
