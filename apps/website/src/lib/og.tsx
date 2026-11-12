import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ImageResponse } from 'next/og';
import type { DocsVersionConfig } from './versions';

export const socialImageSize = { width: 1200, height: 630 };

/** The logo as a data URL, read once from `public/` when the build starts. Run from `apps/website`. */
const logoUrl = `data:image/png;base64,${readFileSync(resolve(process.cwd(), 'public/logo.png')).toString('base64')}`;

export function createSocialImage({
  title,
  description,
  section = 'DOCUMENTATION',
  home = false,
  version,
}: {
  title: string;

  description?: string | undefined;

  section?: string;

  home?: boolean;

  /** Documentation version the page belongs to. Defaults to the v8 landing page branding. */
  version?: DocsVersionConfig;
}) {
  const versionName = version?.name ?? '';
  const sectionLabel = version ? `${version.name.toUpperCase()} DOCUMENTATION` : section;

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        padding: 68,
        color: '#f6f3fa',
        backgroundColor: '#0d0d10',
        fontFamily: 'sans-serif',
        backgroundImage: 'radial-gradient(ellipse at 100% 35%, #352148 0%, #17121d 42%, #0d0d10 80%)',
      }}
    >
      <div
        style={{ display: 'flex', position: 'absolute', inset: 18, border: '1px solid #ffffff19', borderRadius: 19 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} width={42} height={42} alt="" />
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1.2 }}>Discord Player</span>
        {home ? null : (
          <span style={{ color: '#bf9bf8', fontSize: 20 }}>
            {versionName}
            {version?.badge ? ` · ${version.badge.text}` : ''}
          </span>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 68,
          color: '#c7a2fb',
          alignItems: 'center',
          gap: 16,
          fontSize: 16,
          letterSpacing: 2,
        }}
      >
        <span style={{ width: 36, height: 2, background: '#b994f1' }} />
        {sectionLabel}
      </div>
      <div
        style={{
          display: 'flex',
          maxWidth: 965,
          marginTop: 27,
          fontSize: title.length > 55 ? 54 : 65,
          fontWeight: 700,
          lineHeight: 1.12,
          letterSpacing: -2,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', maxWidth: 850, marginTop: 22, color: '#afaab9', fontSize: 24, lineHeight: 1.4 }}>
        {description ? description.slice(0, 154) : ''}
      </div>
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: 68,
          right: 68,
          bottom: 53,
          borderTop: '1px solid #ffffff25',
          paddingTop: 24,
          justifyContent: 'space-between',
          fontSize: 16,
          color: '#c8c2d2',
        }}
      >
        <span>
          {home
            ? 'Queues  ·  Playback  ·  Filters  ·  Music sources'
            : `Documentation  ·  discord-player ${versionName}`}
        </span>
        <span style={{ color: '#a298aa' }}>discord-player.js.org</span>
      </div>
    </div>,
    socialImageSize,
  );
}

export function createHomeSocialImage() {
  return createSocialImage({
    title: 'Build Discord music bots in TypeScript.',
    description: 'Queues, playback, filters, and music sources, without the audio plumbing.',
    section: 'DISCORD PLAYER',
    home: true,
  });
}
