import { Attachment } from './internal/Attachment';
const URL_REGEX =
    /^(?:(?:https?|ftp):\/\/)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/\S*)?$/;
const formats = ['audio/', 'video/'];

export const validate = (str: string) => {
    return str.length < 2083 ? URL_REGEX.test(str) : false;
};

export const getInfo = async (query: string) => {
    const data = await Attachment(query).catch(() => {
        /* nothing */
    });
    if (!data || !formats.some((x) => data.format.startsWith(x))) return null;

    return {
        playlist: null as any,
        info: [
            {
                title: (
                    data.url
                        .split('/')
                        .filter((x) => x.length)
                        .pop() ?? 'Attachment'
                )
                    .split('?')[0]
                    .trim(),
                duration: 0,
                thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/2/2a/ITunes_12.2_logo.png',
                engine: data.url,
                views: 0,
                author: (data.stream as any).client.servername as string,
                description: (data.stream as any).client.servername as string,
                url: data.url
            }
        ]
    };
};

export const important = true;
