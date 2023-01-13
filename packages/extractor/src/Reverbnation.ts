// @ts-ignore
import Reverb from 'reverbnation-scraper';
const RV_REGEX = /https:\/\/(www.)?reverbnation.com\/(.+)\/song\/(.+)/;

export const validate = (str: string) => {
    return RV_REGEX.test(str);
};

export const getInfo = async (query: string) => {
    const data = await Reverb.getInfo(query).catch(() => {
        /* nothing */
    });
    if (!data) return null;

    return {
        playlist: null as any,
        info: [
            {
                title: data.title,
                duration: data.duration,
                thumbnail: data.thumbnail,
                engine: data.streamURL,
                views: 0,
                author: data.artist.name,
                description: '',
                url: data.url
            }
        ]
    } as Reverbnation;
};

export interface Reverbnation {
    playlist: any;
    info: {
        title: string;
        duration: number;
        thumbnail: string;
        engine: string;
        views: number;
        author: string;
        url: string;
        description: string;
    }[];
}

export const important = true;
