import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function NextStep({ href, label }: { href: string; label: string }) {
  return (
    <div className="mt-10 border-t pt-6">
      <p className="text-sm font-medium text-fd-muted-foreground">Continue reading</p>
      <Link
        href={href}
        className="mt-3 flex items-center justify-between rounded-xl border border-fd-border bg-fd-card px-5 py-4 font-semibold transition-colors hover:border-fd-primary/60"
      >
        {label}
        <ArrowRight size={17} aria-hidden="true" />
      </Link>
    </div>
  );
}
