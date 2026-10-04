# Conversational voice verification

Coordinator checklist, 2026-09-16. Implementation, fixtures and documentation examples are verified at source/build level. Bounded real GPT-Live WebSocket checks are recorded below; physical audio and browser WebRTC acceptance remain pending.

## Provider-specific acceptance

- Gemini base 3.8: omit thinking configuration; use audio response modality and input/output transcripts. Explicitly reject incompatible authored configuration rather than silently dropping it.
- Scheduling spelling: use `INTERRUPT`, consistent with the [Live tools guide](https://ai.google.dev/gemini-api/docs/live-api/tools) and [Google SDK enum](https://github.com/googleapis/go-genai/blob/main/types.go). The base model page says `INTERRUPTED`; record this documentation inconsistency, and do not claim live verification of either spelling.
- Gemini Extended Thinking: `gemini-3.8-live-extended-thinking` is a separate stable model. LOW/MEDIUM/HIGH reasoning is supported; MINIMAL is not. Require NON_BLOCKING tools and omit function-result scheduling, which this variant does not support. A completed utterance must not clear background-work state; handle IN_PROGRESS and IDLE independently of turnComplete. Account availability remains untested.
- GPT-Live uses `/v1/live/sessions`, not the legacy Realtime endpoint. Wait for session.started before sending audio; close cleanly with a bounded timeout. Client delegation contains an opaque ID, not function arguments. Responses delegation custom-function events are nested in response.event, and can still run through host authorization.
- Speech interruption clears queued playback promptly. It must not automatically cancel independent tool effects. Provider cancellation and local playback interruption need distinct behavior and explicit documentation.

Primary sources: [Gemini base model](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live), [Extended Thinking model](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live-extended-thinking), [thinking protocol](https://ai.google.dev/gemini-api/docs/live-api/thinking), [GPT-Live](https://developers.openai.com/api/docs/guides/live), [delegation](https://developers.openai.com/api/docs/guides/live-delegation).

## Cross-platform acceptance

- Exercise a complete fixture session: connect, capture/input, output/playback, host tool call/result, barge-in, disconnect.
- Verify duplicate starts, readiness timeout, permission/credential rejection, cancellation during connection, stale callbacks after reconnect, bounded audio buffering, and cleanup after errors.
- Tools: unknown names and malformed arguments fail safely; duplicate IDs do not repeat effects; parallel calls preserve identity; rejected authorization returns a correlated error; late results cannot enter a new session.
- Browser examples must use an SDP broker, short-lived credential, or host relay. No project secret in browser bundles, persisted authored configuration, logs, or error strings.
- Model lists come from the host catalog and support refresh. Preserve unknown saved IDs and report unverified compatibility; do not silently substitute a model.
- Compile native code for macOS and iOS. Run targeted native fixtures and the web package test/build/type checks. Record actual commands and outcomes below after execution.
- Documentation examples must match exported APIs. Distinguish executable authored configuration from illustrative persistence. Keep local Parakeet, diarized transcription, live STT, and conversational voice separate.

## Results

### Independently verified native implementation

- **68 tests pass** in a source-linked SwiftPM harness containing the four conversation modules and their actual test targets. Coverage includes configuration round trips, catalog refresh failure, event overflow, tool authorization/validation/deduplication/cancellation, both provider wire protocols, response rounds, setup/close timeouts, malformed arguments, and host teardown/error propagation.
- Root package `swift build --target HudsonConversationHost --scratch-path ~/Library/Caches/codex-builds/hudson-conversational-voice --jobs 2`: **passes**, including all three dependencies, before the settings importer was added. Final importer sources were verified by the source-linked harness and strict iOS compilation.
- All four modules compile for **arm64 iOS 17 Simulator with Swift 6, complete strict concurrency, and warnings as errors**. This is compiler evidence; no simulator application or physical-device session was run.
- `NativeHostExample.swift` independently type-checks against compiled modules with Swift 6, strict concurrency and warnings as errors.
- Seven JSON examples execute through real adapter readiness and Codable round trips: **four valid accepted, three invalid rejected**. Fake credentials and a forbidden HTTP transport ensure no provider access.

Coordinator corrections include deterministic host cleanup, propagation of tool-result transport failures, active-run cancellation, malformed provider arguments rejected before host effects, and synchronized one-shot microphone buffer handoff. The microphone handoff removes the Sendable/captured-mutation diagnostics without blanket compiler suppression. A compiler diagnostic was not evidence of a reproduced hardware race.

Logs: `~/Library/Caches/codex-builds/hudson-conversation-fixtures/` (`test.log`, `root-build.log`, `examples.log`). iOS logs: `~/Library/Caches/codex-builds/hudson-conversation-typecheck/final-ios/`.

The completed task-owned 1.1 GB root build cache was removed after verification to recover disk space while unrelated app builds were active. Logs, fixtures and type-check artifacts remain.

### Independently verified web implementation

- Independent `bun run test` passes **116 tests across nine files**: 65 conversation tests and 51 existing package tests. Host fixtures exercise immediate playback stop before network close, natural terminal cleanup, barge-in, queue bounds, failed close/result delivery, cancellation and late results.
- Independent `bun run build` passed for JavaScript and declarations, including the public `@hudsonkit/ai/conversation` export.
- Package `bunx tsc --noEmit` passes. The documented web example type-checks against the built public declarations. A separate runtime harness imports that actual example and completes browser offer → authenticated sample backend route → mocked provider → answer → session ready, checking rejected anonymous access and the advertised local tool. All fetch calls are intercepted; no network access occurs. This caught and corrected the original example’s mismatched SDP JSON fields, which type-checking alone had missed.
- Browser PCM sample uses ScriptProcessorNode and simple resampling for a compact injectable example. Production hosts should supply their own AudioWorklet-quality capture path where needed. WebRTC audio is a separate media-track path with explicit local mute/resume hooks; a generation marker alone does not silence a media track.
- Coordinator added immediate terminal audio cleanup and two regressions after the worker freeze. No API change was needed. Web logs are `web-test.log` and `web-build.log` beside the native fixture logs.

### Settings import verification

The portable `hudson-conversation-settings` version-1 importer passes 11 native
and 10 web tests within the totals above. Both platforms reject unknown fields,
unsupported provider combinations, secret-shaped values, mismatched credential
reference/kind pairs, oversized UTF-8 fields, and authored delegation payloads.
Import stages configuration; explicit Save applies it. Native reads at most
65,537 bytes and uses importer-owned credential-free adapters for validation.
Opus independently closed review findings D11–D15 in the import review report.

An incremental native test run crashed while Swift Testing described an enum
value after a new error case changed its layout. A clean rebuild of the isolated
fixture harness passed all 68 tests; a subsequent full run also passed. No
production workaround was added for this stale-artifact failure.

### Real GPT-Live checks

- The existing encrypted Scout credential store supplied a readable OpenAI key
  through its own credential API. No key was added to source, chat, or logs.
  Secret CLI lists only its own names index and exposes no project/profile
  selection; its absent OpenAI entry did not establish that no credential existed.
- Real model discovery returned HTTP 200 and `gpt-live-1`. It also returned
  `gpt-live-transcribe`; both conversation catalogs now exclude that
  transcription-only family, with native and web regression coverage.
- The real web-package WebSocket adapter opened `gpt-live-1` and received the
  provider's close acknowledgment. Bun used an explicit header-capable socket
  factory; the default browser-compatible factory correctly refuses API-key
  handshake headers.
- A bounded 45-second synthetic PCM run used `gpt-5.4-mini` for Responses
  delegation. The prompt asked the host to count “blue birds fly home.” One
  local `count_words` call returned `{count: 4}`; GPT-Live emitted the output
  transcript “Sure.That's four words.” and 2,050,560 bytes of PCM output.
  Local interruption advanced the playback generation without cancelling the
  independent tool call. The provider acknowledged close.
- Earlier diagnostic attempts used finite audio without trailing silence and
  received partial output; the final run kept the PCM input clock running with
  silence. One initial smoke harness registered its tool under the wrong key
  and correctly received an unknown-tool result; that was corrected in the
  harness before the successful run. These were actual paid provider attempts,
  not fixture passes.
- The native macOS adapter also opened a real GPT-Live session through its
  URLSession WebSocket transport and received the provider close acknowledgment.
  It did not capture or play audio.
- These checks used generated speech, not a physical microphone. Returned audio
  bytes and a matching transcript do not establish that a person heard playback.

### Live acceptance limits

Physical microphone/speaker behavior, browser microphone permission, actual
WebRTC negotiation, echo cancellation quality, and an installed iOS app session
remain untested. The paired iPhone and iPad were available; they were not
exercised. Gemini live provider sessions are deferred by user instruction.
Speech interruption stops local playback; it does not promise cancellation of
independent delegated work or reversal of completed tool effects.

Commit, push, and PR creation are authorized for this conversational slice.
Merge, package publication, deployment, and installed-app replacement are not.
Earlier transcription PRs are separate completed work.
