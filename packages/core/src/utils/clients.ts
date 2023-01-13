import { Collection } from '@discord-player/utils';
import type { SubscriptionClient } from '../worker/SubscriptionClient';

export const clients = new Collection<string, SubscriptionClient>();
