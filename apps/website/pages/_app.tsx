import './index.css';
import { AppProps } from 'next/app';

export default function App(props: AppProps) {
    const { Component, pageProps } = props;

    return <Component {...pageProps} />;
}
