import { User } from "discord.js";

export interface TrackData {
    title: string;
    description: string;
    author: string;
    url: string;
    thumbnail: string;
    duration: string;
    views: number;
    requestedBy: User;
    fromPlaylist: boolean;
}