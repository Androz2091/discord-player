import { musicCommand, MusicCommandError, requireQueue } from '@/lib/music-command.ts';
import type { CommandData } from 'commandkit';
import { ApplicationCommandOptionType } from 'discord.js';

// Small app-owned presets passed through queue.node.filters to Remedia's raw filtergraph controls.
const presets = [
  { name: 'Bass boost', value: 'bassboost', graph: 'bass=gain=15:frequency=110,acompressor' },
  { name: 'Nightcore', value: 'nightcore', graph: 'asetrate=60000,aresample=48000' },
  { name: 'Vaporwave', value: 'vaporwave', graph: 'asetrate=38400,aresample=48000' },
  { name: '8D', value: '8d', graph: 'apulsator=mode=sine:hz=0.125:amount=0.7' },
] as const;

export const command: CommandData = {
  name: 'filter',
  description: 'Show or replace the active audio filter preset.',
  options: [
    {
      name: 'preset',
      description: 'A single preset to apply, or Off to clear filters.',
      type: ApplicationCommandOptionType.String,
      choices: [{ name: 'Off', value: 'off' }, ...presets.map(({ name, value }) => ({ name, value }))],
    },
  ],
};

export const chatInput = musicCommand(async (interaction) => {
  const queue = requireQueue(interaction);
  const filters = queue.node.filters;
  if (!filters) throw new MusicCommandError('Connect to a voice channel first.');
  const choice = interaction.options.getString('preset');
  if (choice === null) {
    const name =
      filters.graph === null ? 'Off' : (presets.find((preset) => preset.graph === filters.graph)?.name ?? 'Custom');
    return `Audio filter: ${name}.`;
  }
  if (choice === 'off') {
    await filters.clear();
    return 'Audio filters cleared.';
  }
  const preset = presets.find((item) => item.value === choice);
  if (!preset) throw new MusicCommandError('Choose one of the listed filter presets.');
  await filters.set(preset.graph);
  return `Audio filter set to ${preset.name}.`;
});
