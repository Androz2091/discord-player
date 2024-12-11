import { OnAfterCreateStreamHandler } from '../../queue';
import { getGlobalRegistry } from '../../utils/__internal__';

/**
 * Global onAfterCreateStream handler
 * @param handler The handler callback
 */
export function onAfterCreateStream(handler: OnAfterCreateStreamHandler) {
  getGlobalRegistry().set('@[onAfterCreateStream]', handler);
}
