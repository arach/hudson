# Add a transcription engine through the public contract

Status: source-linked walkthrough, checked September 16, 2026. The remote case
has a passing public-API fixture, but no real vendor acceptance yet. The local
case passed actual WhisperKit tiny inference with network access denied on
September 16, using a generated nonprivate recording.

The two examples are ordinary Swift packages/targets registered by the host.
They are not downloaded executable plugins. A vendor client is a remote adapter;
it does not require the user to run a proxy service. A local adapter can embed
an SDK independently of FluidAudio. Adding either kind does not change Parakeet
as the preferred local path or replace saved engine choices.

## Remote case: ElevenLabs

Read the complete executable example:
[`scribeReferenceUsesPublicContractAndNormalizesWords`](../../packages/native/apple/HudsonKit/Tests/HudsonTranscriptionElevenLabsTests/ElevenLabsAdapterTests.swift).
The test imports the three public modules normally, without `@testable`:
`HudsonTranscription`, `HudsonTranscriptionCloud`, and
`HudsonTranscriptionElevenLabs`.

The example injects two host dependencies:

- A `HudTranscriptionCredentialResolver` returns credential bytes for an opaque
  reference. Its fixture key is test data. Production code resolves the key
  from the host's secret store, never from serialized configuration.
- A `HudTranscriptionHTTPTransport` returns a sanitized response and records the
  request. The fixture never contacts ElevenLabs. The production adapter's
  default transport performs the actual request.

The tested sequence is:

1. Construct `HudElevenLabsTranscriptionAdapter(credentials:transport:)`.
2. Register it with `try await registry.register(adapter)`.
3. Construct `HudTranscriptionConfiguration` with the adapter's provider ID,
   model ID `scribe_v2`, and a credential reference.
4. Construct a file `HudTranscriptionRequest` with caller-owned operation/source
   identity, duration, and requested word timings/speaker labels.
5. Call `await registry.evaluate(request:configurations:)` and require `canRun`.
6. Submit using `try await adapter.submit(request, configuration: config)`.
7. Consume `operation.events` through its terminal event.

The test verifies an accepted provider request ID before completion, word and
speaker mapping, audio-relative timings, a configuration fingerprint, one HTTP
request, and an upload filename that does not expose the original filename.
A second test verifies that unsupported vocabulary hints never submit audio.

This is transport/normalization evidence. The four fixture bytes are not valid
speech audio and must not be used as a claimed transcription-quality result.

## Local case: WhisperKit

Read the implementation in
[`HudWhisperKitTranscriptionAdapter.swift`](../../packages/native/apple/HudsonKit/Sources/HudsonTranscriptionWhisperKit/HudWhisperKitTranscriptionAdapter.swift)
and the executable cases in
[`WhisperKitAdapterTests.swift`](../../packages/native/apple/HudsonKit/Tests/HudsonTranscriptionWhisperKitTests/WhisperKitAdapterTests.swift).

The provider ID is `whisperkit-reference`. The descriptor declares local origin,
a custom maintainer, a required local-model location, and adapter-metadata model
discovery. Ask `models(configuration:)` for IDs instead of deriving an ID from a
folder name. The fixture uses `openai_whisper-tiny`.

Readiness inspects the supplied model folder. Explicit `prepare(configuration:)`
loads existing assets through `HudWhisperKitRuntime`; the native runtime disables
model download. Readiness requires parseable tokenizer.json and
tokenizer_config.json and fingerprints both files. Native preparation validates
the BPE vocabulary and merge rules and constructs the tokenizer from those same
local bytes. It supplies that tokenizer directly to WhisperKit, bypassing the
SDK loader that can fall back to downloading. File submission does not install models. Native inference is
serialized, and each batch operation owns its cancellation and deadline state.
The public runtime seam permits fixture inference without shipping a fake model
or changing the shared contract.

This reference advertises batch transcription only. It rejects caller-fed live
input, speaker labels, rewriting, and unsupported hint combinations before
inference. Native segment and word annotations are normalized only when present.
Missing word annotations remain absent. Model deletion and changed configuration
are tested rather than treating an old preparation as permanently valid.

The fixture suite covers cancellation, expiry while queued behind inference,
missing assets, unknown model IDs, stale configurations, source digests, and
normalization. It does not establish actual-model accuracy, memory use, or speed.

## What a new adapter implements

Conform to [`HudTranscriptionAdapter`](../../packages/native/apple/HudsonKit/Sources/HudsonTranscription/HudTranscriptionAdapter.swift):

| Member | Responsibility |
| --- | --- |
| `descriptor` | Stable provider identity, maintainer, locality, platform and configuration schema |
| `models(configuration:)` | Model identities and implemented capabilities; preserve unknown saved selections in the host |
| `compatibility(request:configuration:)` | Validate the entire request before preparation or audio submission |
| `readiness(configuration:)` | Report credentials/assets/availability without diagnostic audio uploads |
| `prepare(configuration:)` | Explicit local preparation or provider setup; never fabricate download progress |
| `submit(_:configuration:)` | Return a batch operation when batch is advertised |
| `openLive(_:configuration:)` | Return a caller-fed session when live is advertised |

Default implementations of unsupported batch/live methods throw
`HudTranscriptionError.unsupportedMode`. Do not advertise a mode while relying
on that default. A new model usually belongs in its adapter catalog and
compatibility evaluator; shared core and generic settings should not branch on
its provider ID.

Batch events distinguish accepted provider identity, progress, completion,
failure, and cancellation outcomes. Preserve `remoteOutcomeUnknown` when the
vendor's result cannot be established. Do not turn it into success or retry the
request inside the adapter. The host retains the original recording and decides
whether an explicit retry is appropriate.

Live sessions accept ordered `HudTranscriptionPCMChunk` values through awaited
`send`, followed by `finish` or `cancel`. They never start a microphone. A finalized
utterance is not the session's terminal result. Reject late writes and preserve
one terminal outcome. See
[`GeminiLiveTests.swift`](../../packages/native/apple/HudsonKit/Tests/HudsonTranscriptionCloudTests/GeminiLiveTests.swift)
for public session use and separation of dedicated versus conversational input.

## Host responsibilities before a real request

The registry reports compatibility and readiness; it does not record consent or
persist a job. Before submitting audio, the host must bind the selection, check
upload consent, persist operation/source/track identity, and retain the source
audio. Talkie's `TranscriptionWorkspace` provides that boundary. A direct adapter
call in a fixture does not replace it in product code.

On completion, verify provider/model/configuration/run identity before saving
or inserting a transcript. On cancellation, stop feeding audio and observe the
terminal result. A remote connection closing does not prove remote cancellation.

## Verification

The September 16 current-source contract/cloud/ElevenLabs harness passed 38 tests
across six suites, including both remote reference cases. The separate
WhisperKit Swift 6 harness passed 16 fixture tests, with its opt-in native test
skipped in the default run. All 17 tests then passed together under a process
sandbox denying all network access, including invalid local tokenizer rejection: actual model preparation and
inference, expected words, local provider identity, and nonempty word timings.
This verifies the downloaded tiny model and the tested missing/incomplete
tokenizer failures; it is not a quality evaluation of all model variants. See the
[acceptance audit](../reports/transcription-acceptance-audit.md) for commands,
evidence limits, and pending live acceptance. This walkthrough supplies executable source references for the developer and
testing guides.
