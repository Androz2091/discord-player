import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

function Tier({
  title,
  detail,
  children,
  className,
}: {
  title: string;
  detail: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border bg-fd-background p-3.5', className)}>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-0.5 text-xs leading-5 text-fd-muted-foreground">{detail}</p>
      {children ? <div className="mt-3 flex flex-wrap gap-1.5">{children}</div> : null}
    </div>
  );
}

function Chip({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
  return (
    <span className={cn('rounded border bg-fd-card px-2 py-0.5 text-xs', mono && 'font-mono text-[0.6875rem]')}>
      {children}
    </span>
  );
}

/** A vertical connector with a label, used between tiers. */
function Link({ label }: { label: string }) {
  return (
    <div className="flex h-9 items-center gap-2 ps-6 text-[0.6875rem] text-fd-muted-foreground">
      <span aria-hidden="true" className="h-full w-px bg-fd-border" />
      {label}
    </div>
  );
}

/**
 * Sketch of a distributed v8 deployment: the bot controls Remedia nodes over WebSocket, searches source hosts over
 * HTTP, and the nodes fetch media from those hosts and send audio to Discord.
 */
export function Topology() {
  return (
    <figure className="rounded-xl border bg-fd-card p-4 shadow-sm md:p-5">
      <figcaption className="sr-only">
        A bot running Discord Player controls several Remedia audio nodes over WebSocket and searches source hosts over
        HTTP. The audio nodes fetch media from the source hosts and send audio to Discord voice.
      </figcaption>

      <Tier title="Your bot" detail="Discord Player: commands, queues, and events" />

      <div className="grid grid-cols-2 gap-4">
        <Link label="control · WebSocket" />
        <Link label="search · HTTP" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Tier title="Remedia nodes" detail="Rust: decode, filter, Opus, voice">
          <Chip mono>audio-1</Chip>
          <Chip mono>audio-2</Chip>
          <Chip mono>audio-n</Chip>
        </Tier>
        <Tier title="Source hosts" detail="Plugins and extractors, with their credentials">
          <Chip>plugins</Chip>
          <Chip>extractors</Chip>
        </Tier>
      </div>

      <p className="mt-3 flex items-center gap-2 text-[0.6875rem] text-fd-muted-foreground">
        <span aria-hidden="true">←</span> Nodes fetch media directly from the source hosts. The bot never opens the
        stream.
      </p>

      <div className="mt-1">
        <Link label="voice · UDP" />
      </div>

      <Tier title="Discord voice" detail="Encrypted Opus, one connection per guild" />
    </figure>
  );
}
