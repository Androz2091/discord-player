import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Provider } from '@/components/provider';
import { siteUrl } from '@/lib/shared';
// eslint-disable-next-line no-unassigned-import
import './global.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'discord-player', template: '%s | discord-player' },
  description: 'A framework for building music bots for Discord.',
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
