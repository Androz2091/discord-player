import { downloadOptions } from 'ytdl-core';

export interface PlayerOptions {
    leaveOnEnd?: boolean;
    leaveOnEndCooldown?: number;
    leaveOnStop?: boolean;
    leaveOnEmpty?: boolean;
    leaveOnEmptyCooldown?: number;
    autoSelfDeaf?: boolean;
    enableLive?: boolean;
    ytdlDownloadOptions?: downloadOptions;
}
