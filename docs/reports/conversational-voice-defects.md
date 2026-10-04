# Conversational voice — code review defects

Reviewer: Opus worker (review only; no production edits).
Reviewed: `HudsonConversation`, `HudsonConversationOpenAI`,
`HudsonConversationGemini`, `HudsonConversationHost`, and the conversational
targets in `Package.swift`.

Revision 2, 2026-09-17 — **every finding re-verified against current source.**
Source moved substantially between revisions. Most of revision 1 is now closed,
and two of its findings were wrong rather than merely stale. Both are corrected
below rather than quietly dropped.

Method: source reading, plus building the three library modules in a throwaway
package and running all 7 documentation examples through real adapter
`readiness(configuration:)` with a fake credential resolver. No provider call,
paid or otherwise. No production file modified.

## Status at a glance

| ID | Finding | Status |
| --- | --- | --- |
| D1 | Manifest declared test targets with no directories | **Closed — fixed** |
| D2 | "Effect 2 has no API" | **Withdrawn — premise was false** |
| D3 | Ephemeral token in URL query | **Closed — fixed** |
| D4 | Event gate reported success after termination | **Closed — fixed** |
| D5 | Blocking declarations coerced on extended thinking | **Closed — fixed** |
| D6 | Readiness validates with empty tools | Open — by design, documented |
| D7 | "`options` is carried, fingerprinted, unread" | **Withdrawn — false** |
| D8 | GPT-Live discovery filters by ID prefix | Open — unverified assumption |
| D9 | Microphone capture concurrency diagnostics | **Closed — fixed; original wording overstated** |
| D10 | Client/route wire mismatch | **Closed — fixed and runtime-verified** |

## Corrections to revision 1

### D2 — withdrawn. The premise was false.

Revision 1 claimed that because GPT-Live interruption "must be requested
explicitly", the absence of a session method to request it was a gap
contradicting slice-1 scope.

That phrase came from a summary table, not from the provider documentation.
Re-checked against the GPT-Live guide: **there is no documented
client-initiated cancel, interrupt, or truncate event.** The only related
statement is that "Interrupting speech does not automatically cancel backend
work" — which says backend work is *not* auto-cancelled, not that a client
primitive exists to cancel it.

So `HudConversationSession` is not missing a method. There is nothing
documented for it to call, and inventing one would have been worse. The three
surfaces that do exist are the correct model:

- `interruptPlayback()` — local, effect 1, sends nothing to the provider.
- `.interrupted(generation:)` — the provider reporting its own interruption.
- Host-side cancellation of delegated work through the host's own state.

What remains true, and is a documentation obligation rather than a code defect:
a GPT-Live host must cancel delegated backend work itself. Stated precisely on
cost — the live session bills for its own duration regardless of interruption,
and backend/tool usage bills separately through whatever service the host
called. Two independent meters; barge-in stops neither. The guide says this.

### D7 — withdrawn. `options` is read.

Revision 1 said `options` was "read by no adapter", repeating the transcription
contract's unread-map trap. That was true when first read and is false now:

- `HudGPTLiveSession.swift:93` reads `configuration.options["delegation"]`
- `HudGPTLiveSession.swift:99` reads `configuration.options["delegationModel"]`

`options` is the provider-specific settings map, and GPT-Live uses it to carry
the Responses backend model. Declaring tools without `delegationModel` is
rejected — "Declared tools need a Responses backend model (delegationModel
option)" — rather than guessed. That is the opposite of the trap alleged.

The guide has been corrected to document `options` as read and provider-scoped.
Gemini reads no keys from it today.

## Closed findings

### D1 — closed. All four test directories exist.

`Package.swift` declares `HudsonConversationTests`,
`HudsonConversationOpenAITests`, `HudsonConversationGeminiTests`, and
`HudsonConversationHostTests`. All four now exist on disk, so the manifest
loads and the whole-package build is no longer blocked. The coordinator
independently reports **57 passing native fixtures**, a warning-free strict
compile for all four conversational targets on root and iOS, and **106 passing
web tests**.

Two notes on that evidence, not challenges to it: the count is fixture
evidence, not provider, account, device, or audio acceptance; and the figure is
the coordinator's own run, which this review did not reproduce.

The guide's validation recipe still symlinks the three modules into a throwaway
package. That is now a convenience — it keeps example checking independent of
the full dependency graph — not a workaround.

### D3 — closed. Ephemeral token moved to the header.

`HudGeminiConversationAdapter.swift:151` now sends
`Authorization: Token <credential>` instead of an `access_token` query
parameter, with a comment naming the reason. The ephemeral branch now gets the
same treatment the API-key branch always had, so no credential of either
lifetime rides the URL into connection logs.

### D4 — closed. `.terminated` is handled.

`HudConversationEventGate.yield` now has an explicit `case .terminated` that
returns `false` for anything other than `.assistantAudio`, so a control event
offered to a finished stream is reported as undelivered and the session fails
instead of dropping it silently.

### D5 — closed. Behaviors are serialized explicitly, never coerced.

`HudGeminiConversationSession` now emits
`declaration.behavior == .blocking ? "BLOCKING" : "NON_BLOCKING"` for every
declaration, with the comment "blocking on extended thinking was rejected
above, never rewritten." This also closes P1 from the
[native wire audit](conversational-voice-native-wire-audit.md): the base model
now gets an explicit `BLOCKING` rather than relying on the provider default.

### D9 — closed. Microphone capture concurrency diagnostics.

Compiling `HudsonConversationHost` surfaced two compiler diagnostics in
`HudConversationMicrophone.swift`: a captured `var` in concurrently-executing
code, and capture of a non-`Sendable` `AVAudioPCMBuffer` in a `@Sendable`
closure.

**Stated accurately:** these were *compiler diagnostics*, not a demonstrated
race. Nothing here observed concurrent callback execution or reproduced
incorrect audio — a previous revision of this report called one of them "an
actual race", which overstated the evidence. The diagnostics were worth
reporting because strict-concurrency warnings in an audio callback path are
where real races tend to live, not because a race was proven.

The coordinator has since fixed the microphone capture narrowly, and all four
native targets now compile warning-free for macOS and iOS.

## D10 — CLOSED. Client/route wire mismatch that type-checking could not catch

**Found by the coordinator; confirmed at source here; fixed by the coordinator;
verified end to end below.**

**Closing evidence.** The released example posts `{ sdp: request.offerSdp }`,
which is what `createGPTLiveSessionRoute` reads, and validates the response as
`{ sdp?: unknown }` before mapping a checked string to `answerSdp` — parsed,
not asserted. `sessionId` is accepted only when it is a string, so the route's
`null` is handled. `makeGPTLiveBackendRoute` builds the session server-side from
a host-chosen config and advertises `countWordsDeclaration` through
`buildGPTLiveDelegation`, so both ends declare the same tool without copying
field names.

Independently re-typechecked against the published `dist` types under `strict`:
clean. The coordinator's runtime harness
(`~/Library/Caches/codex-builds/hudson-conversation-typecheck/example-exchange.ts`)
now drives doc client → backend factory → mocked provider → answer → ready and
passes, including auth rejection and `count_words` advertised, with no network.
That harness is the check this defect called for: it exercises both sides of
the boundary, which a typecheck structurally cannot.

**Correction to a claim made while closing this defect.** A prior revision
suggested the tool might be declared twice over WebRTC — once server-side at
session creation, once in a client `session.start` frame. That was wrong.
`GPTLiveSession.start` sends `session.start` **only** when
`transport === 'ws'`; over WebRTC the data channel waits for `session.started`
and sends no session body, because the session was already configured during
the SDP exchange. So on the WebRTC path the declaration is advertised exactly
once, by the server route. There is no duplication and nothing to watch for at
live acceptance.

The error was mine: `sessionBody()` includes the delegation, and I concluded it
was always sent without reading the transport gate at the call site.

The original finding, kept because the lesson generalizes:

`docs/examples/conversational-voice/web-host-example.ts` posted an SDP exchange
body that `createGPTLiveSessionRoute` does not read, and expected a response
field it does not return:

| | Example sent/expected | Route actually reads/returns |
| --- | --- | --- |
| Request | `{ offerSdp, session }` | `request.body?.sdp` |
| Response | `{ answerSdp, sessionId }` | `{ sdp, sessionId }` |

Both ends would have failed at runtime: the route rejects with 400 "The request
body needs the browser offer sdp", and had it succeeded the client would read
`answerSdp` as `undefined`.

**Why the typecheck passed anyway, which is the part worth keeping.** `exchange`
is a caller-supplied callback. TypeScript verified my function matched the
*callback's declared signature* — `{ offerSdp, session } => { answerSdp, sessionId? }`
— and that is genuinely all it can do. What happens between those two points
is a JSON payload crossing a network boundary, and the route on the other side
is a separate function with no type relationship to it. Two independently
well-typed halves, disagreeing.

The `as` cast sealed it:

```ts
return (await response.json()) as { answerSdp: string; sessionId?: string };
```

`response.json()` is `unknown`; the assertion tells the compiler to believe a
shape nothing verified. An unchecked `as` at a network boundary converts a
runtime mismatch into compile-time silence.

Three things follow, and they generalize past this bug:

1. **A passing typecheck is evidence about one side of a boundary.** I reported
   "typechecks against published dist, zero errors" accurately, and that claim
   was still consistent with a broken example. Worth stating plainly rather
   than letting the green result imply more than it establishes.
2. **Parse, do not assert.** Validating `response.json()` and mapping the
   validated `sdp` to `answerSdp` would have surfaced this at the first call.
3. **A shared route factory beats a hand-written `fetch`.** The coordinator is
   adding a server-owned factory that also advertises `countWordsDeclaration`,
   which removes the hand-copied field names on both ends — the right fix, and
   better than correcting my string literals.

Also noted while confirming: the route takes `session` from its own server-held
options and ignores any client-supplied `session`. That is correct — a browser
must not dictate session configuration — so the field the example posted was
never going to be read even with the right name.

## Open findings

### D6 — readiness cannot see tool rules. By design; documented.

`HudGeminiConversationAdapter.readiness(...)` still calls
`validate(configuration, tools: [])`, so the blocking-tool rule cannot fire
there. A configuration can report `.ready` and still fail at `open(...)` once
real declarations arrive.

This is a reasonable split — readiness is about configuration, not about one
call's tools — but it means `.ready` is a weaker claim than it appears for
extended thinking. No code change requested; the guide carries the caveat.

### D8 — GPT-Live discovery filters by identifier prefix. Unverified.

`HudGPTLiveAdapter.swift:58` still filters `/v1/models` rows with
`id.hasPrefix("gpt-live")`. Two assumptions remain unverified without an
account: that GPT-Live models appear in that listing at all, and that every
current and future GPT-Live model carries the prefix.

The failure mode is correct — an empty result stays empty rather than falling
back to a guessed model — but a prefix filter is a soft allowlist, so "no
hand-maintained allowlist" is design intent rather than a verified property.
This belongs in the acceptance record, not in a code change now.

## Native wire audit reconciliation

All five findings in the
[native wire audit](conversational-voice-native-wire-audit.md) are now fixed in
source. That report has been updated with per-finding status; in summary:

| Finding | Status |
| --- | --- |
| P1 base blocking tools serialized as the opposite default | Fixed — both behaviors explicit |
| P2 GPT tools without delegation produce an invalid setup | Fixed — backend model required, double-declared tools rejected, authored tools no longer replaced |
| P3 Gemini discovery truncates at the first page | Fixed — follows `nextPageToken`, dedupes, guards token loops |
| P4 discovery invents capabilities for unfamiliar models | Fixed — unfamiliar bidi models get `.unknown` capabilities |
| P5 duplicate `response.created` destroys pending-call state | Fixed — round start is idempotent per response ID; terminal events correlate |

## What was checked and found correct

- The three-effect interruption model is honored: `interruptPlayback()` sends
  nothing to the provider and cancels no tools; the host flushes the speaker to
  the returned generation.
- Dispatcher guarantees hold: authorize-before-handler, at-most-once per call
  ID, arguments must parse as a JSON object, late results after cancellation
  reported as `.failure`, error text sanitized before crossing into provider
  context.
- Model rules are enforced at both adapter and session layers: thinking level
  rejected on the base model, scheduling rejected on extended thinking and on
  GPT-Live, `unknownToolCall` for unannounced results.
- Duplicate tool results cannot double-send: the pending call is removed before
  the first `await`, and validation precedes removal so an invalid result does
  not consume the call it failed to answer.
- Audio asymmetry handled correctly: capture rate on the configuration,
  playback rate per `HudConversationAudioChunk`, speaker builds format from the
  chunk.
- `HudConversationModelCatalog.entries(savedID:)` preserves a saved identifier
  discovery no longer returns, marked `available: false` / `discovered: false`,
  never substituted; a failed refresh keeps the previous catalog.

## Evidence

Three library modules built cleanly in a throwaway package against current
source. Remaining output is pre-existing "no 'async' operations occur within
'await' expression" warnings in the two session files.

All 7 documentation examples re-run through real adapter readiness against
current source:

| Example | Adapter | Result |
| --- | --- | --- |
| `gpt-live.json` | `openai-gpt-live` | ready |
| `gemini-live.json` | `gemini-live-conversation` | ready |
| `gemini-live-extended-thinking.json` | `gemini-live-conversation` | ready |
| `gemini-live-browser-ephemeral.json` | `gemini-live-conversation` | ready |
| `invalid-thinking-on-base-model.json` | `gemini-live-conversation` | rejected: "This model does not take a thinking level. Choose the extended-thinking model instead." |
| `invalid-sample-rate-gpt-live.json` | `openai-gpt-live` | rejected: "GPT-Live PCM sessions use 24000 or 16000 samples per second." |
| `invalid-browser-apikey-gpt-live.json` | `openai-gpt-live` | rejected: "GPT-Live sockets use a server-held API key. Browsers connect through a host backend instead." |

Fingerprints are unchanged from the previous run, since
`HudConversationConfiguration` did not change. Reproduction command is in the
[guide](../guides/conversational-voice.md#re-running-the-validation).

Web: `@hudsonkit/ai/conversation` now exists and passes 106 coordinator-run
tests, after playback-cleanup regressions were added.
[`web-host-example.ts`](../examples/conversational-voice/web-host-example.ts)
type-checks against the package's published `dist` types under `strict` — which
proves symbol and signature conformance, and, as D10 shows, does not prove the
example agrees with the server route it talks to.

Not established here: any live provider session, device behavior, or audio
quality, on either platform.
