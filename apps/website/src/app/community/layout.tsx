import type { Metadata } from 'next';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { communityRoute } from '@/lib/shared';

export const metadata: Metadata = {
  title: 'Community',
  description:
    'A curated list of resources like open-source music bots and extractors, built by the Discord Player community.',
  alternates: { canonical: communityRoute },
};

export default function Layout({ children }: LayoutProps<'/community'>) {
  return <HomeLayout {...baseOptions()}>{children}</HomeLayout>;
}
