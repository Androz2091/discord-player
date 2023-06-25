import '@edge-ui/react/styles.css';
import '@/styles/globals.css';
import { EdgeUIProvider } from '@edge-ui/react';
import { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { AppLayout } from '@/components/layout/Layout';
import Head from 'next/head';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-sans',
    display: 'swap'
});

export default function App({ Component, pageProps }: AppProps) {
    return (
        <>
            <Head>
                <link rel="icon" href="/icon.svg" type="image/svg+xml" />
                <title>Discord Player</title>
            </Head>
            <EdgeUIProvider fontSans={inter.style.fontFamily} theme="detect">
                <AppLayout>
                    <Component {...pageProps} />
                </AppLayout>
            </EdgeUIProvider>
        </>
    );
}
