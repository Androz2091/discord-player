import { PermissionsBitField } from 'discord.js';
import type { KarasuClient } from '../KarasuClient';

export function voice(interaction, container: KarasuClient) {
	function client() {
		const resolved = new PermissionsBitField([
			PermissionsBitField.Flags.Connect,
			PermissionsBitField.Flags.Speak,
			PermissionsBitField.Flags.ViewChannel
		]);
		const missingPerms = interaction.member.voice.channel.permissionsFor(interaction.guild!.members.me!).missing(resolved);

		if (missingPerms.length)
			return `${container.dev.error} | I am missing the required voice channel permissions: \`${missingPerms.join(', ')}\``;
	}

	function member(target?) {
		if (target && !target.member.voice.channel) return `${container.dev.error} | ${target.displayName} is not in a voice channel.`
		if (!interaction.member.voice.channel) return `${container.dev.error} | You need to be in a voice channel.`;
	}
	
	function memberToMember(target) {
		if (interaction.member.voice.channelId !== target.member.voice.channelId) return `${container.dev.error} | You are not in the same voice channel as the **target user**.`
	}

	function clientToMember() {
		if (interaction.guild?.members.me?.voice.channelId && interaction.member.voice.channelId !== interaction.guild?.members.me?.voice.channelId)
			return `${container.dev.error} | You are not in my voice channel`;
	}

	return { client, member, memberToMember, clientToMember };
}
