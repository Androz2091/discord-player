import { cn } from '@/lib/cn';

/**
 * The Discord Player mark. It is drawn with a mask, so it uses the current text color and works in both themes.
 *
 * @param className Size and color utilities. The default is a 20px square in the current text color.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-5 shrink-0 bg-current', className)}
      style={{
        maskImage: 'url(/logo.png)',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        maskSize: 'contain',
        WebkitMaskImage: 'url(/logo.png)',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        WebkitMaskSize: 'contain',
      }}
    />
  );
}

/**
 * Brand lockup for navigation bars.
 *
 * @param compact Show only the mark on tablet and desktop. Use it where the title shares a row with other controls.
 */
export function BrandTitle({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Logo className="size-5" />
      <span className={cn('font-semibold', compact && 'md:sr-only')}>Discord Player</span>
    </span>
  );
}
