import type { PlaybackSession } from './playback-backend.js';
import { intercept } from './plugins/capabilities.js';
import type { GuildQueue } from './structures/guild-queue.js';

/** Normalized Discord Gateway member state, independent of any Discord library. */
export interface GatewayVoiceState {
  /** Guild identifier. */
  guildId: string;
  /** Member identifier. */
  userId: string;
  /** Current voice channel, or null after leaving. */
  channelId: string | null;
  /** Server mute flag when supplied by Discord. */
  serverMute?: boolean;
  /** Stage suppression flag when supplied by Discord. */
  suppress?: boolean;
}

/** Queue-owned Gateway tracking and authoritative occupancy policy. Use queue.voice for the managed instance. */
export class VoiceStateTracker {
  private states = new Map<string, GatewayVoiceState>();
  private occupants: Set<string> | null = null;
  private channel: string | null = null;
  private session: PlaybackSession | null = null;
  private revision = 0;
  private occupancyRevision = -1;
  private requested = false;
  private work: Promise<void> | null = null;
  private leaves = new Map<'empty' | 'end' | 'stop', ReturnType<typeof setTimeout>>();
  private pauseWork: object | null = null;
  private pauseGeneration: number | null = null;
  private pauseOwned = false;
  private pauseCause: 'empty' | 'mute' | null = null;
  private blocked = false;
  private pauseRevision = 0;

  /** Own policy subscriptions for one queue.
   * @param queue Queue whose lifetime bounds all state and timers.
   */
  constructor(private readonly queue: GuildQueue) {
    queue.signal.addEventListener(
      'abort',
      () => {
        this.revision++;
        this.pauseRevision++;
        this.cancelLeave();
        this.states.clear();
        this.occupants = null;
        this.session = null;
      },
      { once: true },
    );
  }

  /** Apply queue-owned policy transitions before application listeners.
   * @param event Queue event name.
   */
  onEvent(event: string): void {
    if (event === 'playerStart') {
      this.cancelQueueLeave();
      this.pauseRevision++;
      this.pauseOwned = false;
      this.applyPause();
      this.reconcile();
    } else if (event === 'playerResume') {
      this.cancelQueueLeave();
      this.reconcile();
    } else if (event === 'audioTrackAdd' || event === 'audioTracksAdd') this.cancelQueueLeave();
    else if (event === 'playerStop') this.schedule('stop');
  }

  /** Schedule the end policy only after natural progression or autoplay exhausts. */
  ended(): void {
    this.schedule('end');
  }

  /** Invalidate channel/session-dependent work and reconcile a successful connection.
   * @param session Current native session, or null on replacement/disposal.
   */
  connected(session: PlaybackSession | null): void {
    if (this.session !== session || this.channel !== session?.channelId) {
      this.revision++;
      this.pauseRevision++;
      this.pauseWork = null;
      this.cancelLeave();
      this.occupants = null;
      if (this.session !== session) {
        this.pauseOwned = false;
        this.blocked = false;
      }
      this.states.clear();
      this.session = session;
      this.channel = session?.channelId ?? null;
    }

    if (session) this.reconcile();
  }

  /** A direct user pause/resume takes ownership away from automatic policies. */
  manualPause(): void {
    this.pauseRevision++;
    this.pauseOwned = false;
  }

  /** Consume one raw Gateway voice-state packet.
   * @param payload Original Gateway packet.
   */
  receive(payload: Record<string, unknown>): void {
    const data = payload.d;

    if (
      !data ||
      typeof data !== 'object' ||
      !('guild_id' in data) ||
      data.guild_id !== this.queue.guildId ||
      !('user_id' in data) ||
      typeof data.user_id !== 'string' ||
      !('channel_id' in data) ||
      (data.channel_id !== null && typeof data.channel_id !== 'string')
    )
      return;

    const current: GatewayVoiceState = {
      guildId: this.queue.guildId,
      userId: data.user_id,
      channelId: data.channel_id,
      ...('mute' in data && typeof data.mute === 'boolean' ? { serverMute: data.mute } : {}),
      ...('suppress' in data && typeof data.suppress === 'boolean' ? { suppress: data.suppress } : {}),
    };
    const previous = this.states.get(current.userId) ?? null;
    const bot = current.userId === this.queue.manager.player.getClientId();

    if (current.channelId === this.channel || bot) this.states.set(current.userId, current);
    else this.states.delete(current.userId);

    this.queue.emit('voiceStateUpdate', previous, current, payload);

    if (bot) {
      this.blocked =
        (current.serverMute ?? previous?.serverMute ?? false) || (current.suppress ?? previous?.suppress ?? false);

      if (current.channelId === null && this.channel !== null) {
        if (this.queue.signal.aborted) return;

        this.queue.emit('disconnect', payload);
        this.report(this.queue.destroy());
        return;
      }

      if (current.channelId && current.channelId !== this.channel) {
        this.revision++;
        this.pauseRevision++;
        this.pauseWork = null;
        this.cancelLeave();
        this.channel = current.channelId;
        this.occupants = null;
        this.report(this.queue.connect({ channelId: current.channelId }));
      }

      this.applyPause();
    }

    this.reconcile();
  }

  /** Coalesce Gateway bursts; every result is fenced by channel, session and revision. */
  reconcile(): void {
    this.revision++;
    this.requested = true;
    this.report(this.startDrain());
  }

  private startDrain(): Promise<void> {
    this.work ??= Promise.resolve()
      .then(() => this.drain())
      .finally(async () => {
        this.work = null;
        if (this.requested && !this.queue.signal.aborted) await this.startDrain();
      });
    return this.work;
  }

  private async drain(): Promise<void> {
    while (this.requested && !this.queue.signal.aborted) {
      this.requested = false;
      const revision = this.revision;
      const channel = this.channel;
      const session = this.session;
      const resolver = this.queue.manager.player.options.resolveVoiceChannelUsers;
      let users: readonly string[] | null = null;

      if (resolver && channel && session) {
        try {
          users = await resolver(this.queue.guildId, channel);
        } catch (error) {
          this.queue.emit('error', error instanceof Error ? error : new Error(String(error)));
        }
      }

      if (revision !== this.revision || session !== this.queue.node.session || this.queue.signal.aborted) continue;

      this.occupancyRevision = revision;
      const wasEmpty = this.occupants?.size === 0;
      this.occupants =
        users === null ? null : new Set(users.filter((id) => id !== this.queue.manager.player.getClientId()));
      const empty = this.occupants?.size === 0;

      if (empty && !wasEmpty) this.queue.emit('emptyChannel');
      if (!empty && this.occupants && wasEmpty) this.queue.emit('channelPopulate');

      this.applyPause();
      if (!empty) this.cancelEmptyLeave();
      if (empty) this.schedule('empty');
    }
  }

  private shouldPause(): boolean {
    return (
      this.blocked ||
      (this.queue.options.leaveOnEmpty !== true &&
        this.queue.options.pauseOnEmpty === true &&
        this.occupants?.size === 0)
    );
  }

  private applyPause(): void {
    const session = this.session;
    if (
      !session ||
      session !== this.queue.node.session ||
      this.queue.signal.aborted ||
      session.connectionState !== 'connected' ||
      this.pauseWork
    )
      return;

    const generation = session.snapshot.generation;
    if (this.pauseGeneration !== generation) this.pauseOwned = false;
    this.pauseGeneration = generation;
    const revision = this.pauseRevision;
    const channel = this.channel;
    const work = {};
    this.pauseWork = work;

    this.report(
      (async () => {
        let control: Promise<void>;
        let pausing: boolean;
        let cause: 'mute' | 'empty' | null;
        const current = () =>
          session === this.queue.node.session &&
          channel === this.channel &&
          channel === session.channelId &&
          !this.queue.signal.aborted &&
          revision === this.pauseRevision &&
          generation === session.snapshot.generation;

        try {
          {
            // Serialize submission with queue controls, never hold teardown behind a remote RPC.
            using _lock = await this.queue.tasks.acquire('queue.node.operation');
            if (!current() || session.connectionState !== 'connected') return;
            pausing = this.shouldPause();
            cause = this.blocked ? 'mute' : 'empty';
            if (pausing && session.state === 'playing') {
              intercept(this.queue.player.plugins, 'voice.beforeAutoPause', { guildId: this.queue.guildId });
              control = session.pause();
            } else if (
              !pausing &&
              this.pauseOwned &&
              (this.pauseCause === 'mute' || this.occupants !== null) &&
              session.state === 'paused'
            ) {
              control = session.resume();
            } else return;
          }

          await control;
          if (!current()) return;
          this.pauseOwned = pausing;
          this.pauseCause = pausing ? cause : null;
        } finally {
          if (this.pauseWork === work) this.pauseWork = null;
        }

        // A member can return while pause is in flight. Reconcile only after confirmation.
        if (current() && this.shouldPause() !== pausing) this.applyPause();
      })(),
    );
  }

  private schedule(reason: 'empty' | 'end' | 'stop'): void {
    const options = this.queue.options;
    const enabled =
      reason === 'empty' ? options.leaveOnEmpty : reason === 'end' ? options.leaveOnEnd : options.leaveOnStop;
    if (
      !enabled ||
      this.queue.destroyed ||
      !this.session ||
      (reason === 'end' && (this.queue.size || this.queue.isPlaying()))
    )
      return;
    if (this.leaves.has(reason)) return;
    const delay =
      reason === 'empty'
        ? options.leaveOnEmptyCooldown
        : reason === 'end'
          ? options.leaveOnEndCooldown
          : options.leaveOnStopCooldown;
    const session = this.session;
    const channel = this.channel;
    const timer = setTimeout(
      () => {
        if (
          this.queue.destroyed ||
          session !== this.queue.node.session ||
          channel !== this.channel ||
          this.leaves.get(reason) !== timer
        )
          return;
        if (reason === 'empty' && this.occupants?.size !== 0) return;
        if (reason !== 'empty' && this.queue.isPlaying()) return;
        if (reason === 'end' && this.queue.size) return;
        this.report(
          (async () => {
            if (reason === 'empty' && channel) {
              this.revision++;
              this.requested = true;
              await this.startDrain();
              if (this.occupants?.size !== 0 || this.occupancyRevision !== this.revision) return;
            }
            const current = this.queue.options;
            if (
              !(reason === 'empty' ? current.leaveOnEmpty : reason === 'end' ? current.leaveOnEnd : current.leaveOnStop)
            )
              return;
            if (
              session !== this.queue.node.session ||
              this.channel !== channel ||
              this.queue.destroyed ||
              this.leaves.get(reason) !== timer
            )
              return;
            if (reason !== 'empty' && this.queue.isPlaying()) return;
            if (reason === 'end' && this.queue.size) return;
            intercept(this.queue.player.plugins, 'voice.beforeLeave', { guildId: this.queue.guildId, reason });
            await this.queue.destroy();
          })(),
        );
      },
      Math.max(0, delay ?? 0),
    );
    this.leaves.set(reason, timer);
    timer.unref();
  }

  private cancelLeave(reason?: 'empty' | 'end' | 'stop'): void {
    for (const [key, timer] of this.leaves) {
      if (reason && key !== reason) continue;
      clearTimeout(timer);
      this.leaves.delete(key);
    }
  }

  private cancelQueueLeave(): void {
    this.cancelLeave('end');
    this.cancelLeave('stop');
  }

  private cancelEmptyLeave(): void {
    this.cancelLeave('empty');
  }

  private report(work: Promise<unknown>): void {
    void work.catch((error) => this.queue.emit('error', error instanceof Error ? error : new Error(String(error))));
  }
}
