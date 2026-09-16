# Transcription baseline verification

Date: September 16, 2026
Base: `71fee5e03192dffe48056dedc0efacc94925bb62` (fresh origin/main worktree)
Scope: existing HudsonVoice tests; no proposed adapter implementation.

## Command

```sh
swift test --scratch-path "$HOME/Library/Caches/codex-builds/hudson-transcription-baseline" --filter HudsonVoiceTests
```

## Result

Exit status 0. Build completed; 27 tests in five suites passed:

- HudDictation capture start gate
- HudPendingUtteranceStore
- HudsonVoicePreferences
- HudSpeech
- HudSpeechPlayback

The checks cover duplicate starts and cancellation, durable queued audio and context, preferences, and existing speech credential/playback behavior. Dependencies were resolved from the current package graph during the run; this is a point-in-time baseline, not a claim about every future dependency revision.

## Limits

No MAI, Gemini, ElevenLabs, or WhisperKit adapter under the proposed contract exists in this change. No remote transcription request, microphone capture, accuracy benchmark, speaker-label evaluation, or native settings interaction was performed. Existing voice tests do not establish those outcomes.

Next: implement the smallest contract and one reference adapter, then run the proposed contract fixtures before live audio acceptance. See the [design](../proposals/transcription-adapters.md).
