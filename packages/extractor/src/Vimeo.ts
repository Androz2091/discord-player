import { Vimeo } from './internal/Vimeo';

export const validate = (q: string) => /(http|https)?:\/\/(www\.|player\.)?vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^/]*)\/videos\/|video\/|)(\d+)(?:|\/\?)/.test(q);

export const getInfo = async (query: string) => {
    const data = await Vimeo.getInfo(
        query
            .split('/')
            .filter((x) => !!x)
            .pop()!
    ).catch(() => {
        /* nothing */
    });
    if (!data) return null;

    return {
        playlist: null as any,
        info: [
            {
                title: data.title,
                duration: data.duration * 1000,
                thumbnail: data.thumbnail,
                engine: data.stream.url,
                views: 0,
                author: data.author.name,
                description: '',
                url: data.url
            }
        ]
    };
};

export const important = true;
