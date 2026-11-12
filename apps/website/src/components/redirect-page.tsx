import Link from 'next/link';

/**
 * Static-export friendly redirect. GitHub Pages cannot send HTTP redirects, so moved URLs render this page.
 * The inline script keeps the URL fragment, and the meta tag covers visitors without JavaScript.
 *
 * @param href Versioned destination path.
 */
export function RedirectPage({ href }: { href: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <meta httpEquiv="refresh" content={`0;url=${href}`} />
      <script
        dangerouslySetInnerHTML={{ __html: `window.location.replace(${JSON.stringify(href)}+window.location.hash)` }}
      />
      <p className="text-fd-muted-foreground">This page has moved.</p>
      <Link href={href} className="font-medium text-fd-primary underline underline-offset-4">
        Continue to {href}
      </Link>
    </main>
  );
}
