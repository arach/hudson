# Conversational voice — architecture review

Date: 2026-09-16. Branch `codex/conversational-voice` at `547f549`.
Author: Opus worker (architecture, documentation, review).
Implementation owner: Fable worker. Coordinator owns verification and scope.

> **Historical document.** This is the pre-implementation research and design
> record, kept for the provider findings and the reasoning behind the contract
> shape. It is **superseded by the implemented
> [guide](../guides/conversational-voice.md)**, which describes the shipped API.
> Where the two differ, the guide is correct. The "open questions for Fable"
> below were answered during implementation and are **not current blockers** —
> they are preserved to show how the design was settled.

Status at time of writing: **pre-implementation**. This document records what the official provider
documentation actually says, the load-bearing asymmetries between the providers,
and the agreed contract shape. `docs/guides/conversational-voice.md` and
`docs/examples/conversational-voice/` are written against Fable's exported API
surface as it lands, not against guesses.

No production code, tests, builds, paid provider calls, merges, or deploys.

### Sample-validator correction — 2026-09-16

`docs/examples/conversational-voice/validate.swift` currently checks Codable
round-trips and handwritten fixture lint, **not adapter validation/readiness**.
Its known-model set is example-only, not a production allowlist. The
invalid-thinking example must ultimately exercise the actual adapter rejection
path with fake credentials instead of duplicating its rule. That wiring remains
pending; the script now labels its evidence accordingly.

`gpt-live.json` now selects 24 kHz PCM. The currently fetched
[WebSocket guide](https://developers.openai.com/api/docs/guides/voice-websockets#choose-the-audio-format)
lists 24 kHz as the default and also supports 16 kHz PCM. Thus 24 kHz is the
example choice, not a claim that the provider requires it exclusively. WebRTC
examples must omit a fixed PCM format.

### Revision 2 — 2026-09-16

Corrections from the coordinator's
[verification checklist](conversational-voice-verification.md), each
re-verified here against the official pages rather than accepted on trust:

1. **Responses delegation does support host custom-function authorization.**
   Revision 1 claimed it bypassed the host dispatcher. That was wrong; see
   [A2](#a2--tools-and-delegation-are-different-shapes). The former open
   question 4 was premised on the same error and is withdrawn.
2. **Gemini Extended Thinking is a distinct supported API**, not a flag on the
   base model, and revision 1 omitted it entirely. See
   [Gemini Extended Thinking](#gemini-extended-thinking--a-distinct-api).
3. **Naming settled**: Fable's `HudsonConversation*` and
   `@hudsonkit/ai/conversation` are adopted. My `HudConverse*` proposal is
   withdrawn.

## Scope boundary — three capabilities, not one

This slice is **two-way spoken assistant sessions**. It is not, and must not be
merged with:

| Capability | Where it lives | Stays |
| --- | --- | --- |
| Live speech-to-text | `HudsonTranscriptionCloud` (`gemini-live-transcription`) | Untouched |
| Local / diarized transcription | `HudsonTranscriptionFluidAudio`, `HudsonTranscriptionWhisperKit`, meeting pipeline | Untouched, including Parakeet's existing preparation path |
| Conversational voice | New module (this slice) | New |

There is a live trap here. The transcription contract already registers
`gemini-live-input` (`gemini-3.8-live`), whose adapter sends
`responseModalities: ["AUDIO"]` — see `HudGeminiLiveConnection.swift:60` — and
then **discards** the generated audio, reading only `inputAudioTranscription`.
That is a transcription adapter deliberately wasting a conversational session.
Conversational output must not be routed through it. Two different products are
talking to the same Google endpoint for different reasons; keep them apart.

## Verified provider facts

Checked against official pages on 2026-09-16. Quoted names are verbatim.

### OpenAI GPT-Live

GPT-Live is a **distinct product from the Realtime API**, not a rename of it.
The voice-agents comparison presents both as current; neither page states that
Realtime is deprecated. The distinction is architectural: GPT-Live is
"full-duplex conversations with a separate backend", where Realtime keeps
"speech, reasoning, and tool use in one session".

| Fact | Value |
| --- | --- |
| Model | `gpt-live-1` |
| Endpoint | `v1/live/sessions` |
| Transports | WebRTC (browser), WebSockets (server-side audio), server-side controls, SIP/telephony |
| Modalities | in: audio, text · out: audio, text · no image/video |
| Capabilities | `streaming`, `function_calling`; no `structured_outputs`, `fine_tuning`, `predicted_outputs` |
| Rate limit unit | concurrent sessions (25 at Tier 1 → 500 at Tier 5; free tier unsupported) |
| Price | $0.05 per minute, billed per second; backend model and tool use billed separately |
| Knowledge cutoff | Jul 31, 2025 |

Delegation has two modes, selected at session creation; **changing mode requires
a new session**:

- `delegation.type: "responses"` — GPT-Live calls a backend model you name in
  `delegation.responses.model`, supplies conversation context, and returns
  results to the conversation automatically.
- `delegation.type: "client"` — your application receives delegation events,
  does the work itself, and sends results back.

Names confirmed on the delegation page: `session.started`,
`session.delegation.created`, `delegation.id` (opaque, `item_` prefix),
`delegation_id` (result submission), `response_id`,
`session.commentary.append`, `session.thinking.append`,
`session.instructions.append`.

The browser handshake is an **SDP offer/answer exchange**, not a token handoff:
"Your server creates the session and exchanges the browser's connection offer
for an answer."

### Google Gemini Live

| Fact | Value |
| --- | --- |
| Audio | "always raw, little-endian, 16-bit PCM"; **input 16 kHz, output 24 kHz** |
| Interruption | `interrupted` on server content; "the ongoing generation is canceled and discarded" |
| Automatic VAD | `automaticActivityDetection` inside `realtimeInputConfig` — `disabled`, `startOfSpeechSensitivity`, `endOfSpeechSensitivity`, `silenceDurationMs`, `prefixPaddingMs` |
| Manual VAD | `activityStart`, `activityEnd`, `audioStreamEnd` |
| Tools | `function_declarations` / `google_search` in session `config`; calls arrive as `toolCall` with `function_calls[]` carrying `id` + `name` |
| Tool results | `functionResponses[]` with matching `id`, `name`, `response` |
| Async tools | `behavior: "NON_BLOCKING"` on the declaration; result carries `scheduling: "INTERRUPT" \| "WHEN_IDLE" \| "SILENT"` |
| Ephemeral tokens | POST `https://generativelanguage.googleapis.com/v1beta/auth_tokens` |
| Token fields | `uses` (default 1), `expireTime` (default 30 min), `newSessionExpireTime` (default 1 min), `liveConnectConstraints` |
| Token use | as `access_token` query parameter, or `Authorization: Token <value>` |
| Long sessions | session resumption required roughly every 10 minutes |
| Model | `gemini-3.8-live` (stable); 131,072 input / 65,536 output tokens |
| Thinking | **Not supported.** "Omit `thinking_level` (or `thinking_config`) from your session setup." |
| Tool behavior | Asynchronous is the default; `behavior: BLOCKING` is still allowed |

### Gemini Extended Thinking — a distinct API

Revision 1 omitted this entirely. It is not a flag on the base model; it is a
separate stable model with a different tool contract and a different lifecycle.

| Fact | Value |
| --- | --- |
| Model | `gemini-3.8-live-extended-thinking` (stable) |
| Thinking config | `thinkingConfig.thinkingLevel` = `low`, `medium`, or `high`. "MINIMAL is not supported" |
| Tool behavior | `behavior: NON_BLOCKING` **required**. "Synchronous blocking mode is not supported and returns a hard error" |
| Result scheduling | **Unsupported.** "Function scheduling configurations are not supported" — omit the field |
| Lifecycle field | `interactionStatus`: `IDLE` = "Ready for user input", `IN_PROGRESS` = "Reasoning or executing tools" |
| Limits | 131,072 input / 65,536 output tokens |

The consequence that actually changes the session model:

> clients must continue monitoring for messages after `turnComplete: true`,
> using `interaction_status` to determine whether the server remains
> `IN_PROGRESS` or has reached `IDLE`.

**A completed utterance must not clear background-work state.** Turn completion
and work completion are independent signals. A session model that treats
`turnComplete` as end-of-work will make extended thinking look like it hangs,
or will silently drop tool results that arrive afterwards. This is the single
most likely implementation bug in this slice, and it is invisible on the base
model, which is why it needs a fixture of its own.

This also means the three Gemini session shapes are not interchangeable:

| Shape | Thinking | Tool behavior | Scheduling |
| --- | --- | --- | --- |
| `gemini-3.8-live` | Omit entirely | `NON_BLOCKING` default, `BLOCKING` allowed | Supported |
| `gemini-3.8-live-extended-thinking` | `low`/`medium`/`high`, never `MINIMAL` | `NON_BLOCKING` only | **Omit** |
| `gemini-live-transcription` / `gemini-live-input` | n/a — transcription contract, not this slice | n/a | n/a |

Per the coordinator's checklist, incompatible authored configuration must be
**rejected explicitly**, not silently dropped: a `thinkingLevel` on the base
model, a `MINIMAL` level, a `BLOCKING` tool on extended thinking, or scheduling
on extended thinking should each surface as an error naming the field.

**One discrepancy I am not resolving silently.** The Live tools page spells the
scheduling values `INTERRUPT`, `WHEN_IDLE`, `SILENT`; the `gemini-3.8-live`
model page spells them `SILENT`, `WHEN_IDLE`, `INTERRUPTED`. Both are official
pages. The coordinator checklist resolves the implementation spelling to
`INTERRUPT`, following the tools guide and official `googleapis/go-genai` enum;
retain this discrepancy without claiming live verification. It matters only
on the base model, since extended thinking omits scheduling altogether.

## The four asymmetries that shape the contract

These are the places where a naively shared abstraction would encode a false
equivalence. Each one is a design decision, not a detail.

### A1 — Interruption is not one effect

> **Cancellation-premise correction (2026-09-17).** Revision 1 said GPT-Live
> "needs it requested" for effect 2. Re-checked: **neither provider documents a
> client-initiated cancel, interrupt, or truncate event.** GPT-Live says only
> that interrupting speech does not automatically cancel backend work; Gemini's
> interrupt is VAD-driven and reported after the fact. Effect 2 is therefore
> observed, not requested, and the shipped contract correctly offers no method
> to request it. Effect 3 remains real but is host work by construction.
> On cost: the live session bills for its own duration regardless of
> interruption, and backend/tool usage bills separately — two independent
> meters, not one that barge-in stops.

Gemini: an interrupt cancels and discards the in-flight generation. One event,
one meaning.

GPT-Live: **"Interrupting speech does not automatically cancel backend work."**
Barge-in stops the talking; the delegated backend keeps running and keeps
billing until the host cancels it explicitly.

So a single `interrupt()` is wrong. Barge-in decomposes into three separately
addressable effects:

1. **Stop playback** — always local, always immediate, every provider.
2. **Cancel the provider response** — Gemini does this implicitly on VAD
   interrupt; GPT-Live needs it requested.
3. **Cancel delegated backend work** — GPT-Live only, and only the host knows
   whether it is safe. Gemini has no equivalent.

The contract should expose all three, and a provider that cannot do one should
report that it cannot, rather than silently no-op. Effect 3 is also where money
leaks if it is modelled as optional.

### A2 — Tool calling and delegation are different shapes

Gemini is a function-call/response loop: `toolCall` → host runs → `functionResponses`
with a matching `id`. Well-formed request/response with correlation.

GPT-Live client delegation is not that. `session.delegation.created` hands the
application a **task**, the application chooses "its model or service,
instructions, tools, and how to route work", and streams context back through
`session.commentary.append` / `session.thinking.append` /
`session.instructions.append` before submitting a result against `delegation_id`.

Both satisfy requirement 3 (preserve call IDs, validate arguments, return
success/error, no duplicates, handle late results), so a shared **dispatcher**
is right. A shared **wire shape** is not. Recommendation: one host-facing tool
dispatcher contract; two provider-side bindings. Do not try to make
`session.commentary.append` look like a `functionResponse`.

**Correction to revision 1.** Revision 1 asserted that `delegation.type:
"responses"` bypasses the host dispatcher, leaving host authorization
enforceable only in `client` mode. That is wrong. Responses delegation surfaces
custom function calls to the host, and the documentation is explicit: "Your
application still executes its custom functions and enforces dependencies and
approvals."

The verified Responses-delegation chain is nested, which is presumably how the
error arose — the events are real but not top-level:

1. Events arrive inside a `response.event` envelope; dispatch on
   `envelope.event.type`.
2. "Read completed function calls from nested `response.output_item.done`
   events. The finished function item contains `call_id`, `name`, and
   `arguments`."
3. The host authorizes and executes, then appends the result as a Responses
   item via `response.item.create`.
4. The host sends `response.create` to resume backend processing.

So host authorization holds in **both** delegation modes, and the dispatcher
has three provider bindings to serve, not two: Gemini `toolCall`, GPT-Live
Responses-delegation nested function calls, and GPT-Live client delegation.

The first two carry real arguments and correlate by ID (`id` for Gemini,
`call_id` for GPT-Live Responses). Client delegation does not: "The delegation
object contains metadata, not task text... It does **not** contain the user's
utterance or task text." Its payload is `delegation.id` and
`delegation.target` only, so the host reconstructs intent from the transcript
and its own application state. A dispatcher contract that assumes
provider-supplied arguments fits two bindings out of three and breaks on the
third.

### A3 — Browser credential brokerage has two different shapes

Requirement 4 says the browser gets only short-lived credentials or uses a host
relay. Both providers satisfy it, differently:

- Gemini: backend mints an ephemeral token (`uses: 1`, short `expireTime`,
  optionally pinned with `liveConnectConstraints`) and hands it over.
- GPT-Live WebRTC: backend **creates the session** and exchanges the browser's
  SDP offer for an answer. There is no token for the browser to hold.

So the web contract is "broker a session", with token-minting and SDP-exchange
as two implementations. A contract shaped as `getToken()` fits Gemini and
mis-fits GPT-Live. The OpenAI delegation page contains **no** explicit
credential/token discussion — do not infer a token flow there that the
documentation does not describe.

### A4 — Audio formats are not symmetric

Gemini input is 16 kHz, output 24 kHz, both PCM16LE mono. A single
`PCMFormat` on the session that describes "the audio" will be wrong in one
direction. Capture format and playback format are separate values.

The existing transcription contract's `HudTranscriptionPCMFormat` is
input-shaped and should be referenced for style, not reused as-is.

## Reuse inventory

Existing Hudson pieces that genuinely fit, with what they already solve:

| Piece | Path | Why it fits |
| --- | --- | --- |
| ~~`HudSpeechPlayback`~~ | `HudsonVoice/HudSpeechPlayback.swift` | **Proposed, not adopted.** The generation-based staleness idea was taken; the type was not. `HudsonConversationHost` ships its own `HudConversationSpeaker` / `HudConversationMicrophone` behind injectable protocols. Nothing in the conversation modules references `HudsonVoice` |
| `HudAudioRecorder` | `HudsonUIAudio/HudAudioRecorder.swift` | Existing capture |
| `HudVault` | `HudsonUI/Vault/HudVault.swift` | Host-owned secure storage for native credentials (requirement 4) |
| `HudVoicePanel`, `HudsonVoiceSettingsView` | `HudsonVoice/` | Existing settings/UI idiom to extend rather than duplicate |
| Readiness/compatibility vocabulary | `HudsonTranscription` | Proven three-state shape (`supported`/`unsupported`/`unverified`, `unknown ≠ unlimited`). Copy the discipline; do not import the types |

**Name collision — act before writing code.** `HudsonLive` already exists
(`HudsonLive/HudLive.swift`, `HudLiveStatus`) as the shared vocabulary for
live/replayable/watched **views**. The new module must not claim `HudsonLive` or
the `HudLive*` prefix. See naming below.

## Proposed contract

Shared concepts, platform-appropriate implementations. Open for Fable to
counter-propose; names are the point of the coordination message.

### Naming — settled

**Native `HudsonConversation*`; web `@hudsonkit/ai/conversation`.** Fable owns
the production code and proposed these; they are adopted. My revision-1
`HudsonConverse` / `HudConverse*` proposal is withdrawn, and the docs use
Fable's names throughout. Documentation follows the implementation here, not
the other way round.

`HudsonConversation*` clears every collision the naming exercise existed to
catch:

| Prefix | Already taken by | Status |
| --- | --- | --- |
| `HudLive*` | `HudsonLive/HudLive.swift` — live/replayable **view** vocabulary | Avoided |
| `HudVoice*` | `HudsonVoice/HudVoiceTypes.swift` — dictation | Avoided |
| `HudSpeech*` | `HudsonVoice/HudSpeechPlayback.swift` — TTS playback | Avoided |
| `HudRealtime*` | Not taken in Hudson, but names OpenAI's *other current product* | Avoided |

Exact type and function names come from Fable's exported surface. The guide and
examples cite what is exported, and are checked against it before being called
done — the same discipline the transcription slice used, where all ten examples
were validated against the compiled type rather than written from prose.

### Event vocabulary

One stream, provider-neutral, with honest gaps:

- `sessionStarted` — setup acknowledged (requirement 2's explicit ack)
- `userSpeechStarted` / `userSpeechEnded` — from provider VAD or host signals
- `assistantAudio(chunk, generation)` — carries the generation so stale audio is
  droppable rather than playable
- `assistantTranscript(delta, final)` — text alongside audio when offered
- `toolCallRequested(HudConverseToolCall)`
- `delegationRequested(...)` — GPT-Live client mode; **not** emitted by Gemini
- `interrupted(effects:)` — which of the three A1 effects actually occurred
- `terminal(...)` — exactly one, matching the transcription contract's discipline

Provider-specific events stay named for what they are. A provider that cannot
emit one does not emit a fake.

### Cancellation and bounded queues

Reuse the transcription contract's proven rules, which were built for exactly
this class of ambiguity: monotonic sequences, bounded chunks, exactly one
terminal event, late writes rejected, and an explicit "outcome unknown" state
distinct from failure. GPT-Live's billing-per-second and its uncancelled backend
work make an `outcomeUnknown` equivalent **more** important here, not less.

### Model discovery (requirement 5)

Honest status: Gemini exposes a models list suitable for discovery with
capability metadata. The OpenAI `gpt-live-1` model page documents the model's
capability metadata but **does not describe a list endpoint on that page**. So
"no hand-maintained allowlist" is straightforwardly achievable for Gemini and
needs verification for OpenAI before anyone claims it. Until verified, treat a
single documented model ID as adapter metadata with its source cited — the same
`modelDiscovery: .adapterMetadata` honesty the transcription contract uses — and
do not invent a discovery endpoint.

### Configuration, and the line from the last audit (requirement 6)

Requirement 6 asks to distinguish supported authored configuration from
illustrative saved-state JSON. The transcription slice got this exactly right
and it should be copied: state the distinction in a table before the first
example, and do not invent a DSL without an implementation.

Two corrections carried forward from the transcription audit, because the same
mistakes are available here:

1. **Request features are not configuration.** In the transcription contract,
   diarization and word timing live on the *request*, chosen by the call site,
   while the saved configuration has no field for them — and the guide never
   said so. If conversational sessions have per-session options (voice, VAD
   sensitivity, delegation mode), document which axis each lives on **before**
   writing examples.
2. **An unread field is a trap.** Transcription's `options` dictionary is
   carried, fingerprinted, and read by nobody; writing to it silently revokes
   upload consent. Do not ship a free-form map the runtime ignores.

## Open questions for Fable

Resolved:

- ~~Naming~~ — settled on `HudsonConversation*` / `@hudsonkit/ai/conversation`.
- ~~Does Responses delegation bypass host authorization?~~ — it does not.
  Question withdrawn; it was premised on a revision-1 error.

Outstanding:

1. Does the tool dispatcher stay one host-facing contract with **three**
   provider bindings (A2), or separate dispatchers? The third binding —
   client delegation, which carries `delegation.id` and `delegation.target`
   but no arguments — is the one that strains a single signature.
2. Which A1 effects ship in slice 1? Is delegated-backend cancellation in
   scope, or deferred and documented as a billing caveat?
3. Is extended thinking a separate provider/session type, or a configuration on
   the Gemini one? Its tool contract differs enough (`NON_BLOCKING` required,
   scheduling forbidden, `interactionStatus` lifecycle) that a shared
   configuration must reject incompatible combinations explicitly.
4. Web export surface: one entry point or per-provider?
5. Verify the implementation sends the coordinator-selected `INTERRUPT` for
   base-model scheduling; Extended Thinking must omit scheduling.

## What is verified here, and what is not

Verified: the provider facts above, read from official pages on 2026-09-16, and
the Hudson reuse inventory, read from source in this worktree.

Not verified: any wire behavior. No provider call was made, paid or otherwise.
No build was run. Every capability claim above is documentation-derived, and
must be re-checked against a real session before anyone calls it acceptance —
the same evidence rule the transcription
[acceptance audit](transcription-acceptance-audit.md) applies.
