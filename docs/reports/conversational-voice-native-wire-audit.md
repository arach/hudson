# Native provider wire audit — incremental findings

**Revision 2, 2026-09-17: all five findings below are FIXED in current source.**
Re-verified line by line; per-finding status is inline. Retained as a record of
what was found and where, not as an open work list. The startup/close
refinement is also addressed: both sessions now document a setup deadline
covering the initial send. Status reconciliation is summarized in the
[defects report](conversational-voice-defects.md).

Reviewed 2026-09-17 01:45 UTC (September 16 local). Owner: transcription-adapters.
Read alongside the coordinator-owned `conversational-voice-verification.md`.
No production edits, provider calls, or new test execution. Findings below are
source-derived; proposed fixture sequences are not claimed as executed tests.
Fable owns corrections; coordinator owns acceptance. Sources are changing during
review, so recheck before acting.

Paths below are relative to `packages/native/apple/HudsonKit/Sources/`.

## Findings (all fixed in current source)

Verified fixes: explicit `BLOCKING`/`NON_BLOCKING` serialization; delegation now
requires a backend model and rejects double-declared tools instead of replacing
them; discovery follows `nextPageToken` with dedup and loop guards; unfamiliar
bidi models get `.unknown` capabilities; round start is idempotent per response
ID with correlated terminal events.


1. **P1 — FIXED — Base Gemini blocking tools were serialized as the opposite default.**
   `HudsonConversationGemini/HudGeminiConversationSession.swift:79–83` omits
   behavior for `.blocking`. The [base model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live)
   says default is NON_BLOCKING and explicitly requires BLOCKING for synchronous
   execution. Emit the explicit value for both behaviors. Fixture: inspect setup
   for one base blocking and one non-blocking declaration; Extended Thinking
   continues rejecting blocking declarations.

2. **P1 — FIXED — GPT tools without explicit delegation produced an invalid setup.**
   `HudsonConversationOpenAI/HudGPTLiveSession.swift:106–128` synthesizes
   `type: responses` with an empty responses object, then adds tools but no
   backend model. The [delegation guide](https://developers.openai.com/api/docs/guides/live-delegation#configure-responses-delegation)
   requires that model at creation. Reject missing backend configuration before
   opening a socket, or require an explicit host-provided backend model; do not
   guess one. Malformed authored delegation JSON currently falls into the same
   fallback. Also, assignment at line 118 replaces existing authored tools
   despite the comment claiming a merge (for example, web_search disappears).
   Fixture: tools plus absent/invalid delegation must fail locally; configured
   backend tools must be preserved or rejected explicitly, not dropped.

3. **P2 — FIXED — Gemini discovery truncated at the first page.**
   `HudsonConversationGemini/HudGeminiConversationAdapter.swift:58–85` makes
   one pageSize=200 request and ignores nextPageToken. The [models API](https://ai.google.dev/api/models#method:-models.list)
   is paginated. A valid Live model on page two disappears from the picker.
   Follow tokens, deduplicate IDs, reject token loops, and avoid publishing a
   partial refresh if a later page fails. Fixture: first page has no bidi model
   plus a token; second page contains the model.

4. **P2 — FIXED — Discovery invented capabilities for unfamiliar Gemini models.**
   Same adapter, lines 75–84 and 129–142: bidi support implies tool support,
   while an ID suffix determines thinking support; every other model gets
   base-3.8 proactive/audio claims. Discovery does not establish these facts.
   Preserve discovered IDs, but use `.unknown` for capabilities without specific
   evidence; documented metadata for known variants is not a catalog allowlist.
   Fixture: an unfamiliar bidi model remains listed without supported/unsupported
   thinking assertions or base-3.8 notes.

5. **P2 — FIXED — Duplicate response.created destroyed GPT pending-call state.**
   `HudsonConversationOpenAI/HudGPTLiveSession.swift:47–52,283–285` always
   resets a round, even when its response ID equals currentResponseID. The ID is
   stored but never checked on terminal events either. Fixture: created R1,
   call C1, duplicate created R1, result C1 currently becomes unknownToolCall;
   a stale completion for R1 can also mark a later R2 boundary. Make repeated
   creation idempotent and correlate response-bearing terminal events. This is
   additional to the coordinator's already-listed per-round continuation issue.

## Startup/close refinement of existing checklist item

Both session `start()` methods send the initial frame **before** installing the
setup timeout (Gemini:87–95; GPT:87–95). A suspended initial send is therefore
unbounded. An initial send error escapes adapter `open()` without closing its
new socket (Gemini adapter:123–126; GPT adapter:83–86). Cancellation during the
continuation wait has no cancellation handler, and may return a ready session
after the caller cancelled. Both `finish()` methods launch unawaited socket
cleanup; close completion does not establish transport closure.

Use a cancellation-aware, whole-start deadline and awaited cleanup, including
initial-send failure. Fixtures should suspend send, throw from send, cancel
before acknowledgment, then deliver a late acknowledgment. This supplies concrete
provider-level failure paths to the existing lifecycle finding, not a separate
host-lifecycle claim.

## Rechecked, not reported again

Gemini invalid result validation now precedes pending-call removal
(`HudGeminiConversationSession.swift:132–143`); the earlier loss-of-call issue
was corrected during this review. Known-call ID sets now suppress repeated tool
announcements. Neither source change establishes provider or runtime acceptance.
