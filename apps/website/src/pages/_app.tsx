import '@edge-ui/react/styles.css';
import '@/styles/globals.css';
import { EdgeUIProvider } from '@edge-ui/react';
import { AppProps } from 'next/app';
import { AppLayout } from '@/components/layout/Layout';
import { inter } from '@/lib/constants';

export default function App({ Component, pageProps }: AppProps) {
    return (
        <>
            <EdgeUIProvider fontSans={inter.style.fontFamily} theme="detect">
                <AppLayout>
                    <Component {...pageProps} />
                </AppLayout>
            </EdgeUIProvider>
        </>
    );
}
