'use client';

import { useEffect } from 'react';

/**
 * Opens the overload tab that contains the element named by the URL hash. Without it, a direct link
 * such as `#method-handle-overload-2` would point at a hidden panel.
 */
export function OverloadHashSync() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));

      if (!id) return;

      const target = document.getElementById(id);
      const panel = target?.closest('.ov-panel');
      const group = panel?.closest('.ov-tabs');

      if (!target || !panel || !group) return;

      const index = Array.from(panel.parentElement?.children ?? []).indexOf(panel);
      const radio = group.querySelectorAll<HTMLInputElement>(':scope > input').item(index);

      if (radio && !radio.checked) {
        radio.checked = true;
        requestAnimationFrame(() => target.scrollIntoView());
      }
    };

    open();
    window.addEventListener('hashchange', open);

    return () => window.removeEventListener('hashchange', open);
  }, []);

  return null;
}
