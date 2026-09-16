# Implement the local WhisperKit reference adapter

Work only in /Users/arach/dev/hudson-worktrees/transcription-adapters.
Implement a working Swift local DIY example using the public HudsonTranscription
contract under packages/native/apple/HudsonKit/Sources/HudsonTranscriptionWhisperKit/
and tests under Tests/HudsonTranscriptionWhisperKitTests/ (same package parent).
You own those two directories only. Do not edit Package.swift, core, cloud,
FluidAudio, Talkie, or other docs. No commit/push or app/model downloads.

Read Sources/HudsonTranscription/ for exact current public APIs and the design in
docs/proposals/transcription-adapters.md. Actual dependency APIs can be inspected
read-only in /Users/arach/dev/talkie/apps/macos/TalkieEngineCore/.build/checkouts/WhisperKit/
(or locate actual case in .build/checkouts). Talkie EngineService's Whisper path
is another concrete source. Use installed version APIs, not guessed APIs.

Deliver a public actor adapter conforming HudTranscriptionAdapter, origin local,
maintainer custom/reference, providerID whisperkit-reference. File transcription
is required; report live unsupported rather than pretend to stream. Support
supplied localModel location, separate readiness/prepare, no automatic download
in submit or readiness. Preparation loads explicitly selected local models only.
Use WhisperKit(modelFolder:..., load:true, download:false) or verified equivalent.
Readiness must inspect model assets and loaded config; never say ready for missing
models. Model identity, path/config fingerprint, actual file source digest and
native segment/word timestamps preserved; missing annotations remain nil. Reject
speaker diarization/clean formatting/vocabulary features not implemented.

Serialize model preparation and inference safely across actor reentrancy. Batch
operation must report terminal exactly once, support cancellation without stale
success, never remove caller audio, and not expose paths/secrets in error text.
No mock-only production implementation or generic closure replacing WhisperKit.
An injectable small runtime protocol for fixture tests is fine alongside the real
WhisperKit implementation. Prefer explicit wrapper values across actor boundaries.

Create meaningful fixture tests for incompatible requests, missing local model,
cancellation, normalized results, and no stale success. You may compile with a
standalone temporary package using a dedicated stable scratch cache
~/Library/Caches/codex-builds/hudson-whisperkit-reference; do not use primary's
cloud or core caches. Do not edit cached dependency checkouts. Report files,
actual APIs/version used, test results, and remaining limitations candidly.
