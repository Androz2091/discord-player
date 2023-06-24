import '@edge-ui/react/styles.css';
import '@/styles/globals.css';
import { EdgeUIProvider } from '@edge-ui/react';
import { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { AppLayout } from '@/components/layout/Layout';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-sans',
    display: 'swap'
});

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
