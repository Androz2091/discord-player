import Head from 'next/head';

interface IProps {
    title?: string;
    description?: string;
}

const DEFAULT_TITLE = 'Discord Player';
const DEFAULT_DESC =
    'Discord Player is a robust framework for developing Discord Music bots using JavaScript and TypeScript. It is built on top of the @discordjs/voice library and offers a comprehensive set of customizable tools, making it one of the most feature enrich framework in town.';

export function HeadingMeta(props: IProps) {
    const { title = DEFAULT_TITLE, description = DEFAULT_DESC } = props;

    return (
        <Head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta httpEquiv="Content-Type" content="text/html;charset=UTF-8" />
            <link rel="icon" href="/icon.png" type="image/png" />
            <title>{title}</title>
            <meta name="description" content={description} />
            <meta name="keywords" content="discord-player,voip,discord,api,discord.js,music,bot,ffmpeg,npm,nodejs,javascript,typescript" />
            <meta name="theme-color" content="#0d9488" />
        </Head>
    );
}
