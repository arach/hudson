# Documentation reconciliation brief

Scope: edit only `docs/guides/transcription-adapters.md` and
`docs/guides/transcription-adapter-testing.md` in this Hudson worktree.
Do not modify code, manifests, the proposal, progress report, or other worktrees.
Do not commit, push, publish, install, download models, or run provider calls.

Replace stale future-tense and pseudocode-only sections with a usable account of
current source. Read the actual public types and adapters under
`packages/native/apple/HudsonKit/Sources/HudsonTranscription*` and tests beside
these modules. Keep shared core independent of vendor SDKs and TalkieKit.
Show actual registration, configuration, model selection, readiness/preparation,
file submission, caller-fed PCM lifecycle, event consumption, cancellation,
terminal outcomes, normalized results/provenance, and extension instructions.
Use compiling-shape API names from source, not invented pseudocode names.
Describe remote ElevenLabs and local WhisperKit as reference implementations.
WhisperKit is batch only; Parakeet stays preferred. Model additions use catalog
metadata and compatibility rather than generic UI branches. Do not claim a
runtime-updated catalog if the source uses a static catalog.

Read host integration (read-only) from
`/Users/arach/dev/talkie-worktrees/transcription-adapters/apps/macos/TalkieTranscription`,
main app Services/Transcription, and TalkieAgent Services/SelectedTranscriptionService.swift.
Global AgentController now fixes its binding at capture start, receives PCM only
after recorder file writes, streams to live-capable models, and uses finalized
files for batch-only models. Live failure must not fall back to batch or legacy.
Do not claim real-device acceptance or installed app replacement.

Testing guide must distinguish fixture coverage, native SDK compilation,
app integration test/build coverage, and live model/vendor acceptance. The
progress report is chronological and includes superseded entries: read latest
entries and current logs rather than copying old counts. As of this request:
14 WhisperKit standalone fixtures passed, host suite reports 18 tests passed;
agent suite latest completed run reports 5 tests with one parameterized test
covering two cases, and an additional cancellation test is still running.
Main app validation build passed using an isolated Termini packaging fix;
canonical published Termini binary was not changed. Do not describe the
published dependency path as accepted.

Live MAI/Gemini/ElevenLabs network behavior and real-model WhisperKit quality,
latency remain unverified. No usable WhisperKit installation was found in the
normal Talkie model locations; do not generalize that to the entire machine.
MAI-Transcribe-2, dedicated Gemini 3.5 file/live, and conversational Gemini 3.8
Live input transcription are separate adapters/paths; don't blur them.

Deliver a concise completion report with changed files, source points verified,
and remaining factual uncertainties. Primary agent will review both guides.

Latest acceptance update: the progress report now includes a passing native
Parakeet V3 test for file and caller-fed live transcription using installed
assets and generated non-private speech. Read that entry; native quality and
latency coverage is limited to that one sentence. The latest agent run passed
six tests with three live-routing parameter cases. Global microphone acceptance
and remote vendor acceptance are still unverified.
