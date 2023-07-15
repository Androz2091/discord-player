import { VoiceConnection, VoiceManager, VoiceManagerEvent } from '../src';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

describe('VoiceManager', () => {
    let manager: VoiceManager;

    beforeAll(() => {
        manager = new VoiceManager({
            ignoreStatus: false
        });
    });

    afterAll(() => {
        manager.destroy();
    });

    it('should return a VoiceConnection', () => {
        expect(
            manager.connect({
                channelId: '123',
                guildId: '456'
            })
        ).toBeInstanceOf(VoiceConnection);
    });

    it('should emit payload event', () => {
        const listener = vi.fn();

        manager.once(VoiceManagerEvent.Payload, listener);

        manager.connect({
            channelId: 'abc',
            guildId: 'do-re-mi'
        });

        expect(listener).toHaveBeenCalledOnce();
    });
});
