import { Util } from '../utils/Util';
import { getPlayer } from './common';

/**
 * Fetch main player instance
 * @deprecated
 */
export function useMasterPlayer() {
    Util.warn('useMasterPlayer() hook is deprecated, use useMainPlayer() instead.', 'DeprecationWarning');
    return getPlayer();
}

/**
 * Fetch main player instance
 */
export function useMainPlayer() {
    return getPlayer();
}
