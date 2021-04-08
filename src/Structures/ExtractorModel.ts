import { ExtractorModelData } from "../types/types";

class ExtractorModel {
    name: string;
    private _raw: any;

    constructor(extractorName: string, data: any) {
        this.name = extractorName;

        Object.defineProperty(this, "_raw", { value: data, configurable: false, writable: false, enumerable: false });
    }

    async handle(query: string) {
        const data = await this._raw.getInfo(query);
        if (!data) return null;

        return {
            title: data.title,
            duration: data.duration,
            thumbnail: data.thumbnail,
            engine: data.engine,
            views: data.views,
            author: data.author,
            description: data.description,
            url: data.url
        } as ExtractorModelData;
    }

    validate(query: string) {
        return Boolean(this._raw.validate(query));
    }

    get version() {
        return this._raw.version ?? "0.0.0";
    }

    get important() {
        return Boolean(this._raw.important);
    }

}

export default ExtractorModel;
export { ExtractorModel };