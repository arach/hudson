---
title: "AI"
description: "Provider-neutral inference: Claude, OpenAI, OpenRouter"
order: 14
section: "AI"
---

# AI

## Overview

`HudAI` is the Apple-side inference primitive in HudsonKit. It handles one model turn at a time — provider setup, credentials, streaming, typed tool calls, recoverable errors — behind a single `HudAIClient`. Swap providers by passing a different adapter.

Design rationale lives in the internal engineering spec at `specs/hud-ai-framework.md`.

## HudAIClient

Construct with a provider adapter and a credential source (typically a `HudVault`).

```swift
import HudsonAI
import HudsonUI

let client = HudAIClient(provider: HudAIProviders.Claude(), hudVault: vault)

let response = try await client.complete(
    HudAIRequest(
        messages: [.user("Summarize today's standup notes.")],
        system: "You are a terse assistant."
    )
)
print(response.text)
```

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `provider` | `HudAIProviderAdapter` | `AnthropicHudAIAdapter()` | Vendor adapter. |
| `model` | `String?` | adapter default | Default model id; per-request overrides. |
| `vault` / `hudVault` | `HudAICredentialSource` / `HudVault` | — | Key source. Raw keys are never accepted in requests. |
| `defaults` | `HudAIDefaults` | — | Temperature, max output tokens, cache policy, timeout. |
| `routeDefault` | `HudAIRoute` | `.local` | `.local`, `.auto`, or `.paired(...)`. Paired is reserved and throws. |
| `urlSession` | `URLSession` | `.shared` | Inject for tests or custom transport. |

## Providers

Adapters live under the `HudAIProviders` namespace so call sites read like vendor selection:

```swift
HudAIProviders.Claude()      // Anthropic — implemented
HudAIProviders.Anthropic()   // alias of Claude
HudAIProviders.OpenAI()      // implemented
HudAIProviders.OpenRouter(appTitle: "MyApp", siteURL: url)  // implemented
HudAIProviders.Grok()        // stub — throws .unsupportedFeature
```

Each adapter declares a `credentialKey` read from the vault: `anthropic_key`, `openai_key`, `openrouter_key`, `grok_key`. OpenRouter expects namespaced model ids like `openai/gpt-4o-mini`.

## Requests and messages

`HudAIMessage` carries a role (`.user`, `.assistant`, `.tool`) and `HudAIContentPart`s (`.text`, `.toolCall`, `.toolResult`). Helpers: `.user(_:)`, `.assistant(_:)`, `.toolResult(_:)`.

```swift
let request = HudAIRequest(
    messages: [.user("What's the weather in Berlin?")],
    system: "Be concise.",
    tools: [weatherTool],
    toolChoice: .auto,
    temperature: 0.2,
    maxOutputTokens: 512
)
```

## Streaming

`stream(_:)` returns `AsyncThrowingStream<HudAIStreamEvent, Error>` of vendor-neutral events.

```swift
for try await event in client.stream(request) {
    switch event {
    case .textDelta(_, let text):       print(text, terminator: "")
    case .reasoningDelta(_, let text):  print("[think] \(text)")
    case .toolCallReady(let call):      handle(call)
    case .usage(let usage):             record(usage)
    case .completed(let response):      finish(response)
    case .failed(let error):            throw error
    default: break
    }
}
```

Other events: `.started`, `.toolCallStarted`, `.toolCallInputDelta` (partial JSON), `.toolResultAccepted`, `.cancelled`.

## Tool calls

Tools take a JSON Schema plus a Swift `Decodable` input type. HudAI validates the model's input, so call sites work in typed values, not raw JSON.

```swift
struct WeatherInput: Decodable { let city: String; let units: String? }

let weatherTool = HudAIToolDefinition(
    name: "get_weather",
    description: "Look up current weather.",
    inputSchema: [ /* JSON Schema as [String: HudAIJSONValue] */ ],
    inputType: WeatherInput.self
)

// On .toolCallReady:
let input = try call.decodeInput(WeatherInput.self)
let text = try await fetchWeather(city: input.city, units: input.units)
let toolMessage = HudAIMessage.toolResult(
    HudAIToolResult(toolCallID: call.id, content: .text(text))
)
// Append to messages, call client.stream again to continue the turn.
```

Use `HudAIToolDefinition.untyped(...)` to skip the Swift type — input arrives as raw `HudAIJSONValue`.

## Credentials via HudVault

`HudVault` is HudsonKit's keychain wrapper. Store keys with the credential keys above, then pass the vault to the client:

```swift
try vault.set("anthropic_key", value: Data(apiKey.utf8))
let client = HudAIClient(provider: HudAIProviders.Claude(), hudVault: vault)
```

If a key is missing or empty, requests fail fast with `.credentialsMissing` or `.credentialsInvalid` before any network call.

## Errors

All failures surface as `HudAIError`. Each case carries the `provider`; rejection and rate-limit cases also include HTTP status and request id.

| Case | When |
|------|------|
| `.credentialsMissing` | Vault has no value for the adapter's key. |
| `.credentialsInvalid` | Value is empty or non-UTF8. |
| `.networkUnavailable` | Transport-level failure. |
| `.providerRejectedRequest` | 4xx from the provider. |
| `.rateLimited` | 429 / quota exhaustion. Retryable. |
| `.overloaded` | Provider shedding load. Retryable. |
| `.timeout` | Exceeded `defaults.timeout`. Retryable. |
| `.cancelled` | Task was cancelled. |
| `.toolInputDecodeFailed` | Tool input doesn't decode to declared type. |
| `.unsupportedFeature` | Path not implemented (e.g. Grok stub). |
| `.pairingChannelUnavailable` | `.paired` route, not in v1. |
| `.providerProtocolError` | Stream produced unexpected payload. |

`error.isRetryable` flags transient cases. `error.httpStatus` and `error.providerRequestID` extract details for logging.
