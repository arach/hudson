# Conversational voice implementation

Authorized September 16, 2026. Owner: coordinating Codex. Implementation: existing Fable worker. Architecture, documentation and review: existing Opus worker.

## Outcome

Deliver reusable Hudson two-way spoken assistant sessions for both web applications and native macOS/iOS applications. Include OpenAI GPT-Live (a distinct API from legacy Realtime), Gemini 3.8 Live, and Gemini 3.8 Live Extended Thinking integrations grounded in current official documentation. User audio enters the session; model audio plays; interruptions stop stale local playback and use provider cancellation only where the current protocol explicitly supports it; provider tool calls dispatch to host-supplied local tools and their results return into the conversation. Speech interruption must not automatically cancel independent backend work.

This is distinct from local transcription, diarized transcription, and live speech-to-text. Preserve all three existing capabilities and Parakeet's existing preparation path. Do not route conversational output through the transcription-only Gemini adapter.

## Ownership and boundaries

- Fable owns production code, web/native adapters, settings integration examples, and tests in this worktree. First acknowledge this full scope and outline file ownership. Read repository instructions before edits.
- Opus owns docs/guides/conversational-voice.md, docs/examples/conversational-voice/, an architecture review in docs/reports/conversational-voice-review.md, and documentation corrections discovered in the audit. Coordinate API names with Fable before final examples. No production-code edits unless explicitly coordinated.
- Coordinator owns review, verification, scope completion, and status to originating task.
- Fresh branch codex/conversational-voice starts at origin/main 547f549. Preserve prior Talkie and Hudson worktrees. No merge, publish, deploy, paid provider calls, or installed-app modifications authorized by this task.

## Requirements

1. Shared conceptual configuration/session/events/tool contracts with platform-appropriate implementations. Reuse suitable Hudson capture, playback, credentials and UI pieces; avoid forcing native/web transports into false equivalence.
2. Working streaming input/output, setup acknowledgement, explicit readiness, end/disconnect cleanup, provider errors, cancellation, bounded queues, stale event suppression and interruption/barge-in handling. Surface failure honestly.
3. Host tool declarations plus local asynchronous dispatcher; preserve call IDs, validate arguments, return success/error results, avoid duplicate execution, handle cancellation/late results. Host retains authorization over effects. Never execute provider-supplied arbitrary code.
4. Browser receives only short-lived provider credentials from a host backend or uses a host relay. No long-lived provider secret in browser config, bundle, persistence, logs or URL. Native credentials resolved through host-owned secure storage. Separate auth readiness from verified account access.
5. Models are host/provider-discovered with refresh and capability metadata; no guessed model identifiers or hand-maintained UI model allowlists. Preserve unknown saved choices honestly. Current official docs include GPT-Live at https://developers.openai.com/api/docs/guides/live and delegation at https://developers.openai.com/api/docs/guides/live-delegation; inspect these before assuming legacy Realtime is the requested product.
6. Clear docs and sample settings for local models, diarized transcription, and conversational voice; live STT is a distinct capability. Explicitly distinguish supported authored configuration from illustrative saved-state JSON. Provide actual validated configuration entry points if claiming declarative setup is supported. Do not invent a DSL without an implementation.
7. Native macOS and iOS build compatibility and web package exports. Usable sample host wiring for microphone, playback, local tool, credential brokerage and settings; not only wire codecs or an interface with no caller.
8. Meaningful fixture tests for lifecycle, streamed audio, interruptions, tool success/failure/duplicate/late results, disconnect and credential boundaries. Build/typecheck appropriate targets. Separate fixtures/build evidence from real-provider and device acceptance.

## Official source starting points

- https://developers.openai.com/api/docs/guides/live
- https://developers.openai.com/api/docs/guides/live-delegation
- https://developers.openai.com/api/docs/guides/realtime-conversations
- https://developers.openai.com/api/docs/guides/voice-webrtc
- https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
- https://ai.google.dev/gemini-api/docs/live-api/tools
- https://ai.google.dev/gemini-api/docs/live-api/thinking
- https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live-extended-thinking

Verify current transport, event and model contracts from official pages before implementing. New providers should be straightforward to add through the same contracts. No unrelated transcription refactor or Talkie shipment in this slice.
