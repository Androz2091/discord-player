import { DefaultListener } from '@discord-player/utils';
import { ListenerSignature } from '@discord-player/utils';
import { EventEmitter } from '@discord-player/utils';
import { Util } from './Util';

export class PlayerEventsEmitter<L extends ListenerSignature<L> = DefaultListener> extends EventEmitter<L> {
    public constructor(public requiredEvents: Array<keyof L> = []) {
        super();
    }

    public emit<K extends keyof L>(name: K, ...args: Parameters<L[K]>) {
        if (this.requiredEvents.includes(name) && !this.eventNames().includes(name)) {
            // eslint-disable-next-line no-console
            console.error(...args);
            Util.warn(
                `No event listener found for event "${String(name)}". Events ${this.requiredEvents.map((m) => `"${String(m)}"`).join(', ')} must have event listeners.`,
                'UnhandledEventsWarning'
            );
            return false;
        }

        return super.emit(name, ...args);
    }
}
