import Link from 'next/link';
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  ChevronDown,
  Code2,
  GitBranch,
  Github,
  Layers3,
  Puzzle,
  Zap,
} from 'lucide-react';
import styles from './page.module.css';

export const metadata = {
  title: 'Discord Player v8 | A modern music framework for Discord',
  description:
    'Native audio powered by Remedia, typed source plugins, and one playback engine for embedded and remote deployments.',
};

const highlights = [
  {
    icon: Zap,
    title: 'Native performance',
    description: 'Audio decoding and voice transport powered by Rust.',
  },
  {
    icon: Layers3,
    title: 'One engine',
    description: 'Consistent behavior with embedded or remote Remedia nodes.',
  },
  {
    icon: Puzzle,
    title: 'Plugin system',
    description: 'Typed source operations with legacy extractor compatibility.',
  },
  {
    icon: GitBranch,
    title: 'Library independent',
    description: 'Integrate through Discord Gateway payloads, without adapters.',
  },
];

const code = [
  [{ value: 'import ', kind: 'keyword' }, { value: '{ Player } ' }, { value: 'from ', kind: 'keyword' }, { value: "'discord-player'", kind: 'string' }, { value: ';' }],
  [],
  [{ value: 'const ', kind: 'keyword' }, { value: 'player = ' }, { value: 'new ', kind: 'keyword' }, { value: 'Player({' }],
  [{ value: '  nodes: [{ id: ' }, { value: "'local'", kind: 'string' }, { value: ', type: ' }, { value: "'embedded'", kind: 'string' }, { value: ' }],' }],
  [{ value: '  send: (guildId, packet) =>' }],
  [{ value: '    sendGateway(guildId, packet),' }],
  [{ value: '});' }],
  [{ value: 'await ', kind: 'keyword' }, { value: 'player.initialize(botUserId);' }],
] as const;

function CodePreview() {
  return (
    <div className={styles.editor} aria-label="Discord Player initialization">
      <div className={styles.editorHeader}>
        <span className={styles.dots} aria-hidden="true"><i /><i /><i /></span>
        <span>player.ts</span>
        <span className={styles.codeBadge}>v8</span>
      </div>
      <pre className={styles.code}><code>
        {code.map((segments, index) => (
          <span className={styles.codeLine} key={index}>
            <span className={styles.lineNumber} aria-hidden="true">{index + 1}</span>
            <span>
              {segments.map((segment, part) => (
                <span key={part} className={'kind' in segment ? styles[segment.kind] : undefined}>
                  {segment.value}
                </span>
              ))}
            </span>
            {'\n'}
          </span>
        ))}
      </code></pre>
      <div className={styles.editorFooter}>
        <span className={styles.remediaMark}><AudioLines size={17} aria-hidden="true" /> Powered by Remedia</span>
        <span>Same engine, local or remote.</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className={styles.site}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} href="/" aria-label="discord-player home">
            <AudioLines size={28} strokeWidth={2} aria-hidden="true" />
            <span>discord-player</span>
          </Link>
          <nav className={styles.nav} aria-label="Primary navigation">
            <Link href="/docs">Docs</Link>
            <Link href="/docs/reference/player">API</Link>
            <Link href="/docs/plugins">Plugins</Link>
            <Link href="/docs/migration">Migration</Link>
          </nav>
          <div className={styles.actions}>
            <a
              className={styles.github}
              aria-label="Open GitHub repository"
              href="https://github.com/Androz2091/discord-player"
              target="_blank"
              rel="noreferrer"
            >
              <Github size={21} aria-hidden="true" />
            </a>
            <details className={styles.version}>
              <summary>v8 <ChevronDown size={14} aria-hidden="true" /></summary>
              <div className={styles.versionMenu}>
                <Link href="/docs">v8 documentation</Link>
                <Link href="/docs/migration">Migrating from v7</Link>
                <a href="https://github.com/Androz2091/discord-player/releases" target="_blank" rel="noreferrer">
                  Releases
                </a>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main className={styles.container}>
        <section className={styles.hero} aria-labelledby="hero-heading">
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}><span /> DISCORD-PLAYER v8</div>
            <h1 id="hero-heading">The next generation music framework for Discord.</h1>
            <p className={styles.lede}>
              A high-performance audio framework powered by Remedia. Built for scale,
              extensibility, and consistent playback across local and remote nodes.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/docs/getting-started">
                Get started <ArrowRight size={19} aria-hidden="true" />
              </Link>
              <a
                className={styles.secondaryButton}
                href="https://github.com/Androz2091/discord-player"
                target="_blank"
                rel="noreferrer"
              >
                <Github size={19} aria-hidden="true" /> GitHub
              </a>
            </div>
          </div>
          <CodePreview />
        </section>

        <section className={styles.highlights} aria-label="Framework capabilities">
          {highlights.map(({ icon: Icon, title, description }) => (
            <div className={styles.highlight} key={title}>
              <Icon size={27} strokeWidth={1.8} aria-hidden="true" />
              <div>
                <h2>{title}</h2>
                <p>{description}</p>
              </div>
            </div>
          ))}
        </section>

        <section className={styles.following} aria-labelledby="following-heading">
          <div className={styles.followingCopy}>
            <p className={styles.sectionEyebrow}>DOCUMENTATION</p>
            <h2 id="following-heading">Start with the right guide.</h2>
            <p>Go from installation to your first playable track. If you have a v7 bot, migrate it one piece at a time.</p>
          </div>
          <div className={styles.paths}>
            <Link className={styles.path} href="/docs/getting-started">
              <BookOpen size={23} aria-hidden="true" />
              <span><strong>Build your first player</strong><small>Connect, add a source, and play audio.</small></span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className={styles.path} href="/docs/migration">
              <Code2 size={23} aria-hidden="true" />
              <span><strong>Upgrade from v7</strong><small>Follow the compatibility checklist and API changes.</small></span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <span>discord-player v8</span>
        <span>Audio powered by <a href="https://github.com/twlite/remedia" target="_blank" rel="noreferrer">Remedia</a></span>
        <Link href="/docs/architecture">Explore the architecture <ArrowRight size={14} aria-hidden="true" /></Link>
      </footer>
    </div>
  );
}
