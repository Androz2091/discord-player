import { cn } from '@/lib/cn';
import type { VersionBadgeConfig, VersionBadgeTone } from '@/lib/versions';

const toneClasses: Record<VersionBadgeTone, string> = {
  neutral: 'border-fd-border bg-fd-muted text-fd-muted-foreground',
  accent: 'border-fd-primary/30 bg-fd-primary/10 text-fd-primary',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  danger: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
};

/**
 * Small label displayed next to a version name. The text and tone come from `src/lib/versions.ts`.
 */
export function VersionBadge({ badge, className }: { badge: VersionBadgeConfig; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-1.5 py-px text-[0.6875rem] font-medium leading-4',
        toneClasses[badge.tone],
        className,
      )}
    >
      {badge.text}
    </span>
  );
}
