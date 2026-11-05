import { EmbedBuilder } from 'discord.js';

/**
 * Create the shared presentation used by command replies and playback updates.
 * @param title Short heading describing the action.
 * @param description Formatted response body.
 * @param color Accent color; defaults to Discord blurple.
 * @returns An embed ready for command-specific fields or a requester footer.
 */
export function musicEmbed(title: string, description: string, color = 0x5865f2): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: 'Discord Player' })
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}
