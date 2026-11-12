import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { Player } from 'discord-player';
import { createCommands } from './commands.js';
import { registerPlayerEvents } from './events.js';
import { mediaSource } from './media-source.js';

/**
 * Creates the Discord client and the Player, and connects them.
 *
 * @param {{ token: string, allowedMediaHosts: string[] }} config Bot configuration.
 */
export function createBot(config) {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  const player = new Player({
    plugins: [mediaSource({ allowedHosts: config.allowedMediaHosts })],

    // Sends voice join and leave requests through the shard that owns the guild.
    send(guildId, payload) {
      const guild = client.guilds.cache.get(guildId);

      if (!guild) throw new Error(`Guild ${guildId} is not cached, so its shard is unknown.`);

      return guild.shard.send(payload);
    },
  });

  const commands = createCommands(player, config);
  let stopping;

  registerPlayerEvents(player);

  // The Player needs every raw gateway packet, so do not filter them.
  client.on(Events.Raw, (packet) => player.receive(packet));

  client.once(Events.ClientReady, async (ready) => {
    try {
      // Start the Player only once the bot is ready, because it needs the bot's user ID.
      await player.initialize(ready.user.id);
      await ready.application.commands.set(commands.map((command) => command.data));

      console.log(`Ready as ${ready.user.tag}`);
    } catch (error) {
      console.error(
        'Could not start the audio engine. Check that the FFmpeg 9 shared libraries are installed: ' +
          'https://discord-player.js.org/docs/v8/installation/ffmpeg',
        error,
      );

      process.exitCode = 1;
      await stop();
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) return;

    const command = commands.find((entry) => entry.data.name === interaction.commandName);

    if (!command) return;

    try {
      await command.run(interaction);
    } catch (error) {
      console.error(`/${interaction.commandName} failed:`, error);

      const reply = { content: 'Something went wrong.', flags: MessageFlags.Ephemeral };

      try {
        if (interaction.deferred || interaction.replied) await interaction.followUp(reply);
        else await interaction.reply(reply);
      } catch (replyError) {
        console.error('Could not report the failure to Discord:', replyError);
      }
    }
  });

  /** Logs in to Discord. The bot starts working once Discord reports it is ready. */
  function start() {
    return client.login(config.token);
  }

  /** Leaves voice channels and closes the audio engine and the Discord connection. Safe to call more than once. */
  function stop() {
    stopping ??= (async () => {
      try {
        try {
          await player.destroy();
        } finally {
          await client.destroy();
        }
      } catch (error) {
        console.error('Could not shut down cleanly:', error);
        process.exitCode = 1;
      }
    })();

    return stopping;
  }

  return { client, player, commands, start, stop };
}
