import { instances } from './_container';

export function getPlayers() {
    return [...instances.values()];
}
