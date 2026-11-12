import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';

/** The home page uses a crisper palette than the documentation: white and a near-black dark theme. */
const homePalette =
  'flex flex-1 flex-col [--color-fd-background:#ffffff] [--color-fd-card:#f8f8f9] [--color-fd-border:#e4e4e7] [--color-fd-muted-foreground:#52525b] dark:[--color-fd-background:#09090b] dark:[--color-fd-card:#111113] dark:[--color-fd-border:#27272a] dark:[--color-fd-muted-foreground:#a1a1aa]';

export default function Layout({ children }: LayoutProps<'/'>) {
  const options = baseOptions();

  return (
    <div className={`${homePalette} bg-fd-background`}>
      <HomeLayout {...options} nav={{ ...options.nav, title: 'Discord Player' }}>
        {children}
      </HomeLayout>
    </div>
  );
}
