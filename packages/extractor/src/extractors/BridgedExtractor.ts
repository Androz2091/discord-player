import { BaseExtractor, type ExtractorExecutionContext } from 'discord-player';
import { BridgeProvider, BridgeSource, defaultBridgeProvider, IBridgeSource } from './common/BridgeProvider';

export interface BridgedOption {
    bridgeProvider?: BridgeProvider;
}

export class BridgedExtractor<T extends BridgedOption> extends BaseExtractor<T> {
    public constructor(context: ExtractorExecutionContext, options?: T | undefined) {
        super(context, options);
    }

    public setBridgeProvider(provider: BridgeProvider) {
        this.options.bridgeProvider = provider;
    }

    public setBridgeProviderSource(source: BridgeSource | IBridgeSource) {
        this.bridgeProvider.setBridgeSource(source);
    }

    public get bridgeProvider() {
        return this.options.bridgeProvider ?? defaultBridgeProvider;
    }
}
