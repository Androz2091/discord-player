/** A dependency-free overview, complemented by the detailed Mermaid diagram in the MDX page. */
export function ArchitectureDiagram() {
  const nodes = [
    { x: 38, y: 38, w: 258, title: 'Bot application', detail: 'Commands + Discord Gateway', color: '#8b77aa' },
    { x: 340, y: 38, w: 258, title: 'Player', detail: 'Initialize + API surface', color: '#af89ef' },
    { x: 642, y: 38, w: 258, title: 'PluginRegistry', detail: 'Typed source operations', color: '#af89ef' },
    { x: 38, y: 170, w: 258, title: 'Gateway bridge', detail: 'send / receive · voice events', color: '#8b77aa' },
    { x: 340, y: 170, w: 258, title: 'GuildQueue', detail: 'Tracks · history · events', color: '#af89ef' },
    { x: 642, y: 170, w: 258, title: 'Source resolution', detail: 'Match · metadata · stream', color: '#af89ef' },
    { x: 340, y: 303, w: 560, title: '@remedia/client', detail: 'Node selection · sticky guild sessions · playback generations', color: '#7b9fb7' },
    { x: 340, y: 438, w: 258, title: 'Embedded node', detail: '@remedia/node · N-API', color: '#7b9fb7' },
    { x: 642, y: 438, w: 258, title: 'Remote node', detail: 'WebSocket → remedia-server', color: '#7b9fb7' },
    { x: 340, y: 568, w: 560, title: 'Shared Rust engine', detail: 'FFmpeg decode · filters · volume · Opus · secure voice', color: '#78afa0' },
    { x: 38, y: 568, w: 258, title: 'Discord voice', detail: 'Encrypted UDP audio output', color: '#78afa0' },
  ];

  const links = [
    [296, 81, 340, 81], [598, 81, 642, 81], [168, 118, 168, 170],
    [469, 118, 469, 170], [771, 118, 771, 170],
    [598, 213, 642, 213], [771, 250, 771, 303], [469, 250, 469, 303],
    [168, 250, 168, 347], [168, 347, 340, 347],
    [469, 380, 469, 438], [771, 380, 771, 438],
    [469, 525, 469, 568], [771, 525, 771, 568],
    [340, 609, 296, 609],
  ];

  return (
    <div className="my-7 overflow-x-auto rounded-xl border border-fd-border bg-fd-card p-4">
      <svg viewBox="0 0 940 664" role="img" aria-label="Discord Player v8 architecture: application and plugin host, managed queues, Remedia client, embedded or remote Rust engine, Discord voice output" className="min-w-[740px] w-full">
        <defs>
          <marker id="dp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill="#8d839d" />
          </marker>
        </defs>
        {links.map(([x1, y1, x2, y2], index) => (
          <path key={index} d={`M${x1} ${y1} L${x2} ${y2}`} fill="none" stroke="#8d839d" strokeWidth="1.7" markerEnd="url(#dp-arrow)" />
        ))}
        {nodes.map((n) => (
          <g key={n.title}>
            <rect x={n.x} y={n.y} width={n.w} height="86" rx="12" stroke={n.color} strokeOpacity=".8" fill="#17161f" />
            <text x={n.x + 18} y={n.y + 33} fill="#f2eef9" fontSize="17" fontWeight="700">{n.title}</text>
            <text x={n.x + 18} y={n.y + 57} fill="#ada5b9" fontSize="12">{n.detail}</text>
          </g>
        ))}
      </svg>
      <p className="mt-2 text-center text-xs text-fd-muted-foreground">Arrows show control, source, and media flow. The detailed component diagram follows below.</p>
    </div>
  );
}
