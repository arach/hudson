# Settings file import — review

Reviewer: Opus worker (review and docs only; no production edits).
Reviewed: `HudsonConversationHost/HudConversationSettingsImport.swift` and
`packages/web/ai-backends/src/conversation/import.ts`, at working-tree state.

**Revision 2 — all five findings closed; re-verified in current source.**
Revision 1 found four ways the two sides disagreed under a "shared
byte-for-byte" claim. Every one is fixed, and three of the fixes are stronger
than what I proposed. Per-finding evidence below.

No provider call, paid or otherwise. No production file modified.

## Requirements check

| Requirement | Status |
| --- | --- |
| Portable strict versioned JSON | **Met** — validation, defaults, error classes and bounds now agree |
| No credential values | **Met** — no secret-bearing field, plus a secret-shape heuristic on every string field. Verified coverage below |
| Bounded input | **Met** — 64 KB cap before parsing on both sides; options capped at 32 entries; every string length-bounded |
| Reject unknown combinations | **Met** — validation is unskippable on both sides |
| Atomic stage, then explicit save | **Met** — `Staged` is unconstructable without validation; neither side writes |

Verified secret-heuristic coverage: `provider`, `model`, `instructions`,
`voice`, every `options` value, and `credentialReference` all pass through the
length-and-shape checker. `thinkingLevel` and `credentialKind` are
enum-validated, `inputSampleRate` is an integer. No string field escapes it.

## D11 — CLOSED. Validation is now unskippable.

`importDocument(_:)` is the single public entry point: it decodes, then runs
provider validation, and throws on either. `decode` is no longer public and
`Staged.init` is `internal`, so **nothing outside the module can produce a
`Staged` that skipped validation** — the type system enforces it rather than a
doc comment asking callers to remember. That is stronger than the fix I
proposed.

Original finding:

Web validates inside the parse:

```ts
const problems = validateConversationSettings(configuration);
if (problems.length > 0) throw invalid(problems.join(' '));
```

so an unsupported combination cannot parse. Native splits this into a second,
**optional** step — `validate(_:adapters:)` — that `decode` never calls and
nothing obliges a caller to run.

A host that calls only `decode` stages a configuration the web importer would
have rejected outright: a `thinkingLevel` on a base model, a sample rate no
provider accepts, an unknown provider. That is the "reject unknown
combinations" requirement not being met on one side, and it is also the
portability break — the same bytes import natively and fail on web.

Fix: call the provider validation from `decode`, or make the staged type
unconstructable without it (return an unvalidated token that only
`validate` can exchange for a `Staged`). A doc comment asking callers to
remember is not equivalent.

## D12 — CLOSED. Validation builds its own no-credential adapters.

`validate` no longer takes caller-supplied adapters. It constructs them itself
over `HudConversationNoCredentialResolver`, so the stated guarantee — provider
rules checked without touching host secrets — is now a property of the code
rather than a hope about the caller. No network call and no keychain read at
import.

Original finding:

`validate(_:adapters:)` documents that provider rules run "with a resolver that
returns no credential, so validation performs no network or provider call."
The signature takes adapters the *caller* constructed, so the resolver is
whatever the caller built them with. Pass the production adapters — the normal
thing to have on hand — and import-time validation calls
`readiness(configuration:)` against the host's real credential store.

`HudConversationNoCredentialResolver`, the type that would deliver the stated
guarantee, is declared in the same file but never used by `validate`, and it is
**internal, not public** — a host outside the module cannot construct it even
deliberately.

Nothing here reaches the network (readiness performs no I/O on either adapter),
so the practical exposure is a keychain read during import rather than a
provider call. The defect is that the comment states a property the API cannot
enforce, and ships the enforcement mechanism out of reach.

Fix: make the resolver public and have `validate` build its own adapters, or
drop the claim and document that the caller's resolver is used.

## D13 — CLOSED. Both sides classify a version mismatch as `unsupported`.

Native gained `HudConversationError.unsupported`, matching web's
`ConversationError('unsupported', …)`. A shared settings UX can now distinguish
"this file is from a newer version" from "this file is malformed" on either
platform.

Original finding:

Same document, two error classifications:

- Web: `ConversationError('unsupported', …)`
- Native: `HudConversationError.invalidConfiguration(…)`

A host building one settings UX over both platforms cannot branch on the code —
"this file is from a newer version, update the app" is a different message from
"this file is malformed", and only web can express it.

Fix: give native an `unsupported`-equivalent case, or have web use its
invalid-configuration code. Either way, pick one.

## D14 — CLOSED. Both sides bound strings in UTF-8 bytes.

Native uses `text.utf8.count`; web uses `TextEncoder().encode(value).byteLength`.
The same non-ASCII document now gets the same verdict on both platforms, and
the field bounds use the same unit as the document-level cap.

Original finding:

Native bounds with `text.count` (Swift `Character`, i.e. grapheme clusters).
Web bounds with `value.length` (UTF-16 code units). For ASCII these agree; for
emoji, combining marks, or most non-Latin scripts they diverge sharply — a
single emoji is 1 native, 2 web, and a flag sequence more.

A document with a long non-ASCII `instructions` field can sit under 8192 on one
platform and over it on the other. Same bytes, different verdict, which is
precisely what "byte-for-byte portable" is meant to exclude.

Fix: bound both by UTF-8 byte count, which is also what the document-level cap
already uses.

## D15 — CLOSED. The credential pair is all-or-nothing.

Rather than picking a default, both sides now require `credentialReference` and
`credentialKind` to appear together and reject either alone — so a document can
never leave the credential kind implicit, which is a better fix than the one I
suggested. Both shipped sample documents now carry `credentialKind`.

Original finding:

When `credentialKind` is absent:

- Web leaves `staged.credentialKind` `undefined` — the host decides.
- Native gets `.apiKey`, because `HudConversationConfiguration.init` defaults
  it and `decode` only assigns when the key is present.

So the same document stages as "unspecified" on web and "long-lived API key" on
native, with no diagnostic on either side.

This is not hypothetical: `sampleGeminiImportDocument`, shipped in `import.ts`
as a valid example, **omits `credentialKind`**. Imported natively it becomes an
`apiKey` configuration. For a Gemini browser path that is the wrong default —
the web connector refuses a browser-held API key with `credential-boundary` —
so the sample document quietly means different things on the two platforms.

Fix: make the field required, or have native represent absence explicitly
rather than inheriting the initializer default. Adding `credentialKind` to both
shipped samples would also stop the examples from demonstrating the divergence.

## What is right

- The schema genuinely has no secret-bearing field, and the defense-in-depth
  shape check (`sk-`, `AIza`, `ya29.`, `Bearer `, `-----BEGIN`) covers every
  string that reaches it, including `options` values.
- Unknown keys are rejected at both levels rather than ignored, which is the
  right default for a format meant to stay portable.
- Bounds are applied before parsing, and `options` is bounded in count, key
  length, and value length.
- Neither side writes anything: import stages, and the host's existing explicit
  save path remains the only way a configuration becomes active. The consent
  boundary is intact.
- Web's `importConversationSettingsFile` checks `file.size` before reading, so
  an oversize file is refused without being pulled into memory.

## Hardening added beyond the findings

Two changes neither revision asked for, both worth noting because they shrink
the format's attack surface:

- `options` in version 1 admits only `delegationModel`. Authored delegation
  JSON is explicitly not importable and must be configured in the app, which
  removes the one field that could have carried structured provider input
  through a file.
- The version-1 allowlist is stated in both implementations, so a future
  version can widen it deliberately rather than by omission.

## Documentation status — updated

The guide's "no supported import path" wording is **removed**. It now carries
an "Importing settings" section with the document schema, a worked example, the
enforced rules (secret-free, credential pair, unknown-key rejection, bounds,
`unsupported` versioning, validation at import), and the stage-then-explicit-save
boundary. A table distinguishes the authored settings document from the
saved-state encoding, which were easy to confuse once both existed.

## Evidence

Current source re-read for all five findings. `NativeHostExample.swift`
compiles clean against the current modules. No provider call from this review;
the GPT-Live WebSocket setup/close verification is the coordinator's, and no
full voice acceptance is claimed by anyone.
