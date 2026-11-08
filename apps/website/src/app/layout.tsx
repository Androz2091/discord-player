import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Provider } from '@/components/provider';
// eslint-disable-next-line no-unassigned-import
import './global.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://discord-player.js.org'),
  title: { default: 'discord-player v8', template: '%s | discord-player' },
  description: 'A Discord audio framework with Remedia, managed queues, and typed source plugins.',
  openGraph: { siteName: 'discord-player', type: 'website' },
  twitter: { card: 'summary_large_image' },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
