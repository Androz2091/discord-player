import { OnBeforeCreateStreamHandler } from '../../manager';
import { getGlobalRegistry } from '../../utils/__internal__';

export function onBeforeCreateStream(handler: OnBeforeCreateStreamHandler) {
    getGlobalRegistry().set('@[onBeforeCreateStream]', handler);
}
