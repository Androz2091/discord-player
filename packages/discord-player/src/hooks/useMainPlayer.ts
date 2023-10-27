import { Exceptions } from '../errors';
import { Util } from '../utils/Util';
import { getPlayer } from './common';

/**
 * Fetch main player instance
 * @deprecated
 */
export function useMasterPlayer() {
    Util.warn('useMasterPlayer() hook is deprecated, use useMainPlayer() instead.', 'DeprecationWarning');
    return useMainPlayer();
}

/**
 * Fetch main player instance
 */
export function useMainPlayer() {
    const instance = getPlayer();
    if (!instance) {
        throw Exceptions.ERR_ILLEGAL_HOOK_INVOCATION('useMainPlayer', 'This is likely caused by calling "useMainPlayer" hook before creating a player instance.');
    }

    return instance;
}
