import type { ReactNode } from 'react';
import { OverloadHashSync } from './overload-hash-sync';

/** Maximum number of overloads the stylesheet in `global.css` can switch between. */
export const MAX_OVERLOAD_TABS = 16;

/**
 * Tabs for TypeScript overloads, labelled "Overload 1", "Overload 2", and so on.
 *
 * Every panel is rendered into the static HTML so the documentation is indexable and readable
 * without JavaScript. Radio inputs and the `.ov-tabs` rules in `global.css` switch panels; the tiny
 * `OverloadHashSync` island only opens the right panel for direct links such as `#method-handle-overload-2`.
 *
 * @param id Unique id prefix for the group; it also namespaces the radio group.
 * @param panels One server-rendered panel per overload, in order.
 */
export function OverloadTabs({ id, panels }: { id: string; panels: ReactNode[] }) {
  const labels = panels.map((_, index) => `Overload ${index + 1}`);

  if (panels.length > MAX_OVERLOAD_TABS) {
    return (
      <div className="space-y-6">
        {panels.map((panel, index) => (
          <div key={index}>
            <p className="text-sm font-semibold">{labels[index]}</p>
            {panel}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="ov-tabs relative my-4 overflow-hidden rounded-xl border bg-fd-secondary">
      {labels.map((label, index) => (
        <input
          key={label}
          type="radio"
          name={`${id}-overloads`}
          id={`${id}-tab-${index + 1}`}
          defaultChecked={index === 0}
          aria-label={label}
        />
      ))}
      <div className="ov-list not-prose flex gap-3.5 overflow-x-auto px-4">
        {labels.map((label, index) => (
          <label
            key={label}
            htmlFor={`${id}-tab-${index + 1}`}
            className="inline-flex items-center whitespace-nowrap py-2 text-sm font-medium transition-colors"
          >
            {label}
          </label>
        ))}
      </div>
      <div className="ov-panels">
        {panels.map((panel, index) => (
          <div key={index} className="ov-panel prose-no-margin rounded-xl bg-fd-background p-4 text-[0.9375rem]">
            {panel}
          </div>
        ))}
      </div>
      <OverloadHashSync />
    </div>
  );
}
