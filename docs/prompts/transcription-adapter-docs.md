# Documentation assignment: transcription adapters

Work only in /Users/arach/dev/hudson-worktrees/transcription-adapters, based on origin/main. Read AGENTS.md and docs/proposals/transcription-adapters.md. The proposal is the architecture source of truth; do not redesign it.

Write exactly these two new files:
- docs/guides/transcription-adapters.md: developer guide explaining ownership, smallest adapter responsibilities, registration and capability filtering, credentials versus local preparation, lifecycle, normalized results, and separate remote ElevenLabs/local WhisperKit reference walkthroughs.
- docs/guides/transcription-adapter-testing.md: actionable test matrix covering dictation, files, meeting tracks, request option conflicts, cancellation, unknown remote submission outcomes, partial/final sequencing, provenance, and adding a provider without changing core or Talkie. Separate executable existing tests, proposed contract tests, and live provider acceptance.

Critical accuracy: this is a proposed API, not implemented. No invented runnable methods or claims of passing tests. Any code must be labeled illustrative pseudocode. MAI-Transcribe-2 is required. Gemini 3.5 dedicated file/live and Gemini 3.8 Live input transcription are distinct explicit targets. Preserve current Vox embedding and queued dictation; Vox daemon currently owns its mic capture. Keep docs concise and practical; the user wants adding an engine to be easy. Reuse source links from the proposal; no new provider research needed. Link the proposal relatively. Do not touch any other checkout, the proposal, package files, app code, or credentials. Do not commit or push. Return paths written and any ambiguities.
