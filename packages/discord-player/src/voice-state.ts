import type { DiscordSession } from '@remedia/client';
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

/** Queue-owned Gateway tracking and authoritative occupancy policy. @internal */
export class VoiceStateTracker {
  private states = new Map<string, GatewayVoiceState>();
  private occupants: Set<string> | null = null;
  private channel: string | null = null;
  private session: DiscordSession | null = null;
  private revision = 0;
  private requested = false;
  private work: Promise<void> | null = null;
  private deadlineRevision: number | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pauseOwned = false;
  private pauseCause: 'empty' | 'mute' | null = null;
  private blocked = false;
  private pauseRevision = 0;
  private reason: 'empty' | 'end' | 'stop' | undefined;

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
      this.cancelLeave();
      this.applyPause();
      this.reconcile();
    } else if (event === 'playerResume') {
      this.cancelLeave();
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
  connected(session: DiscordSession | null): void {
    if (this.session !== session || this.channel !== session?.channelId) {
      this.revision++;
      this.pauseRevision++;
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
        this.queue.emit('disconnect', payload);
        this.report(this.queue.destroy());
        return;
      }

      if (current.channelId && current.channelId !== this.channel) {
        this.revision++;
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
    this.cancelEmptyLeave();
    this.report(this.startDrain());
  }

  private startDrain(): Promise<void> {
    this.work ??= Promise.resolve()
      .then(() => this.drain())
      .finally(() => {
        this.work = null;
        if (this.requested && !this.queue.signal.aborted) this.report(this.startDrain());
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

      const wasEmpty = this.occupants?.size === 0;
      this.occupants =
        users === null ? null : new Set(users.filter((id) => id !== this.queue.manager.player.getClientId()));
      const empty = this.occupants?.size === 0;

      if (empty && !wasEmpty) this.queue.emit('emptyChannel');
      if (!empty && this.occupants && wasEmpty) this.queue.emit('channelPopulate');

      this.applyPause();
      if (!empty) this.cancelEmptyLeave();
      if (empty && this.deadlineRevision !== revision) this.schedule('empty');
    }
  }

  private applyPause(): void {
    const session = this.session;
    if (!session || session !== this.queue.node.session || this.queue.signal.aborted) return;

    const shouldPause = this.blocked || (this.queue.options.pauseOnEmpty === true && this.occupants?.size === 0);
    const revision = this.pauseRevision;

    this.report(
      (async () => {
        using _lock = await this.queue.tasks.acquire('queue.node.operation');
        if (session !== this.queue.node.session || this.queue.signal.aborted || revision !== this.pauseRevision) return;
        const stillPause = this.blocked || (this.queue.options.pauseOnEmpty === true && this.occupants?.size === 0);
        if (shouldPause !== stillPause) return;

        if (shouldPause && session.state === 'playing') {
          this.pauseOwned = true;
          this.pauseCause = this.blocked ? 'mute' : 'empty';
          await session.pause();
        } else if (
          !shouldPause &&
          this.pauseOwned &&
          (this.pauseCause === 'mute' || this.occupants !== null) &&
          session.state === 'paused'
        ) {
          this.pauseOwned = false;
          await session.resume();
        }
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
    if (reason !== 'empty' && this.reason === 'empty') return;
    this.cancelLeave();
    this.reason = reason;
    const delay =
      reason === 'empty'
        ? options.leaveOnEmptyCooldown
        : reason === 'end'
          ? options.leaveOnEndCooldown
          : options.leaveOnStopCooldown;
    const session = this.session;
    const channel = this.channel;
    const revision = this.revision;
    this.timer = setTimeout(
      () => {
        this.timer = undefined;
        if (
          this.queue.destroyed ||
          session !== this.queue.node.session ||
          channel !== this.channel ||
          this.reason !== reason
        )
          return;
        if (reason === 'empty' && (this.occupants?.size !== 0 || revision !== this.revision)) return;
        if (reason !== 'empty' && this.queue.isPlaying()) return;
        if (reason === 'end' && this.queue.size) return;
        this.report(
          (async () => {
            if (reason === 'empty' && channel) {
              const refreshRevision = ++this.revision;
              this.deadlineRevision = refreshRevision;
              this.requested = true;
              try {
                await this.startDrain();
                if (this.revision !== refreshRevision || this.occupants?.size !== 0) return;
              } finally {
                if (this.deadlineRevision === refreshRevision) this.deadlineRevision = null;
              }
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
              this.reason !== reason
            )
              return;
            if (reason !== 'empty' && this.queue.isPlaying()) return;
            if (reason === 'end' && this.queue.size) return;
            await this.queue.destroy();
          })(),
        );
      },
      Math.max(0, delay ?? 0),
    );
    this.timer.unref();
  }

  private cancelLeave(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.reason = undefined;
  }
  private cancelQueueLeave(): void {
    if (this.reason !== 'empty') this.cancelLeave();
  }
  private cancelEmptyLeave(): void {
    if (this.reason === 'empty') this.cancelLeave();
  }
  private report(work: Promise<unknown>): void {
    void work.catch((error) => this.queue.emit('error', error instanceof Error ? error : new Error(String(error))));
  }
}
