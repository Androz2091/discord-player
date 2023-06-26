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
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <meta http-equiv="Content-Type" content="text/html;charset=UTF-8" />
                <link rel="icon" href="/icon.svg" type="image/svg+xml" />
                <title>Discord Player</title>
                <meta
                    name="description"
                    content="Discord Player is a robust framework for developing Discord Music bots using JavaScript and TypeScript. It is built on top of the @discordjs/voice library and offers a comprehensive set of customizable tools, making it one of the most feature enrich framework in town."
                />
                <meta name="keywords" content="discord-player,voip,discord,api,discord.js,music,bot,ffmpeg,npm,nodejs,javascript,typescript" />
                <meta name="theme-color" content="#0d9488"></meta>
            </Head>
            <EdgeUIProvider fontSans={inter.style.fontFamily} theme="detect">
                <AppLayout>
                    <Component {...pageProps} />
                </AppLayout>
            </EdgeUIProvider>
        </>
    );
}
