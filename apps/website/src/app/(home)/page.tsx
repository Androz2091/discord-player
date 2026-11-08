import Link from 'next/link';
import { DiscordInvite } from '@/components/discord-invite';
import { discordInviteUrl } from '@/lib/shared';
import { ArrowRight, AudioLines, BookOpen, ChevronDown, Code2, GitBranch, Layers3, Puzzle, Zap } from 'lucide-react';
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
  [
    { value: 'import ', kind: 'keyword' },
    { value: '{ Player } ' },
    { value: 'from ', kind: 'keyword' },
    { value: "'discord-player'", kind: 'string' },
    { value: ';' },
  ],
  [],
  [
    { value: 'const ', kind: 'keyword' },
    { value: 'player = ' },
    { value: 'new ', kind: 'keyword' },
    { value: 'Player({' },
  ],
  [
    { value: '  nodes: [{ id: ' },
    { value: "'local'", kind: 'string' },
    { value: ', type: ' },
    { value: "'embedded'", kind: 'string' },
    { value: ' }],' },
  ],
  [{ value: '  send: (guildId, packet) =>' }],
  [{ value: '    sendGateway(guildId, packet),' }],
  [{ value: '});' }],
  [{ value: 'await ', kind: 'keyword' }, { value: 'player.initialize(botUserId);' }],
] as const;

function GitHubIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function CodePreview() {
  return (
    <div className={styles.editor} aria-label="Discord Player initialization">
      <div className={styles.editorHeader}>
        <span className={styles.dots} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>player.ts</span>
        <span className={styles.codeBadge}>v8</span>
      </div>
      <pre className={styles.code}>
        <code>
          {code.map((segments, index) => (
            <span className={styles.codeLine} key={index}>
              <span className={styles.lineNumber} aria-hidden="true">
                {index + 1}
              </span>
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
        </code>
      </pre>
      <div className={styles.editorFooter}>
        <span className={styles.remediaMark}>
          <AudioLines size={17} aria-hidden="true" /> Powered by Remedia
        </span>
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
            <a href={discordInviteUrl} target="_blank" rel="noopener noreferrer">
              Discord
            </a>
          </nav>
          <div className={styles.actions}>
            <a
              className={styles.github}
              aria-label="Open GitHub repository"
              href="https://github.com/Androz2091/discord-player"
              target="_blank"
              rel="noreferrer"
            >
              <GitHubIcon size={21} />
            </a>
            <details className={styles.version}>
              <summary>
                v8 <ChevronDown size={14} aria-hidden="true" />
              </summary>
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
            <div className={styles.eyebrow}>
              <span /> DISCORD-PLAYER v8
            </div>
            <h1 id="hero-heading">The next generation music framework for Discord.</h1>
            <p className={styles.lede}>
              A high-performance audio framework powered by Remedia. Built for scale, extensibility, and consistent
              playback across local and remote nodes.
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
                <GitHubIcon size={19} /> GitHub
              </a>
            </div>
            <DiscordInvite />
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
            <p>
              Go from installation to your first playable track. If you have a v7 bot, migrate it one piece at a time.
            </p>
          </div>
          <div className={styles.paths}>
            <Link className={styles.path} href="/docs/getting-started">
              <BookOpen size={23} aria-hidden="true" />
              <span>
                <strong>Build your first player</strong>
                <small>Connect, add a source, and play audio.</small>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className={styles.path} href="/docs/migration">
              <Code2 size={23} aria-hidden="true" />
              <span>
                <strong>Upgrade from v7</strong>
                <small>Follow the compatibility checklist and API changes.</small>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <span>discord-player v8</span>
        <span>
          Audio powered by{' '}
          <a href="https://github.com/twlite/remedia" target="_blank" rel="noreferrer">
            Remedia
          </a>
        </span>
        <Link href="/docs/architecture">
          Explore the architecture <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </footer>
    </div>
  );
}
