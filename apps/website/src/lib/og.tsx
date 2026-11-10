import { ImageResponse } from 'next/og';

export const socialImageSize = { width: 1200, height: 630 };

export function createSocialImage({
  title,
  description,
  section = 'DOCUMENTATION',
  home = false,
}: {
  title: string;

  description?: string | undefined;

  section?: string;

  home?: boolean;
}) {
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
        <svg width="42" height="42" viewBox="0 0 48 48">
          <path
            d="M18 13v24a7 7 0 1 1-5-6.7V11l22-5v25a7 7 0 1 1-5-6.7V8"
            fill="none"
            stroke="#b58aff"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1.2 }}>discord-player</span>
        <span style={{ color: '#bf9bf8', fontSize: 20 }}>v8</span>
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
        {section}
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
          {home ? 'Native audio  ·  Source plugins  ·  Library independent' : 'Documentation  ·  discord-player v8'}
        </span>
        <span style={{ color: '#a298aa' }}>discord-player.js.org</span>
      </div>
    </div>,
    socialImageSize,
  );
}

export function createHomeSocialImage() {
  return createSocialImage({
    title: 'The next generation music framework for Discord.',
    description: 'Native audio powered by Remedia. One engine for embedded and remote playback.',
    section: 'DISCORD-PLAYER v8',
    home: true,
  });
}
