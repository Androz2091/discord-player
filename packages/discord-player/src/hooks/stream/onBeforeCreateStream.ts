import { OnBeforeCreateStreamHandler } from '../../manager';
import { getGlobalRegistry } from '../../utils/__internal__';

/**
 * Global onBeforeCreateStream handler
 * @param handler The handler callback
 */
export function onBeforeCreateStream(handler: OnBeforeCreateStreamHandler) {
    getGlobalRegistry().set('@[onBeforeCreateStream]', handler);
}
