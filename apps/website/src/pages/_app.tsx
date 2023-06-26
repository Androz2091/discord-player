import '@edge-ui/react/styles.css';
import '@/styles/globals.css';
import { EdgeUIProvider } from '@edge-ui/react';
import { AppProps } from 'next/app';
import { AppLayout } from '@/components/layout/Layout';
import Head from 'next/head';
import { inter } from '@/lib/constants';

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
