# HudAI Framework Design Spec

## Status

Draft spec for the shared Hudson AI inference primitive. This document is a contract only; it does not prescribe implementation files or include application code.

## Purpose

HudAI is the small, opinionated inference layer shared by Hudson web and Apple apps. It factors out the repeated work already present in Talkie and OpenScout: provider setup, credential lookup, message normalization, streaming event parsing, typed tool calls, prompt caching, token accounting, and recoverable error surfaces.

HudAI is not an agent runtime. It handles one model turn at a time. Apps may build higher-level flows on top, but HudAI itself should remain a provider-neutral request/stream/response primitive.

## Reference patterns harvested

### Talkie

Talkie's server gateway proves the value of a central provider registry with one normalized request/response shape. Each provider translates Hudson's canonical request into provider-specific payloads and maps back content, usage, and finish reason. Talkie also shows two useful execution modes:

- direct provider calls for plain inference;
- Claude CLI `stream-json` for session-style/headless work, with newline JSON parsing, optional SSE wrapping, session id capture, and text extraction.

Design lessons:

- isolate provider-specific request quirks behind adapters;
- treat system messages specially where providers require it;
- expose usage and finish reasons in the common response;
- keep API-key lookup out of app call sites;
- stream as structured events, not raw provider text.

### OpenScout

OpenScout proves a durable adapter boundary. Claude Code is launched as a long-lived stream-json process, while broker/session state consumes a shared turn/block model. The adapter maps provider events into text, reasoning, action/tool, question, error, and completion blocks. It correlates `tool_use` and `tool_result` by id, incrementally accumulates text/thinking deltas, and treats partial JSON tool input as a first-class stream concern.

Design lessons:

- one provider transport should not leak into app protocol;
- stream consumers want stable semantic events, not vendor event names;
- tool calls need typed ids, names, decoded input, status, and result correlation;
- interruptions and permission denials should become normal terminal events;
- prompt/tool execution is separate from session/broker orchestration.

## Non-goals

HudAI v1 excludes voice/realtime, image generation, RAG, fine-tuning, long-running agent loops, broker routing, transcript persistence, prompt editors, UI components, and model marketplace features.

## Package shape

HudAI should ship as a cross-platform Hudson framework with equivalent contracts:

- Swift module: `HudAI`
- TypeScript package: `hudsonkit/ai` or `@hudson/hudai` depending on Hudson package policy

Both surfaces expose the same nouns:

- `HudAIClient`
- `HudAIProviderAdapter`
- `HudAIRequest`
- `HudAIMessage`
- `HudAIContentPart`
- `HudAIToolDefinition`
- `HudAIToolCall`
- `HudAIToolResult`
- `HudAIStreamEvent`
- `HudAIResponse`
- `HudAIError`
- `HudAIUsage`
- `HudAICredentialSource`
- `HudAIRoute`

## Public API: TypeScript

The TypeScript API should support React/Next.js call sites without depending on React. React hooks can be added later as thin convenience wrappers.

### Client construction

Public construction contract:

- `new HudAIClient(options)`
- options include:
  - `provider`: provider id or adapter instance; default `anthropic`
  - `model`: optional default model
  - `vault`: HudVault-compatible credential source
  - `defaults`: temperature, max output tokens, prompt cache policy, timeout, retry policy
  - `logger`: optional structured logger
  - `routeDefault`: optional `HudAIRoute`; default `local` unless a client chooses paired-device routing

Credential source contract:

- `get(key: string): Promise<string | null>`
- HudAI never accepts raw API keys in app-level request objects.
- Test-only or server-only construction may provide an explicit in-memory credential source, but it must implement the same interface.

### Request

Canonical request fields:

- `model?: string`
- `messages: HudAIMessage[]`
- `system?: string | HudAIContentPart[]`
- `tools?: HudAIToolDefinition[]`
- `toolChoice?: auto | none | required | named tool`
- `temperature?: number`
- `maxOutputTokens?: number`
- `metadata?: Record<string, string | number | boolean>`
- `cache?: HudAICachePolicy`
- `signal?: AbortSignal`
- `route?: HudAIRoute` where `local` calls the provider from this device, `paired(deviceId)` routes through a paired device, and `auto` chooses a reachable configured-default paired device when available then falls back to `local`

Message fields:

- `role`: `user`, `assistant`, or `tool`
- `content`: string or typed content parts
- `toolCallId?`: required on tool-result messages
- `name?`: optional participant/tool name

Content part variants for v1:

- text
- tool call
- tool result

Image/audio/file parts are reserved for future primitives and should not be accepted silently in v1.

### Methods

Core methods:

- `complete(request): Promise<HudAIResponse>`
- `stream(request): AsyncIterable<HudAIStreamEvent>`
- `listModels(provider?): Promise<HudAIModelInfo[]>` where supported

`complete` is a collector over `stream` for providers that only expose streaming, or a direct non-streaming call for providers that support it. App code should receive the same response shape either way.

## Public API: Swift

Swift should mirror the TypeScript nouns while feeling native to SwiftUI and structured concurrency.

### Client construction

Public construction contract:

- `HudAIClient(provider:model:vault:defaults:routeDefault:logger:)`
- `provider` defaults to Claude/Anthropic adapter
- `vault` conforms to a small credential protocol backed by HudVault
- `routeDefault` is an optional `HudAIRoute`, defaulting to `.local` unless the app/client has a paired-device default

Credential source contract:

- `func get(_ key: String) async throws -> Data?`
- HudAI decodes API keys internally as UTF-8 only at the adapter boundary.
- Raw keys should not be retained beyond request construction.

### Methods

Core methods:

- `func complete(_ request: HudAIRequest) async throws -> HudAIResponse`
- `func stream(_ request: HudAIRequest) -> AsyncThrowingStream<HudAIStreamEvent, Error>`
- `func listModels(provider: HudAIProviderID?) async throws -> [HudAIModelInfo]`

SwiftUI apps can consume `AsyncThrowingStream` in a `Task` and update view-model state incrementally. This keeps HudAI UI-agnostic and works on iOS and macOS.

## Streaming model

HudAI should use async iteration on both platforms:

- TypeScript: `AsyncIterable<HudAIStreamEvent>`
- Swift: `AsyncThrowingStream<HudAIStreamEvent, Error>`

Justification:

- it composes with `AbortSignal` and Swift `Task` cancellation;
- it maps naturally to provider SSE, newline JSON, or SDK streams;
- it avoids callback nesting;
- it can be collected into a final response without a second code path;
- it matches OpenScout's proven stream-json parsing model while exposing vendor-neutral events.

### Event taxonomy

HudAI stream events should be semantic, stable, and small:

- `started`: request id, provider, model
- `textDelta`: content block id, text delta
- `reasoningDelta`: content block id, reasoning delta when a provider exposes it
- `toolCallStarted`: tool call id, tool name
- `toolCallInputDelta`: tool call id, partial structured input text when providers stream JSON
- `toolCallReady`: tool call id, tool name, decoded typed input
- `toolResultAccepted`: tool call id after the app submits a result as a message in the next request, or when a provider-specific session transport reports it
- `usage`: input/output/cache token counters as they become available
- `completed`: response summary, finish reason, usage
- `failed`: normalized error
- `cancelled`: cancellation/interruption acknowledgement

The final `HudAIResponse` contains the assembled assistant content, all tool calls, usage, provider metadata, and finish reason.

## Paired-device routing

HudAI intentionally couples to HudPairing so Hudson apps can run across desktop and mobile without retyping provider keys on every device. Routing is a first-class request concern, not a separate app protocol.

`HudAIRoute` variants:

- `local`: make the provider call from the current device using this device's HudVault.
- `paired(deviceId)`: send the HudAI request to a specific paired device and stream results back from that device.
- `auto`: if a paired device is configured as the client default and is reachable, route through that device; otherwise fall back to `local`.

When routed through a paired device, the request flows over HudPairing's signed-RPC channel. The surveyed HudPairing transport is HTTP over LAN/Tailscale with ECDH P-256 session establishment, HKDF-derived shared keys, and per-request HMAC signing (`X-Device-ID`, `X-Timestamp`, `X-Nonce`, `X-Signature`). Hudson should preserve that channel contract while allowing future HudPairing transports such as relay/WebSocket variants.

The paired device runs a HudAI host: it receives the canonical `HudAIRequest`, performs credential lookup against its own HudVault, calls the chosen provider locally, and sends `HudAIStreamEvent` values back over the signed channel. The streaming event taxonomy does not change. Apps consume `started`, `textDelta`, `toolCallReady`, `usage`, `completed`, `failed`, and other events exactly the same way whether the route is local or paired.

Credential semantics are route-dependent. For `local`, credentials come from the local HudVault. For `paired(deviceId)`, credentials come from the paired device's HudVault; the local device does not need provider keys installed. This unlocks the intended affordance: set up model provider keys once on a workstation, then use HudAI seamlessly from a phone or tablet through that workstation. Future implementations should preserve that no-local-secret property.

Route failures normalize to `HudAIError.pairingChannelUnavailable` when the paired device is offline, the signed-RPC channel times out, HMAC/signature validation fails, or the HudAI host is unreachable. In `auto`, this error should only surface after both the paired route and local fallback are unavailable or disallowed by policy.

## Tool use envelope

HudAI tools must be typed, not stringly.

Tool definition fields:

- `name`: stable identifier; provider-safe snake_case recommended
- `description`: model-facing description
- `input`: schema object for the input payload
- `output?`: optional schema object for tool result payloads
- `annotations?`: safe/read-only/destructive/requiresConfirmation metadata

TypeScript should accept a schema adapter that can infer types from Zod or JSON Schema. Swift should use `Codable` types plus generated/declared JSON Schema. The canonical wire format is JSON Schema because Claude and OpenAI can both consume it mechanically.

Tool call fields:

- `id`: provider or HudAI-generated id
- `name`
- `input`: decoded object conforming to the declared input schema
- `rawInput?`: retained for debugging when decode fails
- `status`: streaming, ready, resultSubmitted, failed

Tool result fields:

- `toolCallId`
- `content`: typed payload or text
- `isError`: boolean
- `metadata?`

Execution contract:

1. HudAI emits `toolCallReady` when a provider has produced a complete, schema-valid call.
2. The app owns execution and policy decisions.
3. The app sends tool results back as `tool` role messages in the next request.
4. HudAI validates the result envelope and translates it to provider-specific `tool_result` / function-call output format.

HudAI must not execute tools itself in v1. This keeps it an inference framework rather than an agent framework.

## Prompt caching

Prompt caching is on by default for long, stable prompts. Apps should not manually construct Anthropic `cache_control` envelopes.

Cache policy:

- `automatic` default: cache system prompt and tool definitions when they exceed a configurable threshold or are marked stable;
- `off`: disable provider prompt cache headers/envelopes;
- `force`: cache eligible system/tool blocks even below threshold when provider supports it.

Canonical cache markers:

- system prompt: stable by default unless request metadata says ephemeral;
- tool definitions: stable by default for a client instance;
- user messages: not cached by default;
- retrieved documents: out of scope for v1 because RAG is out of scope.

Adapter behavior:

- Claude adapter maps eligible blocks to Anthropic prompt-caching control.
- OpenAI adapter ignores or maps the policy only where provider features exist.
- Usage includes `cacheCreationInputTokens` and `cacheReadInputTokens` when available, matching the accounting OpenScout already tracks.

## HudVault integration

HudAI consumes credentials only through HudVault-compatible sources. Credential lookup happens on the device that actually makes the provider request. For `local`, that is the current device. For `paired(deviceId)`, that is the paired HudAI host device, so the caller can stream AI responses without ever receiving or storing the provider API key locally.

### Credential keys

Use provider-scoped names, with adapter variants owning their own key names even when they share an OpenAI-compatible wire protocol:

- Claude/Anthropic: `anthropic_key`
- OpenAI: `openai_key`
- OpenRouter: `openrouter_key`
- DeepSeek: `deepseek_key`
- Fireworks AI: `fireworks_key`
- Together: `together_key` when scheduled

The brief names `openai_key` as the HudVault example. HudAI should support that key for OpenAI and use `anthropic_key` for Claude unless Hudson standardizes a different provider-key naming convention before implementation.

### TypeScript flow

1. App or server creates `HudAIClient` with `vault: hudVault`.
2. The chosen adapter asks for its provider key at request time.
3. Missing key throws `HudAIError.credentialsMissing(provider, key)`.
4. The key is applied to the outbound provider request and not returned in errors, logs, metadata, or stream events.

### Swift flow

1. App creates `HudAIClient` with `HudVault(service:)` or a thin adapter around it.
2. Adapter calls `get(providerKey)` before the network request.
3. Returned `Data` is decoded as UTF-8 and scoped to the request.
4. Missing or invalid data becomes a typed credential error.

## Provider abstraction

Claude/Anthropic is primary in v1. OpenAI support should be introduced as a reusable OpenAI-compatible base transport plus thin provider variants, not as one-off rewrites. Several target providers share the OpenAI wire protocol but differ in base URL, authentication key, model namespace, and feature quirks.

Adapter contract:

- provider id and display name;
- default model selection;
- model id namespace rules;
- supported feature flags: streaming, tools, reasoning, prompt cache, model listing, usage detail;
- credential key;
- endpoint/base URL configuration;
- request translation;
- stream parsing into HudAI events;
- response assembly;
- error normalization.

Provider roster:

- Anthropic / Claude: v1 primary adapter.
- OpenAI: v2 mechanical adapter built on the OpenAI-compatible base, targeting the Hudson-approved OpenAI endpoint at implementation time.
- OpenRouter: separate adapter because it is a meta-provider routing to many model families; use namespaced model strings such as `anthropic/claude-3.5-sonnet`.
- DeepSeek: OpenAI-compatible variant with custom endpoint URL, `deepseek_key`, and provider-specific defaults.
- Fireworks AI: OpenAI-compatible inference-platform variant with custom endpoint URL, `fireworks_key`, and model namespace handling.
- Future: Mistral, Cohere, Google Gemini, Groq, Together. Together should likely be another OpenAI-compatible variant; Mistral/Groq may share enough shape to reuse parts; Gemini and Cohere may need dedicated translators.

Claude adapter responsibilities:

- split system content into Anthropic's system field or content blocks as required;
- apply prompt cache controls automatically;
- translate JSON Schema tools to Anthropic tools;
- parse provider SSE/message events into HudAI semantic events;
- handle `tool_use` ids and streamed JSON input;
- map stop reasons and token usage including cache counters.

OpenAI-compatible base responsibilities:

- translate messages/tools to OpenAI Responses API, chat completions, or the current Hudson-approved OpenAI-compatible endpoint shape;
- map function/tool calls to the same HudAI tool-call envelope;
- map max token, temperature, stream, and usage quirks inside the base plus variant overrides, as Talkie already does for chat completions;
- expose variant hooks for base URL, headers, credential key, model namespace validation, unsupported feature flags, and error-code mapping;
- emit the same stream events.

No app code should switch on provider-specific event names or OpenAI-compatible variant ids.

## Error model

HudAI errors are typed and safe to show in app logs:

- credentialsMissing
- credentialsInvalid
- networkUnavailable
- providerRejectedRequest
- rateLimited
- overloaded
- timeout
- cancelled
- pairingChannelUnavailable
- toolInputDecodeFailed
- unsupportedFeature
- unknownProvider
- providerProtocolError

Each error includes:

- provider id;
- optional HTTP status;
- retryability;
- sanitized message;
- provider request id if present;
- underlying metadata with secrets stripped.

## Observability

HudAI should expose lightweight hooks without owning persistence:

- request id generated per turn;
- provider/model;
- start/end timestamps;
- usage including cache reads/creations;
- finish reason;
- error class;
- optional app metadata tags.

Logs must never include API keys, full prompts by default, or tool result payloads unless an explicit debug logger opts in.

## Cancellation and retries

Cancellation:

- TypeScript uses `AbortSignal`.
- Swift uses task cancellation and terminates the underlying URLSession/stream.
- Cancellation emits `cancelled` where possible and throws/finishes with a cancellation error.

Retries:

- default retry only for transient network, 429 with retry-after, and 5xx/provider-overloaded classes;
- no automatic retry after a tool call has been emitted unless the provider request is known to have failed before producing semantic output;
- retry policy is configurable per client/request.

## Security and platform boundaries

- Browser clients should not call provider APIs directly with user API keys unless Hudson explicitly accepts that product risk. Preferred web deployment is server/route-handler mediation using HudVault on the server side. Paired-device routing is another approved mediation path when the paired HudAI host owns the credential lookup and provider call.
- Apple apps may call providers directly using HudVault-held keys when that is the intended app model.
- HudAI should not write keys to localStorage, UserDefaults, logs, crash reports, or transcripts.
- Tool input/result validation is part of the public contract because tools can trigger app actions.

## Suggested v1 acceptance criteria

- One Claude/Anthropic adapter on web and Swift.
- `HudAIRoute.local`, `HudAIRoute.paired(deviceId)`, and `HudAIRoute.auto` represented in the public request contract, even if v1 only enables local execution by default.
- `complete` and `stream` support text-only requests.
- Typed tool definitions and streamed tool-call readiness.
- Prompt caching automatic for system prompt/tool definitions.
- HudVault credential lookup only.
- Normalized usage, finish reason, and errors.
- No agent-loop helper in the package.

## Human-review items

1. **Credential key names:** confirm whether Claude should use `anthropic_key`, `claude_key`, or another HudVault convention. This spec recommends `anthropic_key`.
2. **Web credential boundary:** decide whether browser-side direct provider calls are forbidden or merely discouraged. This affects package docs and runtime guards.
3. **OpenAI-compatible base target:** when the OpenAI adapter is scheduled, choose Responses API versus chat completions as the canonical target and decide how much of that base is shared by DeepSeek, Fireworks, Together, and OpenRouter.
4. **Schema source of truth:** decide whether Hudson standardizes on Zod for TypeScript tool schemas or accepts raw JSON Schema plus adapters.
5. **Reasoning exposure:** decide whether reasoning deltas are exposed to all apps or gated by provider/model capability and app opt-in.
6. **Paired-route policy:** decide whether apps can require paired routing with no local fallback for sensitive or cost-controlled requests, and how users set the default paired HudAI host per client.
7. **HudPairing transport readiness:** confirm which HudPairing transports beyond LAN/Tailscale HTTP must exist before paired HudAI routing is considered shippable.
