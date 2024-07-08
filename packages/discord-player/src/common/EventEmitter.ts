import { type DefaultListener, type ListenerSignature, EventEmitter as IEventEmitter } from '@discord-player/utils';

export type DebugCallback = (message: string) => void;

export type WithDebugger<L extends ListenerSignature<L>> = L & { debug: DebugCallback };

export const DEBUG_EVENT = 'debug';

export class EventEmitter<L extends ListenerSignature<L> = DefaultListener> extends IEventEmitter<WithDebugger<L>> {
    #hasDebugger = false;
    #debug: DebugCallback | null = null;

    public constructor(public requiredEvents: Array<keyof L> = []) {
        super();
    }

    public get debug() {
        return this.#debug;
    }

    public on<K extends keyof WithDebugger<L>>(name: K, listener: WithDebugger<L>[K]) {
        if (name === DEBUG_EVENT) {
            this.#hasDebugger = true;
            this.#setupDebugCallback();
        }

        return super.on(name, listener);
    }

    public once<K extends keyof WithDebugger<L>>(name: K, listener: WithDebugger<L>[K]) {
        if (name === DEBUG_EVENT) {
            this.#hasDebugger = true;
            this.#setupDebugCallback();
        }

        return super.once(name, listener);
    }

    public addListener<K extends keyof WithDebugger<L>>(name: K, listener: WithDebugger<L>[K]) {
        if (name === DEBUG_EVENT) {
            this.#hasDebugger = true;
            this.#setupDebugCallback();
        }

        return super.addListener(name, listener);
    }

    public off<K extends keyof WithDebugger<L>>(name: K, listener: WithDebugger<L>[K]) {
        this.#hasDebugger = this.listenerCount(DEBUG_EVENT) > 0;
        this.#setupDebugCallback();

        return super.off(name, listener);
    }

    public removeListener<K extends keyof WithDebugger<L>>(name: K, listener: WithDebugger<L>[K]) {
        this.#hasDebugger = this.listenerCount(DEBUG_EVENT) > 0;
        this.#setupDebugCallback();

        return super.removeListener(name, listener);
    }

    public removeAllListeners<K extends keyof WithDebugger<L>>(name?: K) {
        this.#hasDebugger = this.listenerCount(DEBUG_EVENT) > 0;
        this.#setupDebugCallback();

        return super.removeAllListeners(name);
    }

    public emit<K extends keyof WithDebugger<L>>(name: K, ...args: Parameters<WithDebugger<L>[K]>) {
        if (this.requiredEvents.includes(name as keyof L) && !this.eventNames().includes(name)) {
            // eslint-disable-next-line no-console
            console.error(...args);
            process.emitWarning(
                `No event listener found for event "${String(name)}". Events ${this.requiredEvents
                    .map((m) => `"${String(m)}"`)
                    .join(', ')} must have event listeners.`,
                'UnhandledEventsWarning',
            );
            return false;
        }

        return super.emit(name, ...args);
    }

    public get hasDebugger() {
        return this.#hasDebugger;
    }

    #setupDebugCallback() {
        const hasDebugger = this.listenerCount(DEBUG_EVENT) > 0;

        if (hasDebugger && !this.#debug) {
            // @ts-expect-error
            this.#debug = (message: string) => this.emit(DEBUG_EVENT, message);
        } else if (!hasDebugger && this.#debug) {
            this.#debug = null;
        }
    }
}
