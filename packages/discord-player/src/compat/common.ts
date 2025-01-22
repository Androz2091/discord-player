/* eslint-disable @typescript-eslint/no-explicit-any */

export const DiscordPlayerClientSymbol = Symbol('DiscordPlayerClient');

export type CompatProvider = 'Eris' | 'Oceanic';

export interface CompatClient {
  provider: CompatProvider;
  client: any;
}

export function createCompatClient(
  client: any,
  provider: CompatProvider,
): CompatClient {
  Reflect.set(client, DiscordPlayerClientSymbol, provider);
  return {
    provider,
    client,
  };
}

export function isClientProxy(client: any): boolean {
  return Reflect.get(client, DiscordPlayerClientSymbol) != null;
}

export function getCompatName(client: any): CompatProvider | null {
  return Reflect.get(client, DiscordPlayerClientSymbol) ?? null;
}

export function isErisProxy(client: any): boolean {
  return getCompatName(client) === 'Eris';
}

export function isOceanicProxy(client: any): boolean {
  return getCompatName(client) === 'Oceanic';
}
