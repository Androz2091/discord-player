'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/cn';

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * A shell command with a button that copies it to the clipboard.
 *
 * @param command The command to display and copy.
 * @param label Accessible name of the command, for example "Create a v8 project".
 */
export function CopyCommand({ command, label }: { command: string; label: string }) {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);

    try {
      await navigator.clipboard.writeText(command);
      setState('copied');
    } catch {
      // Clipboard access can be blocked. The command stays selectable, so the visitor can copy it by hand.
      setState('failed');
    }

    timer.current = setTimeout(() => setState('idle'), 2000);
  }

  return (
    <div className="flex items-stretch overflow-hidden rounded-md border bg-fd-card">
      <code
        aria-label={label}
        className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap px-4 py-3 font-mono text-sm"
      >
        <span aria-hidden="true" className="select-none text-fd-muted-foreground">
          ${' '}
        </span>
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        className={cn(
          'inline-flex w-24 shrink-0 items-center justify-center gap-1.5 border-l text-xs font-medium transition-colors',
          'hover:bg-fd-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fd-ring',
        )}
      >
        {state === 'copied' ? (
          <Check className="size-3.5" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}
      </button>
      <span className="sr-only" role="status">
        {state === 'copied' ? 'Command copied' : state === 'failed' ? 'Could not copy the command' : ''}
      </span>
    </div>
  );
}
