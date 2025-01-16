import { VoiceChannel, StageChannel, Snowflake } from 'discord.js';
import {
  DiscordGatewayAdapterCreator,
  joinVoiceChannel,
  VoiceConnection,
  getVoiceConnection,
  VoiceConnectionStatus,
  AudioPlayer,
} from 'discord-voip';
import { StreamDispatcher } from './StreamDispatcher';
import { Collection } from '@discord-player/utils';
import { GuildQueue } from '../queue';
import type { Player } from '../Player';
import { NoGuildQueueError } from '../errors';

class VoiceUtils {
  /**
   * Voice connection cache to store voice connections of the Player components.
   * This property is deprecated and will be removed in the future.
   * It only exists for compatibility reasons.
   * @deprecated
   */
  public cache: Collection<Snowflake, StreamDispatcher> = new Collection<
    Snowflake,
    StreamDispatcher
  >();

  /**
   * The voice utils constructor
   */
  constructor(public player: Player) {}

  /**
   * Joins a voice channel, creating basic stream dispatch manager
   * @param {StageChannel|VoiceChannel} channel The voice channel
   * @param {object} [options] Join options
   * @returns {Promise<StreamDispatcher>}
   */
  public async connect(
    channel: VoiceChannel | StageChannel,
    options?: {
      deaf?: boolean;
      maxTime?: number;
      queue: GuildQueue;
      audioPlayer?: AudioPlayer;
      group?: string;
    },
  ): Promise<StreamDispatcher> {
    if (!options?.queue) throw new NoGuildQueueError();
    const conn = await this.join(channel, options);
    const sub = new StreamDispatcher(
      conn,
      channel,
      options.queue,
      options.maxTime,
      options.audioPlayer,
    );
    return sub;
  }

  /**
   * Joins a voice channel
   * @param {StageChannel|VoiceChannel} [channel] The voice/stage channel to join
   * @param {object} [options] Join options
   * @returns {VoiceConnection}
   */
  public async join(
    channel: VoiceChannel | StageChannel,
    options?: {
      deaf?: boolean;
      maxTime?: number;
      group?: string;
    },
  ) {
    const existingConnection = this.getConnection(
      channel.guild.id,
      options?.group,
    );

    if (
      existingConnection?.joinConfig.channelId === channel?.id &&
      existingConnection.state.status !== VoiceConnectionStatus.Destroyed
    ) {
      return existingConnection;
    }

    const conn = joinVoiceChannel({
      guildId: channel.guild.id,
      channelId: channel.id,
      adapterCreator: channel.guild
        .voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
      selfDeaf: Boolean(options?.deaf),
      debug: this.player.events.listenerCount('debug') > 0,
      group: options?.group,
    });

    return conn;
  }

  /**
   * Disconnects voice connection
   * @param {VoiceConnection} connection The voice connection
   * @returns {void}
   */
  public disconnect(connection: VoiceConnection | StreamDispatcher) {
    if (connection instanceof StreamDispatcher)
      connection = connection.voiceConnection;

    try {
      if (connection.state.status !== VoiceConnectionStatus.Destroyed)
        return connection.destroy();
    } catch {
      //
    }
  }

  /**
   * Returns Discord Player voice connection
   * @param {Snowflake} guild The guild id
   * @returns {StreamDispatcher}
   */
  public getConnection(guild: Snowflake, group?: string) {
    return getVoiceConnection(guild, group);
  }
}

export { VoiceUtils };
