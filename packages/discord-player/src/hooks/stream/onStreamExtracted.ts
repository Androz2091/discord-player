import { OnStreamExtractedHandler } from '../../queue';
import { getGlobalRegistry } from '../../utils/__internal__';

/**
 * Global onStreamExtracted handler
 * @param handler The handler callback
 */
export function onStreamExtracted(handler: OnStreamExtractedHandler) {
  getGlobalRegistry().set('@[onStreamExtracted]', handler);
}
