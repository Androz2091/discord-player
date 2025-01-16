import type { ReactNode } from 'react';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/app/layout.config';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Community Showcase',
  description:
    'A curated list of resources like open-source music bots and extractors, built by the Discord Player community.',
};

export default function Layout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return <HomeLayout {...baseOptions}>{children}</HomeLayout>;
}
