import { OnAfterCreateStreamHandler } from '../../Structures';
import { getGlobalRegistry } from '../../utils/__internal__';

export function onAfterCreateStream(handler: OnAfterCreateStreamHandler) {
    getGlobalRegistry().set('@[onAfterCreateStream]', handler);
}
