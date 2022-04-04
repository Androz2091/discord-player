import { VolumeTransformer as VolumeTransformerMock } from "./VoiceInterface/VolumeTransformer";

try {
    // eslint-disable-next-line
    const mod = require("prism-media") as typeof import("prism-media") & { VolumeTransformer: typeof VolumeTransformerMock };

    if (typeof mod.VolumeTransformer.hasSmoothing !== "boolean") {
        Reflect.set(mod, "VolumeTransformer", VolumeTransformerMock);
    }
} catch {
    /* do nothing */
}
