import _rawDocs from '../data/docs.json';
import type { Documentation } from 'typedoc-nextra';

for (const prop in _rawDocs.modules) {
    // @ts-expect-error
    _rawDocs.modules[prop as keyof typeof _rawDocs.modules].classes.forEach((c) => (c.data.__type = 'class'));
    // @ts-expect-error
    _rawDocs.modules[prop as keyof typeof _rawDocs.modules].functions.forEach((c) => (c.data.__type = 'function'));
    // @ts-expect-error
    _rawDocs.modules[prop as keyof typeof _rawDocs.modules].types.forEach((c) => (c.data.__type = 'type'));
}

export const docs = _rawDocs as unknown as Documentation;

const EXTERNAL_LINKS = {
    string: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String',
    String: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String',
    number: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number',
    Number: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number',
    boolean: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean',
    Boolean: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean',
    symbol: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol',
    Symbol: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol',
    void: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/undefined',
    undefined: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/undefined',
    Object: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object',
    object: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object',
    Function: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function',
    function: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function',
    Array: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array',
    Set: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set',
    Map: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map',
    Date: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date',
    RegExp: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp',
    Promise: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise',
    Error: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error',
    Generator: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator',
    EventEmitter: 'https://nodejs.org/dist/latest/docs/api/events.html#events_class_eventemitter',
    Timeout: 'https://nodejs.org/dist/latest/docs/api/timers.html#timers_class_timeout',
    Buffer: 'https://nodejs.org/dist/latest/docs/api/buffer.html#buffer_class_buffer',
    ReadableStream: 'https://nodejs.org/dist/latest/docs/api/stream.html#stream_class_stream_readable',
    Readable: 'https://nodejs.org/dist/latest/docs/api/stream.html#stream_class_stream_readable',
    Duplex: 'https://nodejs.org/dist/latest/docs/api/stream.html#stream_class_stream_duplex',
    ChildProcess: 'https://nodejs.org/dist/latest/docs/api/child_process.html#child_process_class_childprocess',
    Worker: 'https://nodejs.org/api/worker_threads.html#worker_threads_class_worker',
    MessagePort: 'https://nodejs.org/api/worker_threads.html#worker_threads_class_messageport',
    IncomingMessage: 'https://nodejs.org/dist/latest/docs/api/http.html#http_class_http_incomingmessage',
    RequestInfo: 'https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch',
    RequestInit: 'https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch',
    RequestOptions: 'https://nodejs.org/dist/latest/docs/api/http.html#http_http_request_options_callback',
    Response: 'https://developer.mozilla.org/en-US/docs/Web/API/Response',
    YTDLDownloadOptions: 'https://github.com/fent/node-ytdl-core#ytdlurl-options',
    Client: 'https://old.discordjs.dev/#/docs/discord.js/main/class/Client',
    Message: 'https://old.discordjs.dev/#/docs/discord.js/main/class/Message',
    VoiceChannel: 'https://old.discordjs.dev/#/docs/discord.js/main/class/VoiceChannel',
    StageChannel: 'https://old.discordjs.dev/#/docs/discord.js/main/class/StageChannel',
    VoiceConnection: 'https://discord.js.org/docs/packages/voice/main/VoiceConnection:Class',
    Snowflake: 'https://old.discordjs.dev/#/docs/discord.js/main/stable/typedef/Snowflake',
    User: 'https://old.discordjs.dev/#/docs/discord.js/main/class/User',
    GuildResolvable: 'https://old.discordjs.dev/#/docs/discord.js/main/stable/typedef/GuildResolvable',
    UserResolvable: 'https://old.discordjs.dev/#/docs/discord.js/main/stable/typedef/UserResolvable',
    Guild: 'https://old.discordjs.dev/#/docs/discord.js/main/class/Guild',
    VoiceBasedChannelTypes: 'https://old.discordjs.dev/#/docs/discord.js/main/typedef/VoiceBasedChannelTypes',
    VoiceState: 'https://old.discordjs.dev/#/docs/discord.js/main/class/VoiceState',
    GuildVoiceChannelResolvable: 'https://old.discordjs.dev/#/docs/discord.js/main/typedef/GuildVoiceChannelResolvable'
};

export const docsLink = (() => {
    type DocLink = {
        module: string;
        type: 'class' | 'function' | 'type';
        href: string;
        target: string;
    };

    const entries: DocLink[] = [];

    const mods = Object.values(_rawDocs.modules);

    for (const mod of mods) {
        mod.classes.forEach((c) =>
            entries.push({
                module: mod.name,
                href: `/docs/${encodeURIComponent(mod.name)}?type=class&target=${c.data.name}`,
                target: c.data.name,
                type: 'class'
            })
        );
        mod.functions.forEach((c) =>
            entries.push({
                module: mod.name,
                href: `/docs/${encodeURIComponent(mod.name)}?type=function&target=${c.data.name}`,
                target: c.data.name,
                type: 'function'
            })
        );
        mod.types.forEach((c) =>
            entries.push({
                module: mod.name,
                href: `/docs/${encodeURIComponent(mod.name)}?type=type&target=${c.data.name}`,
                target: c.data.name,
                type: 'type'
            })
        );
    }

    return { internal: entries, external: EXTERNAL_LINKS };
})();
export const libNames = Object.values(_rawDocs.modules).map((m) => m.name);
