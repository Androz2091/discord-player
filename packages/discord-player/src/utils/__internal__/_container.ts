import { Collection } from '@discord-player/utils';
import type { Player } from '../../Player';

export const instances = new Collection<string, Player>();
export const globalRegistry = new Collection<string, unknown>();
