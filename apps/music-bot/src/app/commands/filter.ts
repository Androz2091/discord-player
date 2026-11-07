import { musicCommand, MusicCommandError, requireQueue } from '@/lib/music-command.ts';
import type { CommandData } from 'commandkit';
import { AudioFilterPresets, type AudioFilterName } from 'discord-player';
import { ApplicationCommandOptionType } from 'discord.js';

const presetNames = ['8D', 'bassboost', 'nightcore', 'vaporwave', 'karaoke', 'surrounding'] as const;
const presets = presetNames.map((value) => ({
  name:
    value === '8D'
      ? '8D'
      : value === 'surrounding'
        ? 'Surround'
        : value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
  value: value === '8D' ? '8d' : value,
})) satisfies ReadonlyArray<{ name: string; value: AudioFilterName }>;

const isAudioFilterName = (value: string): value is AudioFilterName =>
  value === '8d' || Object.hasOwn(AudioFilterPresets, value);

export const command: CommandData = {
  name: 'filter',
  description: 'Show or toggle audio filter presets.',
  options: [
    {
      name: 'preset',
      description: 'A preset to toggle, or Off to clear all filters.',
      type: ApplicationCommandOptionType.String,
      choices: [{ name: 'Off', value: 'off' }, ...presets.map(({ name, value }) => ({ name, value }))],
    },
  ],
};

export const chatInput = musicCommand(async (interaction) => {
  const queue = requireQueue(interaction);
  const filters = queue.node.filters;
  if (!queue.node.session) throw new MusicCommandError('Connect to a voice channel first.');
  const choice = interaction.options.getString('preset');
  if (choice === null) {
    const names = filters.enabled.map(
      (name) => presets.find((preset) => preset.value.toLowerCase() === name.toLowerCase())?.name ?? name,
    );
    const label = names.length ? names.join(', ') : filters.graph === null ? 'Off' : 'Custom';

    return `Audio filters: ${label}.`;
  }

  if (choice === 'off') {
    await filters.clear();
    return 'Audio filters cleared.';
  }
  const preset = presets.find((item) => item.value === choice);
  if (!preset) throw new MusicCommandError('Choose one of the listed filter presets.');
  const enabled = await filters.toggle(preset.value);
  if (preset.value === 'bassboost' && isAudioFilterName('normalizer')) {
    await filters.toggle('normalizer', enabled);
  }

  return `Audio filter ${enabled ? 'enabled' : 'disabled'}: ${preset.name}.`;
});
