import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Small pill used for kinds, modifiers, and status flags. */
export function Badge({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'warning' | 'accent';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 font-sans text-xs font-medium leading-none',
        tone === 'default' && 'bg-fd-muted/50 text-fd-muted-foreground',
        tone === 'warning' && 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        tone === 'accent' && 'border-fd-primary/30 bg-fd-primary/10 text-fd-primary',
      )}
    >
      {children}
    </span>
  );
}

/** Symbol kind label such as "Class" or "Trait". */
export function KindBadge({ children }: { children: ReactNode }) {
  return <Badge tone="accent">{children}</Badge>;
}
