# Transcription implementation progress

The full implementation goal remains active. No new adapter is verified yet.

## Workspaces

- Hudson: `/Users/arach/dev/hudson-worktrees/transcription-adapters`, `codex/transcription-adapters`, based on origin/main.
- Talkie: `/Users/arach/dev/talkie-worktrees/transcription-adapters`, `codex/transcription-adapter-integration`, isolated from original dirty checkout at HEAD cfddcfa0.
- Original Talkie has unrelated edits including iOS TranscriptionService.swift; do not overwrite them.

## In flight

Grok contract implementation: Scout flight `flt-mu47i7vw-5tujxf`, session `session-mu47i7mi-ohhp96`, invocation `inv-mu47i7vr-9cy86j`. Confirmed running September 16. Continue this flight, do not start duplicate work. Brief: ../prompts/transcription-contract-implementation.md. Grok owns only core source/tests and additive root manifest entries. Primary owns provider adapters and integration. Grok is allowed to run the shared stable Hudson test cache; serialize other builds against that cache.

## Verified integration finding

TalkieEngineCore/Package.swift already depends on WhisperKit from 0.9.0 and FluidAudio exactly 0.15.6. Inspect VoxEngine resolved dependencies before adding a direct FluidAudio adapter so the combined graph resolves once. Existing streaming implementation is apps/macos/TalkieEngineCore/Sources/TalkieEngineCore/StreamingASRService.swift. EngineService.swift owns current local file processing and model setup.

## Provider contracts rechecked

- Microsoft MAI uses multipart audio plus definition on Speech fast transcription, API version 2025-10-15, enhancedMode enabled with MAI-Transcribe-2. Official source: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/mai-transcribe
- Dedicated Gemini file uses Files upload then interactions, not a generic generateContent prompt. Source: https://ai.google.dev/gemini-api/docs/transcribe
- Dedicated Gemini live uses Live WebSocket with TEXT response modality; interimInputTranscription and inputTranscription are distinct. PCM input and audioStreamEnd are documented. Source: https://ai.google.dev/gemini-api/docs/live-api/live-transcribe

## Next

Review and compile Grok core, then freeze public signatures for provider adapter implementation. Implement injected transport fixtures before cloud requests. Continue all provider, local reference, Talkie settings and runtime integration, regression, native UI, and live acceptance requirements from the goal; this report is not a completion claim.

## Cloud transport implementation

Primary added injectable URLSession HTTP transport, HTTPS endpoint validation, sanitized HTTP errors, and multipart encoding in Sources/HudsonTranscriptionCloud. Direct swiftc compilation and executable transport checks passed. Regression test source is in Tests/HudsonTranscriptionCloudTests/TransportTests.swift; this target awaits manifest registration after Grok finishes its manifest edits. The checks caught CRLF as a single Swift Character, so header validation now checks Unicode scalars and rejects all control characters. These checks do not verify any provider adapter or real cloud request.

## MAI and Gemini file wire clients

Added HudMAITranscriptionClient and HudGeminiFileClient under HudsonTranscriptionCloud. These are wire clients awaiting contract adapters, not integrated engines. MAI explicitly submits MAI-Transcribe-2 and handles optional annotations. Gemini supports resumable file upload, file state lookup/deletion, dedicated Interactions submission, text and word annotations, option conflict rejection, and same-host HTTPS upload validation. Official Files documentation rechecked at https://ai.google.dev/gemini-api/docs/files .

Six Swift Testing fixtures passed (exit 0) via a temporary standalone package copied from cloud sources/tests, using stable scratch path ~/Library/Caches/codex-builds/hudson-cloud-transport. Log: /tmp/hudson-cloud-check.log. Root manifest registration remains pending to avoid overlap with Grok's assignment. No live provider requests. Test coverage: multipart/header safety; MAI required model, absent annotations, no retries; Gemini upload/interaction/delete, annotation mapping, option conflicts, foreign upload host rejection.

Current resolved Vox baseline graph has only moonshine-swift and vox checkouts; earlier concern about a simultaneous FluidAudio dependency inside this resolved Vox graph is not yet established. Inspect the actual target manifest before changing dependency constraints.

## Live wire connection and first contract adapter

Added injectable WebSocket transport and HudGeminiLiveConnection for dedicated transcription and separate conversational input. Setup modalities differ; generated output is ignored, input fragments are distinguished from dedicated finalized utterances, PCM chunks are ordered/bounded, finish rejects late sends, and cancellation closes the connection. A host adapter still needs to implement bounded drain and terminal result mapping.

Added HudRemoteTranscriptionOperation and HudMAITranscriptionAdapter against Grok public core types now on disk. MAI compatibility rejects 15-minute-plus diarization, requires known duration below two hours, checks file format and size below 250 MB, and explicitly selects MAI-Transcribe-2. It computes source digest, maps milliseconds to seconds without inventing missing annotations, and emits provider ID before completion. Official size/duration REST reference: https://learn.microsoft.com/en-us/rest/api/speechtotext/transcriptions/transcribe?view=rest-speechtotext-2025-10-15 .

Eleven cloud/adapter fixture tests passed, exit 0, against a copied core snapshot and cloud sources in the standalone CloudCheck package. Full Hudson manifest integration and regression run are pending Grok completion. Live cloud accounts remain untested. Grok received review request to fix raw pipe-joined configuration fingerprint and protect configuration serialization from credentials.

## Gemini file adapter checkpoint

Added `HudGeminiTranscriptionAdapter` using the public core contract. It checks
mode, file type, known duration, annotation conflicts, and vocabulary limits
before network work. It records owned Gemini Files resources through an injected
host callback, deletes them after transcription or failure, and reports cleanup
failures without discarding a successful transcript. It preserves returned model
identity, request ID, source digest, word offsets, and speaker labels.

Gemini client now requires completed interaction status and selects one output
representation to avoid duplicating word annotations. The URLSession transport
uses a per-task redirect refusal delegate so custom provider credentials are not
forwarded implicitly.

Standalone Swift 6 cloud package verification: **14 tests passed**, exit 0,
`/tmp/hudson-cloud-check.log`, stable cache `hudson-cloud-transport`. These are
fixture tests, not live service acceptance. Added tests cover actual model
provenance, upload deletion, cleanup failure preserving transcript, and incomplete
interaction rejection. No microphone or cloud account was used.

Still required: deadline enforcement across each request (current file adapter
checks between requests), cancellation/unknown-outcome resource recovery,
root-package cloud target registration after Grok finishes editing the manifest,
shared-contract review, live adapter integration, local implementations, and
Talkie integration. Gemini upload callback is required so the host can persist
cleanup state; host persistence integration remains to be implemented.

## Gemini live session checkpoint

Added `HudGeminiLiveSession` and `HudGeminiLiveAdapter`. Two separately registered
profiles expose dedicated `gemini-3.5-transcribe-live` and conversational
`gemini-3.8-live` input transcription. Compatibility checks reject unsupported
annotation/options combinations before opening a socket. Sessions consume caller
PCM; they never open a microphone. Setup, total session, and drain waits are
bounded. Final utterances remain separate from the single terminal event;
missing drain completion, event buffer overflow, and pending provisional text
cannot become a successful complete transcript. Cancellation after sending audio
reports uncertain remote outcome. Conversational generated output is ignored,
with its possible billing explicitly documented in model evidence.

Added lifecycle fixtures for final-vs-terminal separation, rejected late writes,
drain timeout, and cancellation uncertainty. Standalone Swift 6 verification is
now **17 tests passed**, exit 0 (`/tmp/hudson-cloud-check.log`). No live provider
acceptance yet; turn-completion behavior still needs real-service verification.

Also added total HTTP request timeout cancellation and propagated remaining file
request deadlines into Gemini calls; upload start/finalize share their time
budget. Cleanup has an independent bounded 15-second attempt. Current code is
still awaiting root-package wiring and integration review.

## FluidAudio direct adapter checkpoint

Added `HudsonTranscriptionFluidAudio` source and tests. The adapter is compiled
against Talkie's actual cached FluidAudio **v0.15.6** API. Supports Parakeet v2/v3
file inference with fresh decoder state, normalized derived word timing, and
explicit local model readiness/preparation. Direct Core ML loading is deliberate:
FluidAudio's `ModelHub.loadModels` convenience path can purge and re-download a
cache after a load failure. The adapter's `HudFluidAudioLocalModels` loads only
selected compiled assets and vocabulary, preserving caller files on failure.

Caller-fed local PCM dictation now has a bounded full-utterance revision path:
mono PCM16 at 16 kHz, 6,400-byte maximum chunks, 120-second session bound,
provisional full-utterance inference every two seconds, final whole-input pass,
and no microphone access. This is not the native SlidingWindow manager. Native
SlidingWindow currently hides partial-window inference failures behind warnings;
its input stream is also internally unbounded. The bounded implementation needs
real-model latency/quality evaluation before deciding whether to adopt a native
streaming model instead. Do not call local live acceptance complete yet.

Standalone Swift 6 package build succeeded against the actual dependency;
**4 fixture tests passed**, exit 0, log `/tmp/hudson-fluidaudio-check.log`, cache
`~/Library/Caches/codex-builds/hudson-fluidaudio-adapter`. Tests cover no implicit
model download, incompatible speaker labels, cancellation suppressing late
success, and PCM conversion/final-vs-terminal/provenance. No models were loaded
or downloaded and no live audio was captured during these checks.

WhisperKit delegated through Scout/Grok using
`docs/prompts/transcription-whisperkit-implementation.md`:
flight `flt-mu48fnnu-lg8mwv`, session `session-mu48fncb-86jzdu`, invocation
`inv-mu48fnnu-g9hpxl`, conversation `chn-8d896dc9c656487693c4e233b604f2fa`.
Last broker poll: running. Worker owns WhisperKit source/tests only, no manifest.
Core Grok flight remains running; its manifest/core source ownership is intact.

### Integrated package and remote reference checkpoint

Core Grok flight `flt-mu47i7vw-5tujxf` ended **failed/interrupted**. Primary took
ownership of its delivered core and manifest. Fixed two issues during review:
configuration fingerprints now use canonical JSON plus SHA256 rather than
ambiguous, exposed pipe-delimited fields; registry candidate evaluation now
checks the model catalog so unknown saved models cannot become runnable merely
because a generic adapter reports ready. Provider availability errors are
sanitized before presentation.

Registered cloud and FluidAudio products/targets/tests in the authoritative root
manifest, with FluidAudio 0.15.6 matching Talkie. Added a separate
`HudsonTranscriptionElevenLabs` DIY reference module using only public core and
cloud transport APIs: Scribe v2 file submission, standard retention, optional
word timing/diarization/clean text, neutral upload filename, source digest,
request ID, cancellation/unknown remote outcomes. Unsupported vocabulary and
smart formatting are rejected explicitly. No UI integration or live provider
acceptance is implied.

Root integrated build succeeded. First core test run exposed the unknown-model
candidate bug above; after fixing, selected test run passed **40 tests in 10
suites**, including existing transport/TTS checks selected by the broad filter
and new ElevenLabs fixture tests. Log `/tmp/hudson-transcription-integrated.log`;
scratch `~/Library/Caches/codex-builds/hudson-transcription-baseline`.
WhisperKit Grok remains running as of this checkpoint; no source delivered yet.
Talkie integration inspection started; its isolated worktree remains unchanged.

A separate root-package run covered the six dedicated/conversational live
fixture tests plus the existing HudsonVoice regression suite: **33 tests in 5
suites passed**, exit 0. Log `/tmp/hudson-transcription-live-regression.log`.
These runs have some overlap; do not sum them as a unique test total. No real
provider requests or microphone capture occurred.

Next integration seam confirmed: Talkie's main app currently routes recording
retranscription through `RecordingRetranscriptionService` -> `EngineClient` and
has no native Hudson package entry in its Xcode project. `project.yml` exists
and should remain the project-generation source. Add a host service with durable
configuration/consent/result persistence and wire actual call sites; avoid adding
Hudson's macOS 26 requirement to the existing broadly shared TalkieKit (currently
macOS 14/iOS 17) just to make the dependency accessible. A separate host package
or app target dependency is the appropriate boundary to inspect next.

### Talkie host module checkpoint

Created `apps/macos/TalkieTranscription` in the isolated Talkie worktree. Swift 6
package depends on Hudson core through `HUDSON_PACKAGE_PATH` (default sibling
Hudson checkout), without changing TalkieKit's minimum deployment target.
`TranscriptionWorkspace` owns per-use-case configuration and consent snapshots,
atomic JSON state, pre-submission durable intent, operation deduplication,
cancellation forwarding, result/provenance persistence and source/track identity.
Interrupted remote submissions recover as unknown; local interruptions as failed.
No automatic resubmission. Unknown adapters/models are preserved by the state.

Host package build and one integration fixture test passed. The test checks
consent blocks all submission, consent enables submission, completed results and
meeting track identity survive reload, duplicate operation IDs cannot resubmit,
and an interrupted durable run recovers as unknown without provider work.
Log `/tmp/talkie-transcription-host.log`; cache
`~/Library/Caches/codex-builds/talkie-transcription-host`.

This module is NOT yet wired into the app project, UI, actual dictation, meeting,
or recording call sites. Also still needed: live-session host ownership, credential
resolver/provider registration, uploaded-file cleanup ledger, secure configuration
validation, user-visible error presentation, and actual application build/testing.
Grok WhisperKit flight `flt-mu48fnnu-lg8mwv` authoritatively remains running.

### App integration in progress; Parakeet preference reaffirmed

User explicitly reaffirmed Parakeet as their favorite. Preserve the existing
selected Parakeet engine and queued recordings; additional providers must not
replace it by default. Settings now state Parakeet is the preferred local engine,
and the direct adapter displays as Parakeet (FluidAudio).

Talkie changes now include app-owned registration/credential resolution,
per-use-case settings, configured recording-engine menu actions, scratch
RecordingController routing, and a meeting ingest branch that submits each feed
independently through the selected adapter, reuses durable completed runs, and
never resubmits uncertain runs on a sweep. Existing providers remain the default
when no adapter is selected. These app edits are not yet typechecked end to end.

Root app build is blocked before source compilation by an XCFramework packaging
collision: FluidAudio's NemoTextProcessing and Termini's GhosttyKit both export
`include/module.modulemap` into the same app build directory. A diagnostic
CONFIGURATION_BUILD_DIR namespacing attempt did not solve this: both artifact
commands belong to the app's build context. No cached dependency artifacts were
modified. Need a real package/artifact boundary solution, not disabling local
Parakeet or silently dropping its adapter. App syntax parse passed. Xcode project
was regenerated from project.yml; review generated unrelated ID churn before
finalizing. macOS deployment target now 26 per project instructions/Hudson.

Additional remaining app work: remove legacy-engine startup gating only when a
configured dictation adapter is ready, support caller-fed live sessions, preserve
unknown model settings without substitution, finish cleanup recovery UI/ledger,
meeting error presentation/manual retry, capability filtering and configured-engine
menus across all recording surfaces. App build log `/tmp/talkie-transcription-app.log`.

### App compilation and binary-header collision

Full Talkie validation build succeeded (`/tmp/talkie-transcription-validation.log`) using the stable talkie-transcription-app cache, signing disabled. No app was launched or installed.

Root cause: FluidAudio NemoTextProcessing and Termini GhosttyKit static XCFrameworks both export Headers/module.modulemap into the same application include directory. An isolated Termini worktree at /Users/arach/dev/termini-worktrees/transcription-binary-headers starts from exact dependency revision 57cf01c4b1efa821fa8cfd944ae95c63f2fd35a7. The same Ghostty binary now has its headers and module map under Headers/GhosttyKit. No binary/runtime changes or cached dependency edits. Reproducible normalization was added to installation and release packaging. Release packaging stages a copy without changing its source artifact. Shell syntax, two-slice normalization, idempotence, and actual Clang module discovery passed.

The task-owned TalkieTranscriptionValidation.xcodeproj substitutes only that local Termini package. The canonical project still references the remote release: the packaging fix needs normal dependency delivery before claiming that project builds. Do not distribute the validation project's absolute paths.

Parakeet remains the preferred local engine; existing saved selections and queues are preserved. Requesting progress from the existing Grok WhisperKit session failed with “broker is not reachable”; this does not prove its earlier work stopped.

Remaining: live host lifecycle and capture integration, complete dictation routing, configuration and ledger durability refinements, real provider/model acceptance, final docs, and dependency delivery. Goal remains active.

### Consent snapshots and durable Gemini upload ownership

Talkie now binds submission to the selection observed before reading audio duration and rechecks the selection after asynchronous readiness. Meeting tracks carry the same expected selection, so a settings edit or consent revocation cannot submit the second track under mismatched provenance. Endpoint configuration rejects embedded user information, query strings, fragments, and relative URLs before persistence; malformed UI input no longer silently becomes a default endpoint.

Gemini upload ownership callbacks can now throw. A failed created-file ledger write prevents the transcription request and attempts deletion. Talkie's ledger updates its in-memory state only after atomic disk persistence succeeds. If cleanup ownership cannot be durably recorded either, the adapter reports an unknown remote outcome.

Verification: host package 3 tests passed (consent/reload/duplicate protection, changed selection blocks submission, unsafe endpoints never persisted). Gemini-filtered suite 8 tests passed, including a new fixture proving ownership failure deletes the upload without calling the transcription endpoint. Subsequent unknown-cleanup handling needs its additional test and verification. Incremental app validation is running; do not infer completion from the previous successful build.

Follow-up verification: Gemini-filtered suite now passes 9 tests, including unknown remote outcome when neither upload ownership nor cleanup can be recorded. Incremental app build after the consent and ledger changes passed. Scratchpad start routing now permits a selected adapter without the legacy engine process and prevents overlapping starts; its next app compilation is in progress (exec handle 40619).

The follow-up app validation including scratchpad start routing also completed successfully. No builds remain running at this checkpoint.

### Durable host live sessions

Implemented TalkieTranscription.WorkspaceLiveSession and TranscriptionWorkspace.openLive. The host persists intent before opening an adapter, rechecks consent before each PCM write, rejects late audio, bounds event buffering, enforces session/event ordering, limits lifetime, and saves terminal outcomes before delivering them. Cancellation after remote audio becomes unknown outcome. A failed terminal persistence write cannot expose success. Existing memo preview remains separate and unchanged; capture integration is still required.

The host package now passes 7 tests, including durable live completion, remote cancellation uncertainty, consent revocation stopping further writes, and terminal persistence failure. Source files are WorkspaceLiveSession.swift and LiveWorkspaceTests.swift in the isolated TalkieTranscription package. No real microphone/provider acceptance is claimed.

Scout recovery: flight flt-mu48fnnu-lg8mwv is authoritatively failed (local turn interrupted). Continuing its exact session produced failed dispatch flt-mu4a0km3-7ganxu because the session endpoint was unreachable. A fresh Grok-profile request for the same bounded WhisperKit source/tests ownership has now been issued; receipt pending (exec 65182). App validation with the live host layer is running (exec 77393).

App validation including the new live host layer succeeded. Fresh Grok WhisperKit dispatch queued: flight flt-mu4a1b39-799nhv, session session-mu4a1aro-fsggpn, conversation chn-f1672433d77a461ead1099b3027fdf32, alias project-curie-3. Poll this handle; do not overlap ownership while it is active.

### Scratchpad live capture integration

Scratchpad RecordingController now opens live-only dictation models through the durable workspace, captures local WAV under the app's Transcription/Recordings folder, streams bounded PCM chunks, displays provisional utterances, and waits for the saved final result before routing text. Cancellation stops the live session; failure retains captured audio. Batch-capable Parakeet keeps its established finalized-file path. Settings expose live-only models for dictation and explain live upload behavior. This is scratchpad integration; the separate TalkieAgent global dictation route still needs integration.

TranscriptionAudioSink uses AVAudioConverter to normalize input to PCM16 mono 16 kHz, writes WAV before emitting bytes, flushes resampler latency, and fails explicitly if its bounded queue overflows. A real AVFoundation synthetic-audio fixture passed: 4800 stereo frames at 48 kHz yielded exactly 1600 mono frames at 16 kHz, and saved WAV bytes matched the stream. Host suite: 8 tests passed. App build before provisional UI updates passed; final incremental build running (exec receipt in task).

Grok flight flt-mu4a1b39-799nhv was verified running during this turn. Do not overlap its WhisperKit ownership.

The final incremental app build passed with provisional live transcript UI and the extracted audio sink. No app was launched. The global TalkieAgent path is separate: DictationBridge calls its service, and EngineClient delegates to EmbeddedEngineCoordinator. APIKeyStore already writes through to shared Keychain for the agent. Before sharing workspace persistence across app and agent, address single-writer ownership or transactional cross-process state; the current actor alone does not protect two processes from stale snapshots. Do not merely instantiate the current workspace twice against the same JSON file.

### App and agent selection ownership

TranscriptionWorkspace now supports a separate shared selection file and read-only selection consumers. The app is the selection writer; the future agent integration will use its own run ledger and read selections fresh before submissions/writes. Legacy app selections migrate when the separate file is absent. Corrupt selections fail explicitly instead of falling back to another engine. The host suite passes 9 tests, including app changes observed by a read-only agent workspace, independent run records, rejected agent writes, and corrupt-file failure. Global agent routing is still pending.

User-reported iOS launch crash took priority during this checkpoint. Two crash reports copied read-only from the connected iPhone 13 mini show identical main-thread stack-guard failures while resolving CodexCommandDeckSurface.keybed type metadata (installed 2.5.45 build 50). A focused row-view extraction is under validation in the isolated Talkie checkout. No installed app has been replaced; no iOS runtime fix is claimed yet. Original dirty iOS files remain untouched.

Crash follow-up: the candidate fix now lives in /Users/arach/dev/talkie-worktrees/ios-mini-stack-fix on codex/ios-mini-stack-fix, with a snapshot of existing iOS changes plus the isolated four-row extraction. It was removed from the transcription worktree. Current-source iPhone build passed. Subsequent signature verification found an unsigned product; signing configuration is under investigation. Original checkout unchanged; phone installation/runtime verification still requires authorization under the active goal constraint. See that worktree's docs/reports/ios-mini-launch-crash-2026-09-16.md. Grok WhisperKit flight remains running; review feedback sent on preparation cancellation, stale files and queued deadlines (msg-mu4arw2y-dbnt9r).

Phone candidate is now ready: reused the existing ignored local signing configuration; signed current-source build and codesign deep/strict verification passed. No phone install yet. Crash fix lives only in the focused ios-mini-stack-fix worktree. Transcription goal remains active, with global agent routing, WhisperKit registration/review, real provider acceptance, recovery UX and final delivery still pending.

User authorized the phone candidate install. Installed in place; two launches remained running (PIDs 2200 and 2209), with no fresh Talkie crash reports. Startup regression verified on the mini; full deck/AskAI behavior not yet verified. User clarified AskAI concern: Home Ask/Find is a mode selector, not an immediate ask action. Source confirms HomeCommandCenter.toggleMode toggles ask/search and focuses text; submit requires nonempty prompt. Discussing voice affordance before expanding iOS changes.

### Shared host registration and selection-clear regression — September 16, 12:29 EDT

Moved maintained adapter registration and Gemini upload ownership from Talkie's
private service into the TalkieTranscription host package. `TranscriptionHost`
constructs the same registry for the app and agent. App and agent use separate
workspace and upload ledger filenames; only the app writes shared selections.
No provider is invoked and no local model is loaded by constructing the host.
The app service now uses this composition root. The global agent call sites are
not connected yet.

Extracted file submission into `TranscriptionWorkspace.transcribeFileIfSelected`
for both hosts. Fixed an observed race in the former app helper: clearing a
previously captured selection used to return nil (which allows the caller's
legacy fallback). It now throws `selectionChanged` before reading audio or
submitting. A genuinely absent initial selection still permits the established
engine, preserving existing Parakeet/Vox behavior.

Validation: 13 host fixtures pass in `/tmp/talkie-transcription-host.log`, using
the existing stable host cache. New coverage includes upload ownership reload,
cleanup failure persistence, corrupt/unwritable ownership storage, shared host
registration with read-only agent choices, and clearing a captured file
selection. Main Talkie validation project build passed with the latest changes
in `/tmp/talkie-transcription-validation.log`. This remains an unsigned build
against isolated Hudson and the local Termini packaging correction; it does not
prove canonical released dependency packaging or live provider acceptance.
No app was installed or launched for this check. `git diff --check` passed.

Source inspection confirms TranscriptionRetryManager's automatic retries are
disabled, but both manual retry paths still call the legacy engine directly.
Before connecting global dictation, adapter-owned recordings need durable run
identity and explicit retry handling; failed or unknown remote jobs must not be
silently passed into that legacy route. Multi-segment dictation also currently
stamps `settings.selectedModelId`, requiring actual adapter provenance.

Grok's earlier WhisperKit flight `flt-mu4a1b39-799nhv` was terminal interrupted.
Continuation failed before execution because its session was unreachable.
Replacement flight `flt-mu4b84hk-giop5b` was verified running. It owns only the
WhisperKit module/tests and is completing preparation cancellation, stale model
validation, and deadline behavior; no manifest registration is claimed yet.

### September 16, 12:42 — Global agent batch routing verified

TalkieAgent now binds the selected dictation service before processing recording
segments. Adapter submissions retain provider, model, configuration fingerprint,
and source identity. Queue and failure records retain that route. The agent's
processing task is now attached to its cancellation handle, and segment word
offsets use audio duration rather than the last recognized word.

Individual retries require the saved adapter configuration to remain selected;
bulk legacy retries skip adapter-owned or unresolved recordings. DictationBridge
also uses the selected service and retains failed audio with its route. These
changes are source-implemented; the focused tests below do not exercise physical
capture, every controller cancellation race, or real provider requests.

The isolated TalkieAgent validation project completed build-for-testing, followed
by three passing SelectedTranscriptionServiceTests: absent selection preserves
legacy behavior while removal of a bound selection fails; an unknown remote
outcome is persisted without fallback; recording conversion retains ownership
and blocks legacy retries. Swift Testing executed all three tests (the preceding
XCTest zero-test summary is a separate runner). Evidence:
`/tmp/talkie-transcription-agent.log`,
`/tmp/talkie-transcription-agent-tests.log`, and
`~/Library/Caches/codex-builds/talkie-transcription-agent/Logs/Test/Test-TalkieAgent-2026.09.16_12-42-18--0400.xcresult`.
`git diff --check` passed. The DEBUG test-host environment guard bypasses normal
agent startup; no installed app was replaced. Global agent caller-fed live
capture is still pending, as are native adapter acceptance and broader lifecycle
review. Grok flight `flt-mu4b84hk-giop5b` was again verified running.

### September 16 — Validate result ownership before durable completion

The shared workspace now checks provider ID, model ID, configuration fingerprint,
and run ID before saving batch or live completion. Previously this check existed
only in the agent consumer, after persistence; recording and meeting consumers
could receive an unchecked result. A mismatch now retains a remote run as an
unknown outcome (local live runs fail), saves no result, and cannot be delivered
as success. This prevents a malformed adapter receipt from being attributed to
the wrong recording. It does not independently verify transcript accuracy or
source audio digests.

The host suite now passes 15 tests, including new batch and live identity
mismatch fixtures with reload assertions. The valid live fixture now supplies
its actual configuration fingerprint. Evidence: `/tmp/talkie-transcription-host.log`.
Grok flight `flt-mu4b84hk-giop5b` remains authoritatively running. Global live
capture and live provider acceptance remain outstanding.

### September 16 — WhisperKit primary verification in progress

The broker's running label has no worker progress receipt after acknowledgement;
source files last changed around 12:32. A status-only request was sent to the
same session (flight `flt-mu4c4r13-s9g9sg`), without restarting implementation.
Primary created the prescribed standalone validation package and compiled
against resolved WhisperKit 0.18.0. A Swift 6-mode trial rejected the native
WhisperKit call for sending an actor-owned non-Sendable instance to its async
method. The next validation uses Swift tools 5.9, matching Hudson's manifest;
this does not resolve the strict-concurrency diagnostic.

Review also identified a likely queued-deadline hang: cancellation of a task
waiting on a previous task's value does not stop that wait, and the throwing
task group waits for all children to exit. The queued-deadline fixture holds
the previous inference open. Verification log: `/tmp/hudson-whisperkit-reference.log`.
Neither compilation nor runtime acceptance is yet claimed for this adapter.

Shared audio delivery was extracted into TranscriptionAudioDelivery and used by
Talkie's LiveAdapterCapture. The host suite passed 17 tests, covering ordered
chunks, caller-owned session finish, and cancellation that cannot report complete
audio. The app consumer rebuild and global capture hookup remain pending.

### September 16 — WhisperKit deadline fix and registration

Primary stopped the hung standalone test process and moved deadline ownership
from the inference task group to HudWhisperKitBatchOperation. Expiry now emits
one terminal failure and cancels work without waiting for a prior inference;
the serialized queue still prevents overlapping inference or late success.
The standalone package then passed all 14 WhisperKit fixture tests, including
queued expiry while the first inference remains held open. Evidence:
`/tmp/hudson-whisperkit-reference.log`. This supersedes the pending deadline
finding above, but not the Swift 6 diagnostic or actual-model acceptance gap.

Hudson's manifest now exports the reference adapter and its tests, with
WhisperKit from 0.18.0. Talkie's shared composition root registers it alongside
FluidAudio for both app and agent, preserving existing choices and defaults.
The integrated host rebuild/test was started against these registrations;
its result is pending in `/tmp/talkie-transcription-host.log`.


### September 16 — Strict-concurrency compatibility and integrated host check

The native WhisperKit session now rejects overlapping inference across actor
reentrancy. Its legacy SDK import uses @preconcurrency, narrowly acknowledging
WhisperKit 0.18's missing Sendable annotations; the instance remains private and
is not returned across the host boundary. The standalone Swift 6-mode build and
all 14 fixture tests pass with no compiler diagnostics in
`/tmp/hudson-whisperkit-reference-swift6.log`. This is compile/fixture evidence,
not proof of native model execution.

All 17 integrated host tests pass after registration, including an explicit
assertion that both app and agent registries contain whisperkit-reference.
Evidence: `/tmp/talkie-transcription-host.log`. The earlier Swift 6 compilation
failure is superseded by this compatibility change and verified run.

### 2026-09-16: Grok terminal state and capture handoff preparation

- Scout now reports WhisperKit implementation flight `flt-mu4b84hk-giop5b` failed because its local turn was interrupted; status follow-up `flt-mu4c4r13-s9g9sg` failed because the ACP adapter shut down. Existing artifacts were preserved and reviewed by the primary agent. No clean worker completion receipt exists.
- Full Talkie validation build completed successfully (`/tmp/talkie-transcription-validation.log`). This uses the isolated dependency setup, not the published Termini artifact; no installed app was replaced.
- Shared `TranscriptionAudioSink` supports externally persisted capture buffers without opening a second recording file. It still copies converted PCM synchronously and treats stream termination/overflow as incomplete audio.
- Actual latest host test output reports **18 passing tests** (`/tmp/talkie-transcription-host-tests.log`), including buffer reuse and overflow fixtures. Use this observed count instead of earlier conversational counts.
- `AudioCaptureService.onRecordedBuffer` invokes a synchronous consumer only after a successful recording-file write. Detaching serializes against in-flight callbacks. This is preparation for global dictation streaming; the controller has not yet connected it to a live session. No microphone or live provider acceptance is claimed.
- Agent build-for-testing started against the stable agent cache after these edits; result pending at this entry.

### 2026-09-16: Global dictation live adapter integration

- `AgentRecordingTranscription` binds the selected route at capture start, opens a live session only for a live-capable model, and drains a bounded `RecordedTranscriptionInput` fed by the recorder's successful-file-write callback. It does not open another microphone or recording file.
- `AgentController` consumes that run's live result after capture finalization, or uses its fixed binding for batch-only engines. Live setup/send/finish failures propagate into the existing failed-recording path; they do not trigger batch or legacy fallback. Result metadata retains the capture operation ID for ledger correlation. Explicit cancellation and every process exit cancel the live run.
- Shared sink rejects a mid-recording format change rather than silently converting with a stale format. Capture callbacks copy PCM before returning; detachment serializes against in-flight callbacks.
- Latest selected agent test run: **6 tests passed**, one parameterized test covering successful streaming and failed remote writes. Other new cases cover cancellation after submitted audio and preservation of the legacy finalized-file path. Log `/tmp/talkie-transcription-agent-tests-final.log`; result bundle `Test-TalkieAgent-2026.09.16_13-08-29--0400.xcresult` in the stable agent cache. Test host suppresses installed-agent startup and microphone ownership.
- Shared host suite: **18 tests passed**, log `/tmp/talkie-transcription-host-tests.log`.
- These results verify fixture-driven integration, not real microphone capture or vendor transcription quality/latency.
- Grok documentation reconciliation dispatched as fresh bounded flight `flt-mu4cv5np-qlpvdj`, session `session-mu4cv5gu-mizz9e`, using `docs/reports/transcription-doc-reconciliation-brief.md`. Only the two guides are assigned; no code ownership overlaps.

### 2026-09-16: Native Parakeet V3 acceptance

- Found installed FluidAudio V2/V3 model assets under the normal Application Support model cache. No model download or installed app change was performed.
- Added opt-in `NativeParakeetAcceptanceTests.swift` to Talkie's shared host package. Environment variables supply a model directory and generated non-private audio. The fixture says "The purple lantern is on the wooden table." Normal test runs skip this acceptance test unless the model directory is supplied.
- Real V3 model preparation, file transcription, and caller-fed streaming all passed. Both outputs contained the expected words `purple`, `lantern`, and `table`; both supplied 64-character source digests and correct operation identity. Observed test duration 42.550 seconds including cold model loading; this is not isolated latency or microphone acceptance.
- Command used `HUDSON_PACKAGE_PATH` for the isolated Hudson worktree, `HUDSON_PARAKEET_MODEL_DIR` pointing to the existing `parakeet-tdt-0.6b-v3` folder, and `HUDSON_TRANSCRIPTION_ACCEPTANCE_AUDIO=/tmp/parakeet-transcription-acceptance.aiff`, then `swift test --package-path apps/macos/TalkieTranscription --scratch-path ~/Library/Caches/codex-builds/talkie-transcription-host --filter nativeParakeetBatchAndLiveAcceptance` from the isolated Talkie worktree. Log `/tmp/talkie-native-parakeet-acceptance.log`.
- Removed the agent's custom-directory-only preparation restriction. An installed default-cache local model now prepares when readiness is unconfigured. Preparation remains adapter-owned; missing models do not download implicitly. Regression coverage adds a local adapter case without an explicit local-model directory; its agent test run is pending at this entry.

The default-cache preparation regression passed in the final agent run: six
tests passed, with three cases in the live-routing parameterized test (remote
success, remote write failure, and local preparation without a custom path).
Log: `/tmp/talkie-transcription-agent-tests-final.log`. This supersedes the
pending regression status above.


### 2026-09-16: FluidAudio cancellation, deadlines, and credential access

- Preparation now propagates owner cancellation into the model-load task and checks cancellation before publishing ready. Joining callers also check cancellation after awaiting the shared preparation. A pre-cancelled preparation fixture verifies that no model work starts; mid-load native cancellation is not claimed as separately measured.
- Batch operation deadlines now have an independent timer. Expiry cancels inference and publishes one incomplete-audio terminal event without waiting for inference to return. A fixture deliberately holds inference past cancellation, observes terminal stream completion, and only then releases inference.
- Current-source standalone Swift 6 harness passed all **6 FluidAudio tests**. Log `/tmp/hudson-fluidaudio-adapter-tests.log`. Harness source/test directories are symlinks to this worktree; an older copied-source harness result was excluded.
- Noninteractive credential probe checked environment and Talkie shared/legacy production/development Keychain services. Gemini/Google and MAI/Azure items were not found in those checked stores. Development ElevenLabs returned authentication failure (-25293); it was not readable, and must not be described as absent. No credential values were logged and no provider request occurred. The initial legacy Security lookup hung; only that task-owned probe process was terminated, then a process-local no-interaction probe completed.
- Grok documentation flight `flt-mu4cv5np-qlpvdj` still has acknowledgement-only broker state. Follow-up `flt-mu4dak16-7xojga` addresses the same session. Both assigned guide files still predate dispatch as of this check. No doc completion is claimed. CLI also reported a stale Scout runtime and refused to repoint the shared service; no ownership override was performed.
- Proposal header and implementation snapshot now distinguish implemented worktree code, remaining reusable UI/design targets, and unverified release/provider acceptance.


### 2026-09-16: Settings model-load and save consistency

- Model catalog loads now have generation identities. An earlier request cannot replace a later catalog or report a stale failure. Provider changes immediately clear prior model choices; Save stays disabled while models load and when the selected model is absent from the compatible catalog.
- Save captures configuration, key reference, key input, origin, and consent before awaiting workspace access or model preparation. The row is disabled while saving, and duplicate saves are rejected. Engines with no compatible models have an explicit explanatory status.
- Swift parser check passed. Full app validation is running in stable cache `talkie-transcription-validation`; log `/tmp/talkie-transcription-settings-validation.log`. It uses the existing isolated Termini dependency override and does not replace installed apps.
- Scout observed-event query for documentation session `session-mu4cv5gu-mizz9e` returned no events. Broker acknowledgement is not treated as proof of worker progress or completion.


### 2026-09-16: Current-source contract verification and acceptance audit

- New task-owned Swift 6 harness links directly to current HudsonTranscription, HudsonTranscriptionCloud and HudsonTranscriptionElevenLabs sources/tests. All **37 tests in 6 suites passed**, log `/tmp/hudson-transcription-current-contract-tests.log`. This provides current-source evidence rather than relying on older copied harness logs.
- Official Google transcription and 3.8 Live pages and Microsoft MAI-Transcribe-2 page rechecked. The dedicated Gemini 3.5 file/live identifiers and separate conversational 3.8 identity still match the implementation. No remote API request was made.
- Added `transcription-acceptance-audit.md` with requirement-level evidence and remaining checks. Overall completion remains unproven; live providers, native UI/microphone acceptance, real WhisperKit execution, guide reconciliation and published dependency acceptance are not inferred from fixtures.


Full app rebuild after settings consistency and FluidAudio deadline changes
completed with exit 0 and `BUILD SUCCEEDED` in
`/tmp/talkie-transcription-settings-validation.log`. Stable cache:
`~/Library/Caches/codex-builds/talkie-transcription-validation`. This supersedes
the pending build entries above. The build still uses the isolated Termini
header packaging fix. No launch, installation, or published dependency check
is claimed by this result.


### 2026-09-16: Public-contract extension walkthrough

- Added `docs/examples/transcription-reference-walkthrough.md`, outside the two guide files assigned to Grok. It follows the actual ElevenLabs public-import fixture and WhisperKit runtime/adapter implementation instead of inventing signatures or claiming network execution.
- Verified all local links resolve. ElevenLabs registration, readiness/candidate evaluation, submission, event ordering and normalization are backed by the current-source 37-test run. WhisperKit harness source/test symlinks were inspected and point to this worktree; its prior 14-test result remains fixture evidence, not model execution.
- Documented host consent/persistence responsibilities, batch versus live lifecycle, remote unknown outcomes, and static metadata catalog limitations. The two stale guides still require reconciliation; this supplement is not a claim that Grok completed them.


### September 16, 13:42 — native WhisperKit acceptance and tokenizer readiness

- Added readiness checks for both tokenizer.json and tokenizer_config.json as JSON objects. Missing or malformed files prevent native loading. Fingerprints include tokenizer contents, so changing them invalidates a prepared session.
- Added regression coverage for missing/malformed tokenizer configuration and content changes. Current-source Swift 6 harness passed 15 fixture tests; opt-in native test skipped in default run. Log: `/tmp/hudson-whisperkit-tokenizer-validation.log`.
- Added opt-in `nativeWhisperKitTranscribesAuthorizedFixture`, using `HUDSON_WHISPERKIT_MODEL_DIR` and `HUDSON_TRANSCRIPTION_ACCEPTANCE_AUDIO`. Uses the public adapter, actual native preparation and file inference, expected purple/lantern/table words, provider identity, and nonempty word timings.
- Native acceptance passed in 22.120 seconds with `sandbox-exec -p '(version 1)(allow default)(deny network*)' swift test --disable-sandbox --skip-build --package-path /Users/arach/Library/Caches/codex-builds/hudson-whisperkit-reference --filter nativeWhisperKitTranscribesAuthorizedFixture`. SwiftPM's nested manifest sandbox was disabled because nested sandbox application is rejected by macOS; the outer network-denying sandbox remained active. First nested-sandbox attempt did not run the test.
- Assets: task-owned `~/Library/Caches/codex-builds/transcription-models/whisperkit-tiny`; `acceptance-download-manifest.json` records pinned download revisions, per-file sizes and SHA256. Fixture: generated nonprivate `/tmp/parakeet-transcription-acceptance.aiff`. No microphone capture, remote audio submission, app installation, commit or publication.
- Native log: `/tmp/hudson-whisperkit-native-offline-acceptance.log`. This proves complete-model offline inference. It does not eliminate the SDK tokenizer loader's fallback attempt for semantically invalid JSON configurations. A strictly local tokenizer-loading path remains required before claiming fail-closed offline preparation for all invalid assets.


### September 16 — strict local WhisperKit tokenizer loading verified

- Replaced the native runtime's implicit SDK tokenizer loading with local JSON parsing, BPE vocabulary/merge validation, and direct `PreTrainedTokenizer` construction from the validated bytes. The runtime injects the tokenizer before loading CoreML models; no Hub tokenizer-loader call or download fallback remains.
- The invalid-content regression exposed swift-transformers' fatal trap for missing merge rules. Validation now rejects that configuration before entering the SDK. Missing tokenizer configuration also throws locally.
- Added an internal Whisper tokenizer bridge adapted from the MIT-licensed SDK wrapper, with license retained in source. Its upstream initializer is internal. Word splitting retains upstream language behavior and avoids cross-string indexing when handling replacement characters. The decoder multilingual flag is set from its actual vocabulary dimension; WhisperKit's private modelVariant load-log field cannot be updated through its public API. Adapter provenance still uses the configured model identity.
- Declared Tokenizers and Hub products from the already-transitive swift-transformers dependency; no new inference framework. Constraint matches WhisperKit's existing compatible 1.1.6 minor range.
- Default current-source Swift 6 run: 16 fixture tests passed, native acceptance skipped. Log `/tmp/hudson-whisperkit-local-tokenizer-tests.log`.
- Complete current-source network-denied run: all 17 tests passed, including actual tiny-model inference in 1.764 seconds with warm local caches, and invalid-tokenizer rejection. Log `/tmp/hudson-whisperkit-strict-offline-acceptance.log`. Timing is a single warm functional check, not a latency benchmark.
- This supersedes the tokenizer-fallback open item in the previous entry. Full Talkie validation build passed with this tokenizer change and the isolated Termini dependency: `/tmp/talkie-whisperkit-local-tokenizer-build.log`. No installed app was changed.


### September 16 — two-track meeting recovery regression

- Reviewed `MeetingIngestService.enrichUsingSelectedAdapter`: per-feed operation IDs include meeting/configuration identity; completed run results are reused; existing noncompleted runs stop the periodic path rather than resubmit.
- Added `meetingPartialFailurePreservesTrackResultsAndPreventsDuplicateUploads` in TalkieTranscription WorkspaceTests. One remote fixture track completes; a second returns an accepted vendor request ID and unknown remote outcome. A fresh workspace reload retains the completed result and both source/track identities, preserves the uncertain vendor request ID, and rejects resubmission of either operation. Adapter submission count remains exactly two.
- Current host test run passed: 20 reported tests, including the opt-in native Parakeet case skipped without environment configuration. Command: `HUDSON_PACKAGE_PATH=/Users/arach/dev/hudson-worktrees/transcription-adapters swift test --package-path apps/macos/TalkieTranscription --scratch-path /Users/arach/Library/Caches/codex-builds/talkie-transcription-host`. Log `/tmp/talkie-meeting-track-regression.log`.
- Scope: real workspace persistence and adapter lifecycle with fixture responses. This is not a cloud request, microphone test, or execution of the app's merger/repository enrichment path.


### September 16 — reject contradictory success payloads

- Added parameterized batch/live regressions for a completion event containing a result whose completion is cancelled, incompleteAudio, failed, or remoteOutcomeUnknown. All eight cases reproduced false successful persistence/delivery before the fix (`/tmp/talkie-result-completion-before.log`, 24 assertion issues).
- Both TranscriptionWorkspace completion boundaries now require the result itself to be completed before persisting or forwarding success. Contradictory remote receipts remain unknown in the durable ledger with no successful result; local contradictions are failed. Duplicate operation protection remains in place.
- Current host suite passed after the fix: 22 reported tests, with native Parakeet opt-in skipped, including both parameterized tests with four cases each. Log `/tmp/talkie-result-completion-after.log`.
- Full app validation build passed for this change using the isolated dependency setup; log `/tmp/talkie-result-completion-build.log`. No publication or installed-app change.


## Guide reconciliation after terminal Grok failure (2026-09-16)

Both Grok documentation flights are terminal failed: the main turn was
interrupted and its follow-up reports ACP adapter shutdown. Primary took over
both guide drafts without another active writer.

The developer guide now names the compiled protocol and registry methods and
links the executable public-contract example. It removes placeholder Swift APIs,
records strict local tokenizer preparation, and distinguishes Talkie settings
from undelivered shared SwiftUI setup components and resource arbitration.
The testing guide now records the 37-test contract/cloud/reference run, 6-test
FluidAudio run, 17-test offline WhisperKit run, 22-test host run, prior agent
checks, native Parakeet sample, and app-build limitation. Counts were checked
against saved logs. The original acceptance matrices remain requirements rather
than being relabeled as passes. Native UI, longer recordings, full meeting
merger/repository acceptance, and account-backed cloud checks remain open.

All relative file links in both guides resolve. Documentation-only changes did
not require another application build. No commit, push, publication, or installed
app replacement occurred.


## Long-meeting preflight regression (2026-09-16)

Added `geminiRejectsFortyFiveMinuteMeetingBeforeUpload` to the current cloud
adapter tests. A 2,700-second request for word timing and speaker labels is
rejected with `durationExceeded`; submission produces no HTTP or upload-ledger
events. The fixture has no actual audio file, so this verifies preflight ordering,
not transcription of a 45-minute recording. It also checks the 1,800-second
annotation boundary and preserves compatibility for a 45-minute plain-text
request. The existing MAI 2,700-second diarization rejection test remains passing.

Current-source core/cloud/ElevenLabs harness: 38 tests across 6 suites passed.
Log: `/tmp/hudson-long-meeting-preflight-tests.log`. No account credentials or
remote audio requests were used. Full meeting merger/repository acceptance remains
open. Source inspection also identified a recovery case to audit next: the
meeting operation ID includes configuration but not the separate `diarizeMic`
setting, so a cached mic result must not satisfy a newly requested annotation
capability without validation.


## Meeting cache request identity (2026-09-16)

Fixed the cache validation gap identified in the preceding review. Workspace
runs now persist optional `requestedFeatures` in both modes. The optional field
preserves decoding of older ledgers. `completedResult` checks selection, source,
track, use case, configuration, requested features, completion and provenance
before returning a cached result. MeetingIngestService uses that method rather
than inspecting completed run payloads directly. A mismatch or uncertain run
throws without creating a new operation ID or a second upload.

`cachedMeetingResultRequiresOriginalFeaturesAfterReload` verifies valid reuse,
changed speaker-label rejection, wrong-track rejection, and old-ledger decoding
with preserved results but rejected unproven reuse. The transport counter stays
at one. Full host suite: 23 reported tests passed; native opt-in skipped.
Log: `/tmp/talkie-meeting-cache-features-tests.log`.
The full meeting merger/repository and native UI acceptance remain separate.

Full Talkie validation build passed after the cache fix. Log:
`/tmp/talkie-meeting-cache-features-build.log`. This uses the isolated Termini
header packaging and does not prove the published dependency path. No app was
installed or launched.


## Production meeting mapping and merge (2026-09-16)

Extracted `MeetingAdapterEnrichment` from the adapter branch of
MeetingIngestService. Both Xcode projects compile the helper. The service uses
it for normalized word validation and the enriched object sent to its existing
repository. The helper rejects noncompleted results, missing timestamps on
nonempty text, nonfinite/negative/reversed word intervals. It preserves caller
feed identity and passes words to the existing MeetingMerger.

Corrected annotation revision ordering in this adapter path: calculate the next
revision against the previous assets before assigning new speaker turns. The
first enrichment is revision 1; the next update is revision 2.

Verification:
- Existing TalkieKit MeetingMerger suites: 11 tests in 2 suites passed.
  `/tmp/talkie-transcription-meeting-baseline.log`.
- Production helper plus real TalkieKit merger: 2 reported tests, including 5
  invalid-timing cases, passed. Checks separate feeds with identical vendor
  speaker IDs, title/notes/audio identity preservation, serialization round-trip,
  transcript/model/status/turns, and first/subsequent revisions.
  `/tmp/talkie-meeting-adapter-integration.log`.

The task-owned SwiftPM harness symlinks the actual app helper and the checked-in
`apps/macos/TalkieTranscription/IntegrationTests` directory. Run it with:

```sh
swift test --package-path "$HOME/Library/Caches/codex-builds/talkie-meeting-adapter-harness" \
  --scratch-path "$HOME/Library/Caches/codex-builds/talkie-transcription-meeting-integration"
```

This is actual mapping/merger and serialized-object evidence. It does not yet
exercise the app's database repository, sweep scheduler, or native meeting UI.

Full Talkie validation build passed with the production mapping helper linked.
Log: `/tmp/talkie-meeting-enrichment-build.log`. The isolated Termini dependency
limitation still applies. No installed app was replaced or launched.


## Atomic meeting publication (2026-09-16)

Repository review found that the adapter branch saved the pre-transcription
object snapshot. A title or note edit during transcription could be overwritten.
The new repository method `publishMeetingEnrichment` reads the latest row and
applies only enrichment fields inside one GRDB write transaction. The existing
MeetingSyncOutboxWriter runs in that transaction. Markdown mirroring uses the
committed result after the write succeeds. Missing, deleted, non-meeting, or
already-enriched rows are not recreated or overwritten. Changed audio filename
or duration rejects publication.

The production helper's database path is exercised against an in-memory GRDB
recordings table using the real TalkieObject persistence methods. Tests verify
concurrent title/notes preservation, saved transcript/revision, a publication
receipt, rollback when the injected outbox writer throws, duplicate publication
suppression, and no resurrection of a deleted row. The outbox failure is injected;
this harness does not start the real sync worker or scheduler.

The mapping/merger/database harness passed 4 reported tests, including the 5-case
timestamp test. Log: `/tmp/talkie-meeting-adapter-persistence.log`. This extends
the prior serialization-only result to the actual SQL write boundary. Native
UI, periodic sweep scheduling and account-backed provider acceptance remain open.

Full Talkie validation build passed after atomic repository publication was
wired into the adapter branch. Log:
`/tmp/talkie-meeting-atomic-publication-build.log`. The isolated Termini packaging
limitation still applies; no installed app was replaced or launched.

## Saved settings and activity inspection (2026-09-16)

Settings now preserve region and provider option fields, render text schema
fields, and validate required fields before saving or preparing an engine.
Consent is restored from the saved configuration fingerprint; edits require
consent for the changed configuration. The full app validation build passed:
`/tmp/talkie-transcription-settings-consent-build.log`.

The activity disclosure lists unfinished app and recording-agent requests with
source, track, provider/model and provider request ID. It explains unknown remote
outcomes and duplicate-upload risk. Refresh only reads state. It does not infer
agent liveness, apply startup recovery to another process, or retry uploads.
Unreadable ledgers produce an error, separately from an absent ledger.

Host tests passed with 24 reported tests (native opt-in skipped):
`/tmp/talkie-transcription-activity-tests.log`. The existing recovery regression
now also proves read-only inspection preserves an in-flight status and ledger
bytes. A new test covers missing and malformed agent ledgers without mutation.
Full app validation build passed: `/tmp/talkie-transcription-activity-build.log`.
The isolated Termini packaging limitation still applies. No installed app was
replaced or launched; native interaction and provider-side recovery acceptance
remain open.

## Main-app capture binding (2026-09-16)

Source review found that the main app checked dictation selection at start but
read it again after capture. The new host `TranscriptionCapture` binds the route
before recording, including an absent adapter selection. Selecting a cloud
provider during an existing-engine recording cannot reroute that recording.
Changing or clearing an adapter selection rejects the bound request. Unavailable
models are errors rather than permission to use another engine.

RecordingController now retains adapter audio under app support rather than
temporary storage, including cancellation, failure, and successful delivery.
Capture and submission share a stable source ID. Recorder preparation and start
must succeed before the listening state appears. Local adapters can prepare their
already configured files in the current process; this does not download models.
Cancellation checks prevent stale live results from clearing a newer capture.

The host suite passed 27 reported tests, native opt-in skipped:
`/tmp/talkie-transcription-capture-binding-tests.log`. Three new tests exercise
existing-engine routing after a later adapter selection, changed/cleared adapter
rejection before file access, and unavailable-model rejection. Full app validation
build passed: `/tmp/talkie-transcription-capture-binding-build.log`.
The isolated Termini packaging limitation still applies. Native microphone and
recording-controller interaction acceptance remain unverified. Retained files
still need a user-facing recording-library or recovery action; durable files
alone do not complete that workflow.

## Main-app dictation library connection (2026-09-16)

Adapter capture now uses the shared Audio directory expected by library playback.
The main app inserts a pending dictation row before microphone capture starts.
The same UUID links the row, audio filename and workspace source. Startup failure,
cancellation and transcription failure update the library status and retain any
captured file. Successful transcription publishes text to the latest row before
delivery. Updates preserve title/notes and existing user text, cannot overwrite a
completed transcription with a late failure, and do not restore deleted rows.
Library refresh uses the existing RecordingsViewModel path.

The production helper is included in both app projects and in the isolated GRDB
harness. Six mapping/database tests passed, including two new dictation tests:
`/tmp/talkie-adapter-dictation-persistence-tests.log`. The full app validation build
passed: `/tmp/talkie-adapter-dictation-library-build.log`. Existing isolated Termini
packaging limits remain. Native recording/playback/navigation was not exercised.
The library's pending-state heuristic and explicit retranscription controls still
need live-capture review; a stored row alone is not evidence that every recovery
interaction is correct. No installed app was replaced or launched.

## Active dictation retranscription guard (2026-09-16)

RecordingController now tracks active adapter recording IDs as observable state.
The library transcript section shows an in-progress explanation for those IDs,
even when the recording is older than the existing two-minute pending heuristic.
RecordingRetranscriptionService rejects the same IDs before file access for both
configured adapters and existing engine requests, so alternate UI surfaces cannot
start a second transcription of an active capture. Ownership is removed after
completion/status publication or cancellation cleanup, rather than when the
cancel button is first pressed. The guard is process-local; it makes no liveness
claim about a saved agent ledger or an earlier app process.

Full app validation build passed:
`/tmp/talkie-adapter-active-capture-guard-build.log`. Source review verified guard
placement before audio access and release paths for success, failure, startup
failure and cancellation. No new fixture count is claimed for this UI/controller
change. Native interaction acceptance remains required, including a capture over
two minutes and cancellation while a provider is still completing. No installed
app was replaced or launched.

## Native settings fixture and uncertain request identifiers (2026-09-16)

Added a separate TalkieTranscription/Acceptance executable that compiles the actual
production settings view with in-memory credentials and a fixture-only workspace.
Native accessibility interaction verified loaded upload consent, clearing consent
after a configuration edit, rejection of a missing required Project field, and a
successful save with region `fixture-west` and Project `verified-project`. The
activity disclosure displayed the uncertain-upload explanation and recording ID.
These checks did not use a microphone, a cloud service, Keychain, or Talkie data.

The activity check exposed a lost service request ID when submit/openLive throws
remoteOutcomeUnknown before returning an operation. Both workspace catch paths now
persist the error's request ID. Two regression tests verify durable IDs for batch
submission and live opening. Host suite: 29 reported tests passed, with opt-in
native inference not exercised in this run. Logs:
`/tmp/talkie-unknown-request-id-tests.log` and
`/tmp/talkie-unknown-request-id-app-build.log` (full validation build succeeded).
The validation project still uses the isolated Termini header correction.

The fixture rebuilt and relaunched successfully, but subsequent CUA accessibility
requests timed out, including after reconnecting. Process sampling showed the
main thread waiting in the AppKit event loop, not an observed application-code
deadlock: `/tmp/talkie-settings-acceptance-relaunch.sample.txt`. Saved values were
verified on disk before relaunch; rendered persistence after relaunch, the new
request ID in the native activity row, and refresh without ledger mutation remain
unverified. The earlier fixture ledger is preserved; the fix cannot recover an ID
that an older version already discarded. No installed Talkie app was replaced.

## Shared schema-driven setup controls (2026-09-16)

Added the `HudsonTranscriptionUI` product with a controlled
`HudTranscriptionConfigurationFields` SwiftUI component. It renders endpoint,
region, opaque credential reference, local model location, and custom text fields
from adapter descriptors. Model selection stays with the host's filtered picker.
Raw editing strings stay intact, so validation can explain malformed input.
The component performs no preparation, persistence, credential access or upload.

Talkie's real settings view now uses the shared component. The acceptance target
and the macOS host package link the new product; Hudson's foundation contract
does not depend on UI. The fixture executable compiled and linked successfully:
`/tmp/talkie-shared-settings-build.log`. Manifest inspection confirmed that the
new UI target depends only on HudsonTranscription. No behavior-mirroring tests
were added for this extraction. Native rendering after the extraction still
requires verification because the existing CUA reconnection issue remains.

The proposal and guide now document this implementation, while retaining the
outstanding complete provider picker, installation surface, and resource-owner
requirements. The proposal's stale WhisperKit snapshot was corrected to reflect
the previously verified 17-test offline run including native tiny inference.

## Inspectable model eligibility (2026-09-16)

Added Hudson's controlled `HudTranscriptionModelPicker`. It preserves unavailable
saved IDs, disables excluded models and lists their host-supplied reasons in a
disclosure. Talkie retains the full catalog rather than silently filtering out
models. Its `TranscriptionUseCase.modelExclusionReason` supplies eligibility to
both the picker and save guard: file support for recordings/meetings, batch or
live for dictation, and established word timing plus speakers for meetings.
Unknown timing/speaker metadata receives an explicit unestablished-capability
reason. Request-specific constraints still run before audio access/submission.

Three behavioral eligibility tests cover live-only routing, missing/unknown
meeting annotations, supported speaker variants, and models with no usable mode.
The host suite reported 32 passing tests (`/tmp/talkie-model-eligibility-tests.log`).
The real settings view compiled and linked in the fixture executable
(`/tmp/talkie-model-picker-fixture-build.log`) after refreshing SwiftPM's cached
dependency file list. The preceding shared-fields full app build succeeded
(`/tmp/talkie-shared-settings-app-build.log`). A new full app build for the model
picker is running in `/tmp/talkie-model-picker-app-build.log`; no pass is claimed
until that process completes. Native picker interaction remains unverified.

## Bounded idle model retention (2026-09-16)

The model-picker full app validation build completed successfully:
`/tmp/talkie-model-picker-app-build.log`.

Both local adapters retained every prepared configuration in a dictionary for the
process lifetime. FluidAudio and WhisperKit now keep only the latest prepared
configuration in their idle cache. Existing operations retain their captured
models/session handles, so changing the cache does not cancel submitted work or
unload a handle in use. Returning to an evicted configuration requires preparation.
WhisperKit preparation has a unique ownership ID so a joined older waiter cannot
publish over, or clear ownership of, a newer preparation.

The current WhisperKit suite passed 18 reported tests, including a new regression
that holds an inference open, prepares another folder, confirms the old cache entry
is gone, completes the original inference, and proves switching back reloads the
first model: `/tmp/hudson-local-cache-ownership-tests.log`. The host integration
suite also passed 32 tests (`/tmp/talkie-local-cache-integration-tests.log`),
compiling both changed local adapters. Native inference is opt-in and was not run
in these checks. This bounds per-adapter idle retention; it does not prove memory
usage, prevent overlap across adapters/processes, or replace the outstanding
host-level resource owner requirement.

## FluidAudio resource ownership (2026-09-16)

Added `HudTranscriptionLocalResources`, an SDK-independent owner of one prepared
model with exclusive batch/session leases. FluidAudio preparation and inference
now use this owner. An active native call prevents model eviction even after its
public operation reports cancellation. Live termination drops the stored inference
closure, releasing an idle lease while an in-flight task retains its own lease
until native inference returns.

Verification: 41 core/cloud/ElevenLabs tests passed in
`/tmp/hudson-local-resource-owner-tests.log`; 32 Talkie host tests passed in
`/tmp/talkie-fluidaudio-resource-owner-tests.log`; 8 FluidAudio fixture tests passed
in `/tmp/hudson-fluidaudio-resource-lease-tests.log`. The host initially linked an
outdated test object referring to the removed zero-argument initializer symbol;
recompiling the affected test resolved it without changing production behavior.
New FluidAudio tests verify both idle cancellation with a retained session and
cancellation during deliberately uncooperative inference. No native model or
microphone acceptance was repeated in these fixture checks.

WhisperKit and the Talkie composition root still require shared-owner wiring.
The developer guide explicitly distinguishes the implemented FluidAudio lifecycle
from that outstanding cross-adapter integration. Full app validation remains to
be repeated after that integration slice is complete.

## Shared local owner in Talkie (2026-09-16)

WhisperKit now accepts `HudTranscriptionLocalResources` and uses it for preparation
and native inference. Its old model cache and preparation publication task have
been removed. The existing inference queue remains; the actual native task holds
exclusive ownership until it returns, even if the public operation cancels first.
Resource keys include configuration/tokenizer content fingerprints, preserving
asset-change invalidation. Talkie's `TranscriptionHost.makeWorkspace` injects one
owner into both FluidAudio and WhisperKit. Legacy Vox and separate app/agent
processes remain outside this workspace-local ownership boundary.

19 WhisperKit tests passed in `/tmp/hudson-whisper-shared-owner-tests.log`, including
competing-engine lease refusal before any model load and idle eviction after lease
release. The previous cache-switch test now proves that an active inference blocks
another model's preparation, then allows the switch after completion. 32 host tests
passed in `/tmp/talkie-shared-local-owner-tests.log`.

Full app validation was started using the stable transcription validation cache;
its output is `/tmp/talkie-shared-local-owner-app-build.log`. At this entry the
build is running; it is not counted as passing evidence. No installed app was
replaced and no cloud or microphone acceptance was run in this slice.

## Shared owner native validation (2026-09-16)

The full app build completed successfully in
`/tmp/talkie-shared-local-owner-app-build.log`, using the existing isolated Termini
validation dependency. Updated WhisperKit native acceptance also passed against
the existing tiny assets and generated purple-lantern sentence in 21.23 seconds:
`/tmp/hudson-whisper-shared-owner-native.log`. It checks expected words, provider
provenance, and word annotations. This rerun did not use the earlier network-denying
sandbox; it is not a replacement for that earlier explicit offline check.
Parakeet V3 file/live native acceptance is now running separately in
`/tmp/talkie-parakeet-shared-owner-native.log`.

Parakeet's updated native file and caller-fed live acceptance completed
successfully in 50.768 seconds, including model preparation:
`/tmp/talkie-parakeet-shared-owner-native.log`. Both paths recognized the expected
purple/lantern/table words and preserved source digests and operation provenance.
This used the generated audio file and existing V3 model assets; no microphone,
private audio, cloud upload, or installed-app replacement was involved.

## Shared provider picker and model folder selection (2026-09-16)

Added `HudTranscriptionProviderPicker` to HudsonTranscriptionUI and connected the
real Talkie settings view to it. It preserves an explicit existing-engine route,
shows provider origin, and retains unavailable saved provider IDs as disabled
entries. Talkie still owns dependent-field resets, credential clearing, and
consent invalidation. No provider IDs or provider-specific branches were added
to the shared component.

Talkie's macOS setup now offers a native folder chooser for schema fields of kind
`localModelLocation`. Choosing an existing folder updates the draft and clears
consent; it does not prepare, download, or save anything. The existing Save engine
action validates and prepares the selected directory. The chooser stays in the
unsandboxed macOS host rather than asserting portable security-scoped access from
a shared path string.

The acceptance app compiled and linked the real settings view and the new shared
component successfully: `/tmp/talkie-provider-folder-picker-build.log` (12.50s).
This is build evidence, not rendered or interactive folder-picker acceptance.
No installed or running app bundle was replaced. Model download/install management
and native interaction checks remain outstanding.

## Explicit model installation service (2026-09-16)

Added `HudTranscriptionModelInstallation` with caller-supplied HTTPS manifests,
relative file paths, expected sizes and SHA-256 digests. It downloads into temporary
files, verifies regular-file content, stages a complete tree under the caller's
root, and publishes only by moving to a new destination. It does not replace
existing installations. Cancellation or failure removes only its own staging and
transferred temporary files. State reports file counts for downloading/verifying
and installed/cancelled/failed outcomes without fabricated percentages.

The current contract/cloud/ElevenLabs harness passed 46 tests across 6 suites:
`/tmp/hudson-model-installation-tests.log`. Five new test functions cover verified
publication and existing-directory preservation, same-size corrupt content,
unsafe paths (five cases), cancellation after transport, and a destination created
by another owner during download. This uses an injected temporary-file transport;
no model download was performed. The developer guide records the manifest trust
boundary and explicitly leaves provider-manifest discovery, install controls,
and uninstall coordination outstanding. Readiness/transcription do not invoke
installation implicitly.

## Adapter installation plans (2026-09-16)

Added optional `installationPlan(configuration:)` to the shared adapter protocol,
with a nil default preserving existing conformances. A Codable installation plan
carries provider/model identity, source revision, installation ID, source/license
links and verified file entries. The installer overload rejects plans belonging
to another selected provider/model before transport. Download size uses checked
arithmetic rather than wrapping invalid totals.

49 contract/cloud/reference tests passed across 6 suites in
`/tmp/hudson-installation-plan-tests.log`, including plan round-trip, size overflow,
and selection mismatch rejection. Native adapters do not yet return plans and the
settings action is not wired; the API does not imply downloadable model readiness.

Source discovery: the public FluidInference Parakeet V3 repository tree lists
multiple encoder variants, including Encoder_v2. The local FluidAudio dependency's
required filename remains Encoder.mlmodelc. Do not silently switch that filename
without validating the package/model pairing. A direct HTTPS request for repository
blob metadata from this machine failed with `No route to host`; no metadata or
model downloads were obtained. The browser-readable source is
https://huggingface.co/FluidInference/parakeet-tdt-0.6b-v3-coreml/tree/main .
The existing Hub dependency source distinguishes SHA-256 LFS ETags from Git blob
hashes. A manifest resolver must handle both accurately rather than treating a
Git SHA-1 as the installer's expected SHA-256 digest.

## Repository snapshot planning and Parakeet wiring (2026-09-16)

Added the optional `HudsonTranscriptionModelHub` product/target. Its snapshot
resolver obtains one repository commit, requires every adapter-selected exact
file or directory prefix, and emits only immutable revision URLs. LFS files use
repository size/SHA-256 metadata without fetching weights during planning. Small
Git blobs are fetched only when the declared size is at most 8 MiB; their Git
SHA-1 identity is checked before computing the installer's SHA-256 digest. This
is separate repository transport, not a provider branch in transcription core.

FluidAudio's installationPlan now supplies its actual required filename list and
V2/V3 repository choice to that resolver. The loader's encoder choice is preserved.
Readiness, prepare, and submit still never invoke network-backed planning.

52 contract/cloud/reference/model-source tests passed in
`/tmp/hudson-model-hub-tests.log`; 8 FluidAudio tests passed with the new module
linked in `/tmp/hudson-parakeet-plan-build.log`. Model-source fixtures verify
revision consistency, exclusion of unrelated encoder variants, missing required
file rejection, and Git identity validation. These fixtures do not establish
live Hub API compatibility. The earlier direct metadata request failed with no
route to host; live planning/download acceptance, WhisperKit planning, and settings
installation controls remain outstanding.

## Parakeet installation reuse correction

The preceding installer, installation-plan, and ModelHub additions were removed
as unused duplication. Talkie's existing EngineService already installs Parakeet
through FluidAudio, and the adapter resolves the same SDK default cache. Earlier
entries describing those additions are superseded. Transcription preparation and
inference remain in place; no installed model files were changed.
