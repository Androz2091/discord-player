import type { Player } from '../../Player';
import { Collection } from '@discord-player/utils';

export const instances = new Collection<string, Player>();
export const globalRegistry = new Collection<string, unknown>();
