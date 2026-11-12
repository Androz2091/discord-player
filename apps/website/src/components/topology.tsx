const nodeNames = ['audio-1', 'audio-2', 'audio-n'];
const hostNames = ['plugins', 'extractors'];

/**
 * Diagram of a distributed v8 deployment. The bot controls Remedia nodes over WebSocket and searches source hosts
 * over HTTP. The nodes pull media straight from the hosts and send audio to Discord. Flow lines animate unless the
 * visitor prefers reduced motion.
 */
export function Topology() {
  return (
    <svg
      viewBox="0 0 520 500"
      role="img"
      aria-label="A bot running Discord Player controls several Remedia audio nodes over WebSocket and searches source hosts over HTTP. The audio nodes pull media from the source hosts and send audio to Discord voice."
      className="h-auto w-full"
    >
      <defs>
        <marker
          id="topology-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M0 1 L9 5 L0 9 z" className="fill-teal-500" />
        </marker>
      </defs>

      {/* Bot */}
      <rect x="140" y="6" width="240" height="78" rx="14" className="fill-fd-foreground" />
      <text x="260" y="40" textAnchor="middle" className="fill-fd-background text-[19px] font-semibold">
        Your bot
      </text>
      <text x="260" y="62" textAnchor="middle" className="fill-fd-background/70 text-[16px]">
        Discord Player
      </text>

      {/* Control and search */}
      <path d="M205 84 V128 H120 V176" fill="none" strokeWidth="2" className="flow-line stroke-fd-primary" />
      <path d="M315 84 V128 H400 V176" fill="none" strokeWidth="2" className="flow-line stroke-teal-500" />
      <text x="162" y="120" textAnchor="middle" className="fill-fd-muted-foreground text-[15px]">
        control
      </text>
      <text x="360" y="120" textAnchor="middle" className="fill-fd-muted-foreground text-[15px]">
        search
      </text>

      {/* Remedia nodes */}
      <rect
        x="10"
        y="176"
        width="220"
        height="206"
        rx="14"
        strokeWidth="1.5"
        className="fill-fd-primary/10 stroke-fd-primary"
      />
      <text x="28" y="206" className="fill-fd-foreground text-[18px] font-semibold">
        Remedia nodes
      </text>
      <rect x="174" y="190" width="44" height="22" rx="11" className="fill-fd-primary" />
      <text x="196" y="205.5" textAnchor="middle" className="fill-white text-[13px] font-semibold">
        Rust
      </text>
      {nodeNames.map((name, index) => (
        <g key={name}>
          <rect
            x="26"
            y={224 + index * 50}
            width="188"
            height="40"
            rx="9"
            className="fill-fd-background stroke-fd-border"
          />
          <circle cx="44" cy={244 + index * 50} r="4.5" className="fill-emerald-500" />
          <text x="58" y={249 + index * 50} className="fill-fd-foreground font-mono text-[16px]">
            {name}
          </text>
        </g>
      ))}

      {/* Source hosts */}
      <rect
        x="290"
        y="176"
        width="220"
        height="206"
        rx="14"
        strokeWidth="1.5"
        className="fill-teal-500/10 stroke-teal-500"
      />
      <text x="308" y="206" className="fill-fd-foreground text-[18px] font-semibold">
        Source hosts
      </text>
      {hostNames.map((name, index) => (
        <g key={name}>
          <rect
            x="306"
            y={224 + index * 50}
            width="188"
            height="40"
            rx="9"
            className="fill-fd-background stroke-fd-border"
          />
          <text x="322" y={249 + index * 50} className="fill-fd-foreground font-mono text-[16px]">
            {name}
          </text>
        </g>
      ))}
      <text x="306" y="352" className="fill-fd-muted-foreground text-[15px]">
        Credentials stay here
      </text>

      {/* Media */}
      <path
        d="M290 300 H236"
        fill="none"
        strokeWidth="2"
        markerEnd="url(#topology-arrow)"
        className="flow-line stroke-teal-500"
      />
      <text x="263" y="290" textAnchor="middle" className="fill-fd-muted-foreground text-[15px]">
        media
      </text>

      {/* Voice */}
      <path d="M120 382 V430" fill="none" strokeWidth="2" className="flow-line stroke-fd-primary" />
      <text x="134" y="412" className="fill-fd-muted-foreground text-[15px]">
        voice
      </text>
      <rect
        x="10"
        y="430"
        width="220"
        height="64"
        rx="14"
        strokeWidth="1.5"
        className="fill-fd-background stroke-fd-border"
      />
      <text x="120" y="459" textAnchor="middle" className="fill-fd-foreground text-[18px] font-semibold">
        Discord voice
      </text>
      <text x="120" y="479" textAnchor="middle" className="fill-fd-muted-foreground text-[15px]">
        Encrypted Opus
      </text>

      <text x="306" y="462" className="fill-fd-muted-foreground text-[15px]">
        Nodes pull media directly.
      </text>
      <text x="306" y="482" className="fill-fd-muted-foreground text-[15px]">
        The bot never opens it.
      </text>
    </svg>
  );
}
