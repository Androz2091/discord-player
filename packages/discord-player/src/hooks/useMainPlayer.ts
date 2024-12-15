import { useHooksContext } from './common';

/**
 * Fetch main player instance
 */
export function useMainPlayer() {
  const { player } = useHooksContext('useMainPlayer', true);

  return player;
}
