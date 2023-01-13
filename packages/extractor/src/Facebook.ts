import { Facebook } from './internal/Facebook';

export const validate = Facebook.validateURL;

export const getInfo = async (query: string) => {
    const data = await Facebook.getInfo(query).catch(() => {
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
                views: parseInt(data.views) || 0,
                author: data.author.name,
                description: data.description,
                url: data.url
            }
        ]
    };
};

export const important = true;
