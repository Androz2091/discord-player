import { AudioFilterPresets, type AudioFilterName, type AudioFilterPresetName } from './audio-filter-presets.js';
import type { GuildQueuePlayerNode } from './guild-queue-player-node.js';

type FilterState = {
  raw: string | null;

  enabled: AudioFilterPresetName[];
};

function presetName(name: AudioFilterName): AudioFilterPresetName {
  const canonical = name === '8d' ? '8D' : name;

  if (!Object.hasOwn(AudioFilterPresets, canonical)) {
    throw new RangeError(`Unknown audio filter preset: ${name}`);
  }

  return canonical;
}

/**
 * Queue-owned named presets and raw FFmpeg filtergraphs, applied through Remedia.
 * Changes do not replay tracks or replace the voice session. Preset availability and
 * graph validation depend on the selected Remedia build. Custom preset registration is unsupported.
 */
export class GuildQueuePlayerAudioFilters<Metadata = unknown> {
  private state: FilterState = { raw: null, enabled: [] };

  private appliedGraph: string | null = null;

  /** Create filter controls for one queue node.
   * @param node Node whose session and queue defaults own the filter configuration.
   */
  public constructor(private readonly node: GuildQueuePlayerNode<Metadata>) {}

  /** Current raw graph, including queued defaults before a session exists. */
  public get graph(): string | null {
    return this.node.session ? this.node.session.filters.graph : (this.node.queue.options.filterGraph ?? null);
  }

  /** Enabled canonical preset names, in application order. Returns a detached array. */
  public get enabled(): readonly AudioFilterPresetName[] {
    return [...this.synchronize().enabled];
  }

  /** Get the complete raw filtergraph.
   * @returns The active or configured graph, or null when disabled.
   */
  public get(): string | null;

  /** Check whether a named preset is enabled.
   * @param name Built-in preset name.
   * @returns Whether the preset is part of the managed filter chain.
   */
  public get(name: AudioFilterName): boolean;

  public get(name?: AudioFilterName): string | null | boolean {
    return name === undefined ? this.graph : this.synchronize().enabled.includes(presetName(name));
  }

  /** Replace all filters with one preset, an ordered preset list, or a raw graph.
   * A string matching a preset name selects that preset. Other strings are raw graphs.
   * @param filters Preset name, preset list, non-empty raw graph, or null to disable filtering.
   */
  public async set(filters: AudioFilterName | readonly AudioFilterName[] | string | null): Promise<void> {
    await this.update(() => {
      if (filters === null) {
        return { raw: null, enabled: [] };
      }

      if (typeof filters !== 'string') {
        return { raw: null, enabled: [...new Set(filters.map(presetName))] };
      }

      if (filters === '8d' || Object.hasOwn(AudioFilterPresets, filters)) {
        return { raw: null, enabled: [presetName(filters as AudioFilterName)] };
      }

      return { raw: this.validateRaw(filters), enabled: [] };
    });
  }

  /** Replace the whole chain with an opaque raw graph, even when it matches a preset name.
   * @param graph Non-empty raw FFmpeg filtergraph, or null to disable filtering.
   */
  public async setRaw(graph: string | null): Promise<void> {
    await this.update(() => ({ raw: graph === null ? null : this.validateRaw(graph), enabled: [] }));
  }

  /** Remove managed named presets while retaining any opaque raw graph and other presets.
   * @param names Preset name or list of preset names to remove.
   */
  public async remove(names: AudioFilterName | readonly AudioFilterName[]): Promise<void> {
    await this.update((state) => {
      const removed = new Set((typeof names === 'string' ? [names] : names).map(presetName));

      return { raw: state.raw, enabled: state.enabled.filter((name) => !removed.has(name)) };
    });
  }

  /** Toggle one named preset, retaining any raw graph and the other enabled presets.
   * @param name Preset to toggle.
   * @param enabled Optional explicit enabled state; omit to invert the current state.
   * @returns The preset's enabled state after the update succeeds.
   */
  public async toggle(name: AudioFilterName, enabled?: boolean): Promise<boolean> {
    const canonical = presetName(name);
    const state = await this.update((current) => {
      const next = enabled ?? !current.enabled.includes(canonical);
      let names = [...current.enabled];

      if (next) {
        if (!names.includes(canonical)) {
          names.push(canonical);
        }
      } else {
        names = names.filter((item) => item !== canonical);
      }

      return { raw: current.raw, enabled: names };
    });

    return state.enabled.includes(canonical);
  }

  /** Disable both the raw graph and all named presets. */
  public async clear(): Promise<void> {
    await this.setRaw(null);
  }

  private validateRaw(graph: string): string {
    if (!graph.trim()) {
      throw new RangeError('An audio filtergraph must be a non-empty string. Use clear() to disable filters.');
    }

    return graph;
  }

  private synchronize(): FilterState {
    const graph = this.graph;

    if (graph !== this.appliedGraph) {
      const preset = (Object.keys(AudioFilterPresets) as AudioFilterPresetName[]).find(
        (name) => AudioFilterPresets[name] === graph,
      );

      this.state = preset ? { raw: null, enabled: [preset] } : { raw: graph, enabled: [] };
      this.appliedGraph = graph;
    }

    return this.state;
  }

  private async update(change: (state: FilterState) => FilterState): Promise<FilterState> {
    using _lock = await this.node.queue.tasks.acquire('queue.node.operation');

    if (this.node.queue.destroyed) {
      throw new Error('Cannot change audio filters after the guild queue has been destroyed.');
    }

    const next = change(this.synchronize());
    const graph = [next.raw, ...next.enabled.map((name) => AudioFilterPresets[name])].filter(Boolean).join(',') || null;

    if (graph !== this.graph) {
      const controls = this.node.session?.filters;

      if (controls) {
        if (graph === null) {
          await controls.clear();
        } else {
          await controls.set(graph);
        }
      }
    }

    this.node.queue.options.filterGraph = graph;
    this.state = next;
    this.appliedGraph = graph;

    return next;
  }
}
