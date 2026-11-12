# Repository instructions

## Engineering principles

Discord Player v8 must preserve the simplicity and familiarity of v7 while using Remedia for audio processing and Discord voice transport.

- Prefer simple public APIs backed by well-defined internal implementations.
- Do not introduce abstractions, managers, interfaces, or wrappers without a concrete reason.
- Before creating a new abstraction, check whether an existing implementation can be extended or simplified.
- Prefer deleting redundant code over introducing compatibility layers to preserve it.
- Do not implement speculative features, unused extension points, or placeholder APIs.
- Do not silently swallow errors, fabricate successful results, or hide unsupported behavior behind fallbacks.
- Do not sacrifice correctness, type safety, cancellation, or lifecycle safety for shorter code.
- Keep implementations consistent with the architecture already established in the repository.

Avoid provider-specific assumptions in core packages, tests, documentation, and examples. Use generic providers and identifiers. Do not introduce references to competing audio frameworks.

## Scope and repository boundaries

- Base topic branches on `master` unless explicitly instructed otherwise. Work on the requested branch.
- Do not modify the Remedia repository unless explicitly requested.
- Do not open pull requests, merge branches, publish packages, or change release versions unless explicitly requested.
- Do not implement APIs that require unreleased or nonexistent Remedia functionality.
- Read the actual source code and installed dependency types before designing changes.
- Keep changes focused on the requested behavior. Avoid unrelated refactoring unless it is necessary to remove duplication or support the implementation.
- Update all affected call sites, exports, tests, and documentation when changing an API.
- Do not leave partially migrated code paths or parallel implementations of the same behavior.

## Compatibility policy

Discord Player v8 is unreleased. Backward compatibility with earlier v8 development implementations is not required.

Compatibility with the released v7 API is important.

- Inspect the v7 implementation on `v7` branch before claiming compatibility.
- Preserve familiar v7 public APIs, event names, argument ordering, hooks, and lifecycle behavior where technically feasible.
- Reimplement behavior using the current architecture rather than copying obsolete v7 internals.
- Do not keep redundant aliases, deprecated stubs, or duplicate options merely to support unreleased v8 code.
- When v7 behavior cannot be preserved, document the limitation and provide a clear migration path.
- Never claim API compatibility based solely on matching method names or TypeScript declarations.

## Remedia integration

Remedia owns audio decoding, processing, streaming execution, Discord voice transport, and native session lifecycle.

Discord Player owns Tracks, queues, search orchestration, plugin routing, application-level events, and queue policies.

- Use the supported `@remedia/client` API and its actual exported types.
- Do not invent Remedia methods, RPC operations, event names, or capabilities.
- Preserve embedded and remote execution support.
- Preserve operation-source playback, node capabilities, host affinity, session resumption, cancellation, and crossfade behavior.
- Do not assume that a remote node can access local files, Readables, buffers, or other process-local resources.
- Keep authentication, internal media grants, and provider-specific execution data out of public logs and serialized Track metadata.
- Preserve existing media access restrictions. Do not weaken security checks merely to make a test pass.
- Do not duplicate Remedia functionality inside Discord Player.
- Future Remedia capabilities may be prepared for through clean interfaces, but must not be presented as implemented.

## Events and lifecycle

Treat event compatibility as observable behavior, not merely a type-level contract.

- Inspect the complete v7 event API and the current Remedia event types before modifying event forwarding.
- Expose supported Remedia session and client events at the appropriate scope.
- Use `player.events` for queue-scoped events and `player.on` for genuinely Player-level or node-level events.
- Preserve familiar v7 event names and application-level argument ordering where an equivalent exists.
- When an event originates from Remedia, append the original typed Remedia event as the final argument after the Discord Player arguments.
- Do not replace Discord Player objects with raw Remedia payloads when the queue already owns the relevant Track or state.
- Do not fabricate raw Remedia events for Discord Player-owned operations.
- Never emit compatibility events with fabricated or misleading payloads.
- Avoid duplicate event emissions when an API call and a Remedia notification describe the same logical change.
- Do not emit `playerStart` when a Track is only staged for crossfade.
- Distinguish natural completion, skip, stop, replacement, failure, and cancellation.
- Use generation, session, and queue-operation identity to reject stale events from state mutation.
- Keep diagnostic events observable where appropriate without allowing obsolete sessions to corrupt the queue.
- Preserve deterministic listener ordering and release listeners when sessions or queues are destroyed.

Do not conflate Discord Gateway voice-state updates with Remedia transport-state events.

All public events must be strongly typed, documented, and tested with their actual runtime argument ordering.

## Concurrency and resource ownership

Audio and voice operations are asynchronous and may overlap.

- Preserve existing queue locking and operation serialization rules.
- Ensure cancellation propagates through search, source resolution, stream preparation, and playback.
- Recheck operation identity after awaited work before mutating queue state.
- Treat crossfade staging and active playback as separate lifecycle phases.
- Handle skip, seek, stop, replacement, reconnect, and queue destruction during pending operations.
- Avoid unhandled promise rejections, abandoned timers, listener leaks, and dangling streams.
- Make cleanup idempotent where appropriate.
- Do not introduce unbounded caches, queues, retries, or buffering.
- Never fix a race by suppressing an event or ignoring a failure without establishing the correct lifecycle behavior.

## Plugin architecture

Plugins provide capabilities. Discord Player orchestrates those capabilities.

- Use one coherent operation-dispatch model for modern plugins, legacy adapters, and standalone plugin hosts.
- Avoid separate registries or execution implementations when the existing dispatcher can support the operation.
- Preserve provider identity and the deployment identity required for remote execution.
- Keep portable Track data serializable. Do not serialize active streams, credentials, temporary grants, or process-local objects.
- Support local and remote execution without silently changing providers.
- Enforce explicit routing, plugin priorities, protocol ownership, and cancellation consistently.
- Preserve meaningful v7 `BaseExtractor` compatibility through adapters, not duplicated implementations.
- Do not force optional capabilities such as lyrics onto plugins that do not implement them.
- Make empty results distinguishable from execution failures.

## Hooks and context

- Preserve v7-compatible global hook registration where feasible.
- `useMainPlayer()` must prefer the current async context and otherwise resolve the first active registered Player, consistent with v7.
- Keep multiple Player instances isolated inside their respective async contexts.
- Do not infer guild-specific context when none exists.
- Execute hooks with the correct Player and queue context.
- Preserve hook precedence, cancellation, and error propagation.
- Do not claim local byte-stream interception is available when a remote Remedia node owns the stream.
- Avoid reviving obsolete streaming abstractions when source-level hooks are sufficient.

## Voice-state policies

- Keep voice-channel membership tracking independent of any mandatory Discord library dependency.
- Never assume a channel is empty when membership cannot be established reliably.
- Distinguish confirmed empty membership from unavailable or unknown membership information.
- Use authoritative snapshots or explicitly supplied resolvers for emptiness-dependent policies.
- Discard stale asynchronous reconciliation results.
- Recheck conditions before executing cooldown-based disconnect or pause actions.
- Keep queue-end and queue-stop policies independent from voice-channel emptiness policies.
- Do not let listeners for observational events implicitly disable default lifecycle handling.

## API documentation

- Add clear JSDoc to every exported class, interface, type, property, and method in `packages/discord-player`.
- Apply the same standard to public APIs exported by `packages/plugin-host`.
- Document every public method parameter with an `@param` entry and describe return values when the behavior is not obvious.
- Document important event argument ordering, cancellation behavior, lifecycle constraints, and supported resource types.
- Keep JSDoc aligned with actual Remedia capabilities and call out unsupported or deferred behavior.
- Do not write documentation for hypothetical APIs as if they already exist.
- Update relevant documentation and examples when changing a public API.
- Keep examples short, realistic, type-correct, and consistent with the actual implementation.
- Preserve accurate v7 migration guidance.
- Do not add promotional language or comparisons with competing frameworks.

## Code quality and TypeScript

- Prefer precise exported types and inferred internal types.
- Avoid `any`, unnecessary `unknown`, unsafe casts, non-null assertions, and `@ts-ignore`.
- Do not introduce broad types to hide mismatches between packages.
- Use existing shared types instead of duplicating structurally equivalent declarations.
- Keep error messages specific and actionable.
- Handle expected failures explicitly; do not use empty catch blocks to conceal them.
- Prefer direct control flow over unnecessary indirection.
- Keep modules focused and avoid circular dependencies.
- Do not add dependencies when existing packages or standard library APIs are sufficient.
- Preserve compatibility with the Node.js version and module configuration declared by the workspace.

## Code spacing

Give code breathing room: use blank lines between declarations, methods, test cases, and logical steps within functions.

Keep closely related statements grouped, and keep documentation comments attached to the declarations they describe.

Avoid dense blocks of code with no visual separation; preserve this spacing when formatting.

Do not compress logic into one-liners when it makes lifecycle or error-handling behavior harder to follow.

## Testing and validation

Every behavioral change must have meaningful regression coverage.

- Test public behavior, not merely internal implementation details.
- Test actual emitted event argument tuples rather than only checking event names.
- Include failure paths, cancellation, stale events, reconnection, and cleanup where relevant.
- Cover embedded and remote execution paths when changing shared logic.
- Test crossfade preparation, promotion, cancellation, and fallback independently.
- Use deterministic fixtures, local HTTP services, and mocked gateway inputs.
- Do not make ordinary tests depend on public media services, real Discord credentials, or expiring media URLs.
- Use the installed Remedia event types and actual package contracts rather than invented mocks.
- Do not weaken or remove tests simply to make a change pass.
- Do not claim tests passed unless they were executed successfully.
- Report incomplete validation and unrelated existing failures separately.

Use pnpm as configured by the repository. Do not substitute npm or Bun for the workspace commands.

Relevant commands include:

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

Run focused package tests during development and the relevant workspace checks before finishing.

Do not needlessly reformat unrelated files.

## Git commits

When committing changes to the repository, co-author the commit as the coding agent.

- Use a valid `Co-authored-by` trailer with the coding agent's actual identity. Do not invent an identity.
- Make commits focused and descriptive.
- Do not use `git push --force` or rewrite unrelated history.
- Do not overwrite or discard unrelated uncommitted changes.
- Do not commit generated build output or temporary test artifacts unless the repository explicitly tracks them.
- Commit directly to the requested working branch when instructed.
- Do not create additional pull requests without explicit authorization.

## Completion requirements

Before reporting the task complete:

1. Verify that the public API works as documented.
2. Verify that relevant v7 compatibility behavior has been implemented, not merely declared.
3. Check that obsolete code and duplicate implementations have been removed.
4. Confirm cancellation, session ownership, event ordering, and cleanup behavior.
5. Run applicable build, typecheck, lint, formatting, and test commands.
6. Review the final diff for unrelated modifications, debugging code, unused imports, stale documentation, and unintended API additions.

Report what was implemented, which APIs changed, what was removed, what tests actually ran, and what remains unsupported.

Do not describe incomplete work as finished or claim support for Remedia capabilities that have not been implemented.
