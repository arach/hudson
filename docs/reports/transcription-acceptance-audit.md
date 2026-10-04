# Transcription implementation acceptance audit

Date: 2026-09-16
Status: In progress. This is a requirements audit, not a release approval.

## Evidence rules

Source existence proves implementation shape, not successful execution. Fixture
results prove the scenarios asserted in those fixtures. Native model results do
not prove microphone ownership or remote wire compatibility. A build using the
isolated Termini package does not prove the published dependency path.

## Requirements and evidence

| Requirement | Current evidence | Remaining acceptance |
| --- | --- | --- |
| Isolated Hudson work based on origin/main | Current branch `codex/transcription-adapters`; merge base with origin/main `71fee5e03192dffe48056dedc0efacc94925bb62` | Preserve this worktree and unrelated changes through delivery. No publication authorized. |
| Small extensible contract and capability-aware registration | HudsonTranscription module; registry, compatibility, serialization, result and event tests | Final public API audit; guide now links compiled protocol and executable examples. |
| Results, provenance, readiness, batch/live, cancellation | Current-source contract/cloud/ElevenLabs harness: 41 tests in 6 suites passed; FluidAudio harness: 8 passed | No claim of exhaustive race coverage; real provider acceptance below remains separate. |
| Direct FluidAudio, Parakeet preferred | Native V3 file and caller-fed live test passed after shared-owner integration with installed models and generated sentence (50.768 seconds including preparation); latest cancellation/deadline fixtures pass | A 185-second generated file now passes native chunked transcription, ordered word timing, and end-of-file coverage (53.390 seconds including preparation). Real microphone stop/cancel/no-duplicate-insertion acceptance remains outstanding. |
| Local model ownership | Talkie injects one owner into FluidAudio and WhisperKit per workspace. Core and adapter fixtures verify busy refusal, idle eviction, changed-asset invalidation, and lease retention until cancelled inference returns | Separate app/agent processes and legacy Vox do not share this owner. Native simultaneous-engine and memory-pressure measurements remain unverified. |
| MAI-Transcribe-2 | Adapter/client fixtures compile and pass; Microsoft official MAI-Transcribe-2 page rechecked today | OpenRouter Swift adapter passed live short-file acceptance; direct Azure account acceptance remains untested. |
| Latest dedicated Gemini file and live | Google transcription guide rechecked today: gemini-3.5-transcribe and gemini-3.5-transcribe-live; file/transport/session fixtures pass | No readable configured credential discovered; real upload, cleanup, session drain, transcript and usage acceptance pending. |
| Separate Gemini 3.8 Live input evaluation | Separate conversationalInput adapter profile and fixture proving output is not treated as input; official 3.8 page rechecked today | Account-backed input transcription and completion behavior remain unverified. Do not substitute this for the dedicated path. |
| Remote DIY ElevenLabs | Separate reference module through public contract; normalization/options fixtures pass | Live Scribe v2 request passed using secret-cli ELEVENLABS_MEETINGS_API_KEY: generated 2.158-second sentence, eight timed words and speaker_0 labels, 1.165-second test duration. Multi-speaker quality and long meetings remain unverified. |
| Local non-FluidAudio DIY WhisperKit | Separate module; 19 current fixture tests passed after shared-owner integration. Updated native tiny-model test separately passed in 21.23 seconds, verifying expected words and word timings. Earlier 17-test run passed under a network-denying sandbox | Strictly local tokenizer construction bypasses SDK download fallback. Task-owned downloaded tiny assets only; no broad quality/model-variant claim. |
| Talkie dictation, recording and meeting integration | Shared workspace; app settings/recording/meeting source; global agent live integration; current host suite reports 32 tests passed (native opt-in skipped), including two-track partial failure/reload/no-duplicate-upload, read-only activity inspection, and fixed capture routing regressions; 6 agent tests previously passed | Latest full app validation build passed using isolated Termini packaging. Settings expose unfinished app/agent requests without retrying them. Native fixture interaction verified consent invalidation, required-field rejection, successful saving, and uncertain-outcome text. Earlier relaunch accessibility timed out; current fixture attachment and interaction now pass. Microphone and scheduler acceptance remain separate checks. Production mapping, merger and GRDB publication passed a separate harness, including preservation of concurrent edits and rollback on injected outbox failure. |
| Preserve Vox, durable audio, consent and track ownership | Existing paths retained; recorder callback only after file write; ledger, consent, source/track identities and fixed selection tests; batch/live contradictory completion payloads rejected in eight regression cases | End-to-end device evidence and final regression audit; do not infer preservation solely from compilation. |
| Easy model additions without provider branches in core/UI | Adapter catalogs and schema-driven settings; HudsonTranscriptionUI supplies controlled configuration fields and provider and model pickers used by Talkie; ineligible models are disabled and their reasons remain inspectable; host tests verify batch/live/timing/speaker eligibility | Catalogs are static adapter metadata, not automatically refreshed discovery. Public-contract ElevenLabs walkthrough now links to the passing executable fixture; WhisperKit walkthrough links to SDK/runtime fixtures. Developer and testing guides now distinguish static catalogs, implemented APIs, and remaining acceptance. |
| Grok scoped work with primary verification | WhisperKit artifacts primary-reviewed. Broker inspection confirmed both documentation flights terminal failed: `flt-mu4cv5np-qlpvdj` reports "Local agent turn was interrupted."; `flt-mu4dak16-7xojga` reports "ACP adapter shut down." | No completed revision was delivered by that run. Primary reconciled both guide drafts against current source and recorded results. |
| Design and developer/testing docs agree with implementation | Proposal has current implementation snapshot and evidence limits; chronological progress report updated | Both guides reconciled against source and saved test logs; all relative file links resolve. Proposal installation requirements now explicitly reuse existing SDK-backed model management; no new installer or installation-plan API remains. |

## Current-source test command

The task-owned harness at
`~/Library/Caches/codex-builds/hudson-transcription-contract-harness` uses direct
symlinks to this worktree's three source modules and their test directories.
It intentionally excludes native SDK modules, which have separate checks.

```sh
swift test --package-path "$HOME/Library/Caches/codex-builds/hudson-transcription-contract-harness" \
  --scratch-path "$HOME/Library/Caches/codex-builds/hudson-transcription-contract-check"
```

Observed result: 41 tests across 6 suites passed. Saved output:
`/tmp/hudson-installation-reuse-core.log`.

## Next delivery checks

1. Full app rebuild passed; retain its dependency-scope limitation in delivery evidence.
2. Guide reconciliation completed by primary after both Grok flights failed. Retain the remaining acceptance requirements; do not treat fixture coverage as product acceptance.
3. Source-linked extension walkthrough added at `../examples/transcription-reference-walkthrough.md`; public-API remote example is covered by the passing current-source suite.
4. Review native settings and real microphone behavior without replacing installed apps.
5. Exercise longer recording and multi-track meeting fixtures where assets and credentials allow; document external blockers precisely.
6. Reconcile the final design and evidence record before claiming goal completion.

## Official model sources checked today

- [Google audio transcription](https://ai.google.dev/gemini-api/docs/transcribe)
- [Gemini 3.8 Live](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live)
- [Microsoft MAI-Transcribe-2](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/mai-transcribe)

These pages establish documented model identity and capabilities, not live
account access or successful provider requests.

## Installation reuse regression check

After removing the unused installer, installation-plan API, and ModelHub module,
current-source suites passed: core/cloud/ElevenLabs 41 tests, FluidAudio 8 tests,
and Talkie host 32 tests. Logs: `/tmp/hudson-installation-reuse-core.log`,
`/tmp/hudson-installation-reuse-fluid.log`, and
`/tmp/talkie-installation-reuse-host.log`. The host run leaves native opt-in
acceptance disabled. Existing installed models and apps were unchanged.

The complete Talkie validation app also rebuilt successfully after this cleanup
(`/tmp/talkie-installation-reuse-app.log`). This uses the existing isolated
Termini dependency fix and does not establish published-dependency acceptance.
Source inspection confirms the existing Parakeet download/cancel controls remain
on the same Transcription Models page below the adapter settings, routed through
EngineClient to EngineService. No app launch or installation was performed.

## Current native settings fixture acceptance

Rebuilt and launched only the separate acceptance bundle using fresh fixture
state at `talkie-transcription-settings-acceptance/installation-reuse-fixture`
under the user build cache. Build log: `/tmp/talkie-installation-reuse-settings.log`.
Native accessibility interaction verified:

- Saved fixture Dictation fields and consent are loaded.
- Changing region from fixture-east to fixture-west clears consent. Save displays
  “Confirm audio upload before saving this remote engine.”
- Confirming fixture consent and saving displays “Engine saved and ready.”
- Activity displays both `Recording: fixture-recording` and
  `Service request: fixture-request`, with the duplicate-upload explanation.
- The shared Meeting provider picker opens, changes to the fixture provider,
  and returns to the existing-engine choice. No Meeting selection was saved.

The previously running older fixture also retained its saved fields and consent
after its earlier relaunch. The observation timeout no longer blocks this fixture.
This fixture contains no local adapter, so it does not verify the folder chooser
or Parakeet installation controls. It uses no real keys, uploads, microphone,
or installed Talkie app. Full product capture acceptance remains outstanding.

Long-file evidence: current host `nativeParakeetLongFileAcceptance` passed against
installed Parakeet V3, with 185 seconds of generated speech. Saved output:
`/tmp/talkie-parakeet-long-file.log`. No microphone, remote service, or app
installation was used. See the testing guide for assertions and limitations.

## Cloud acceptance prerequisite recheck

Rechecked the normal Gemini/Google, MAI/Azure and ElevenLabs environment variable
names: none configured in this process. A noninteractive Security-framework
probe of the shared, shared-dev, app and app-dev Talkie keychain services found
no readable matching credentials. Gemini/Google and MAI/Azure lookups returned
-25300; shared-dev ElevenLabs returned -25293, an authentication failure, not
evidence that its key is absent. No secret bytes were printed and no prompt was
accepted. Log: `/tmp/talkie-transcription-credential-recheck.log`.

The MAI client was compared again with Microsoft's current MAI-Transcribe page:
model MAI-Transcribe-2, API version 2025-10-15, enhancedMode and nested modelOptions,
phraseList, locales and Speech subscription-key header match the documented
request. This is source-contract evidence only. Live account acceptance awaits
a usable credential resolver and MAI Speech endpoint. The user has been asked
for the configuration location, not secret values.

## Package handoff audit

`swift package dump-package` succeeded for the current Hudson worktree. The core
transcription target has no target dependencies. Transcription UI and Cloud each
depend only on that core; FluidAudio and WhisperKit dependencies are confined to
their adapter targets. ElevenLabs uses core and shared Cloud transport. All six
products are registered. These are separately linked products, not separately
resolved Swift packages: the root package still declares the SDK dependencies.
The origin/main merge base remains `71fee5e03192dffe48056dedc0efacc94925bb62`.

Full Talkie validation still depends on the isolated Termini header packaging
correction. The Termini changes normalize static XCFramework headers under the
GhosttyKit namespace during local installation and release packaging. They are
uncommitted, including `scripts/namespace-ghosttykit-headers.sh`; the published
Termini artifact has not been changed. Delivery must carry that fix and produce
and verify the appropriate artifact before claiming normal published-dependency
build acceptance. No commit, artifact publication, or installed-app replacement
is authorized by these verification results.

## Secret CLI discovery and live ElevenLabs acceptance

The user identified `secret list` as the correct store. It contains general,
meetings and TTS ElevenLabs entries, but no Gemini-named entry in the current
list. Previous credential checks did not cover this separate secret-cli store.
At this earlier checkpoint, MAI live testing was deferred. Subsequent OpenRouter authorization and acceptance supersede that deferral.

`secret run ELEVENLABS_MEETINGS_API_KEY -- ...` injected the key into the opt-in
`elevenLabsLiveFileAcceptance` test process without printing or storing its value.
One Scribe v2 request through the public reference adapter passed in 1.165 seconds.
The generated sentence returned “The purple lantern is on the wooden table”,
eight word timing entries, and speaker_0 labels. Source digest:
`06cfc5264eeaed7baeca828e2297fa722a45dac0b3eccd6cbbadc561a45a75d7`.
The normalized result has no provider request ID or usage values; do not infer
those from the client run ID. This is short single-speaker acceptance, not a
multi-speaker quality benchmark. Log: `/tmp/elevenlabs-transcription-live-acceptance.log`;
result: `/tmp/elevenlabs-transcription-acceptance-result.json`.

## MAI 2 via OpenRouter live wire acceptance

The user subsequently authorized MAI testing through OpenRouter. One direct
request to `/api/v1/audio/transcriptions` with the secret-cli OPENROUTER_API_KEY
returned HTTP 200 in 1.449 seconds for the same generated 2.16-second sentence
used with ElevenLabs. Model: microsoft/mai-transcribe-2. Transcript: “The purple
lantern is on the wooden table.” The response contained eight timed words, one
segment, speaker 0 labels, language en, duration 2.16, and usage of 3 seconds
at cost 0.00008333333333333333. Generation ID:
`gen-stt-1789588875-CPMsLUsRysv08ZU8jZSf`.

Saved response: `/tmp/openrouter-mai-acceptance-result.json`. This supersedes the
MAI-testing deferral for this OpenRouter request. It proves account access and
the documented wire format, not Hudson adapter integration: the request was
made by a direct acceptance script, and the OpenRouter Swift adapter remains
to be implemented. No direct Azure endpoint was exercised.

## MAI via OpenRouter: Swift adapter acceptance complete

On 2026-09-16, `openRouterMAILiveFileAcceptance` passed in 5.956 seconds
through `HudMAITranscriptionAdapter(route: .openRouter)`, using the secret-cli
`OPENROUTER_API_KEY` and a generated 2.158-second WAV. This supersedes the
earlier direct-script-only status. Talkie registers the route alongside Azure.

The normalized result contains the expected sentence, eight timed words, one
speaker label, language `en`, the source SHA-256, operation ID, and service ID
`gen-stt-1789589179-jWfVPSn8Os163z1cLjrT`. Reported usage is three billed audio
seconds and USD 0.0000833333. This is short-file acceptance, not long-meeting,
multi-speaker accuracy, or live-streaming acceptance.

Evidence: `/tmp/hudson-openrouter-mai-live.log` and
`/tmp/hudson-openrouter-mai-live-result.json`.

Final OpenRouter integration checks: the shared/core/cloud/ElevenLabs harness
passed 45 tests (live tests remain opt-in), Talkie host passed 33 tests, and the
isolated Talkie validation application build succeeded. Both worktrees passed
`git diff --check`. Logs: `/tmp/hudson-openrouter-final-tests.log`,
`/tmp/talkie-openrouter-host.log`, and `/tmp/talkie-openrouter-app.log`.

Delivery remains in isolated worktrees, with the Termini binary-header packaging
fix required by this validation build. Nothing was committed, pushed, published,
or installed over Talkie. Gemini account acceptance remains unavailable because
the checked secret-cli catalog contains no identified Gemini credential.
Full-product microphone/device acceptance and long multi-speaker cloud meetings
remain unverified; the completed fixtures and generated-audio runs do not prove
those outcomes.

## Hudson merge validation, 16 September 2026

The user authorized commit, PR, and merge after the earlier verification-only
checkpoints above. The adapter branch was fast-forwarded onto `origin/main`
`4a60eb2`. The root package compiled all six new products against published Vox
`9190158`, without a local Vox override or a Vox source change. The default
terminal-disabled package passed 72 transcription tests and 27 existing
HudsonVoice tests. The experimental dependency boundary check also passed.

Commands (from the Hudson root):

```sh
swift test --scratch-path "$HOME/Library/Caches/codex-builds/hudson-transcription-merge" --filter HudsonTranscription
swift test --skip-build --scratch-path "$HOME/Library/Caches/codex-builds/hudson-transcription-merge" --filter HudsonVoiceTests
python3 scripts/apple/check-experimental-boundary.py
```

Logs: `/tmp/hudson-transcription-merge-tests.log` and
`/tmp/hudson-transcription-voice-regression.log`. The first attempt ran out of
disk while generating test debug symbols. Removing the task-owned, inactive
baseline object cache allowed the same build and tests to finish successfully.
Opt-in native/provider acceptance tests remain gated; these fixture totals do
not represent new paid requests or physical-device acceptance. Terminal-enabled
Talkie delivery still needs the separately documented Termini artifact fix.
