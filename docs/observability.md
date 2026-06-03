---
title: Observability
description: Logs, metrics, and traces via hudsonkit/observability
order: 10
---

# Observability

## Overview

`hudsonkit/observability` gives you structured logs, metrics, and distributed traces through a single event bus (`HObservability`) and three typed emitters (`HLogger`, `HMetrics`, `HTrace`). Every emission goes to registered sinks and is buffered in-memory for replay. The subpath is opt-in; nothing is loaded unless you import it. A pre-wired global instance is exported as `HObservabilityDefault`; it is enabled only when `globalThis.H_OBSERVABILITY` or `globalThis.H_DEBUG` is `true`.

## Quick start

```ts
import {
  HObservabilityDefault as obs,
} from 'hudsonkit/observability';

// log
obs.logger.info('app mounted', { category: 'lifecycle' });

// counter
obs.metrics.counter('button.click');

// span
const span = obs.trace.start('load-data');
try {
  await fetchData();
  span.end();
} catch (err) {
  span.error(err);
}
```

## HObservability

The central event bus. Holds the buffer, manages sinks, and owns the three emitters.

```ts
import { HObservability, HObservabilityDefault } from 'hudsonkit/observability';

// pre-built global (enabled when H_OBSERVABILITY or H_DEBUG is true)
const obs = HObservabilityDefault;

// or create your own
const obs = new HObservability({ enabled: true, maxBufferSize: 500 });

// or use the static factory (same env-gated logic as HObservabilityDefault)
const obs = HObservability.global();
```

### Constructor options — `HObservabilityOptions`

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `enabled` | `boolean` | `true` | When `false`, `emit` is a no-op. |
| `maxBufferSize` | `number` | `200` | Max events held in the replay buffer. `0` disables buffering. |
| `now` | `() => number` | `Date.now` | Timestamp source. |
| `createId` | `() => string` | `crypto.randomUUID` | ID generator. |

### Key methods

| Method | Description |
|--------|-------------|
| `subscribe(sink, options?)` | Register a sink; returns an unsubscribe function. |
| `emit(event)` | Emit a pre-built `HObservation` directly. |
| `flush()` | Return and clear the buffer. |
| `snapshot()` | Return a copy of the buffer without clearing it. |
| `setEnabled(boolean)` | Enable or disable the bus at runtime. |
| `now()` | Call the configured timestamp function. |
| `createId()` | Call the configured ID function. |

The three emitter instances are available as `obs.logger`, `obs.metrics`, and `obs.trace`.

## HLogger

Emits `HLogEvent` observations at one of four levels.

```ts
import { HLogger } from 'hudsonkit/observability';

obs.logger.debug('cache miss', { category: 'cache', data: { key: 'users' } });
obs.logger.info('user signed in');
obs.logger.warn('rate limit approaching', { data: { remaining: 5 } });
obs.logger.error('fetch failed', { data: { url: '/api/items' } });
```

### `HLogLevel`

`'debug' | 'info' | 'warn' | 'error'`

### `HLogInput`

| Name | Type | Description |
|------|------|-------------|
| `category` | `string` | Logical grouping (e.g. `'network'`, `'lifecycle'`). |
| `data` | `HObservationData` | Arbitrary key/value payload (`Record<string, unknown>`). |

All four level methods (`debug`, `info`, `warn`, `error`) accept `(message: string, input?: HLogInput)` and return the emitted `HLogEvent`.

## HMetrics

Emits `HMetricEvent` observations for counters, gauges, and timings.

```ts
obs.metrics.counter('api.request', 1, { tags: { route: '/items' } });
obs.metrics.gauge('queue.depth', 42);
obs.metrics.timing('db.query', 38, { category: 'database' });
```

### `HMetricType`

`'counter' | 'gauge' | 'timing'`

`timing` defaults `unit` to `'ms'` if not provided.

### `HMetricInput`

| Name | Type | Description |
|------|------|-------------|
| `category` | `string` | Logical grouping. |
| `unit` | `string` | Unit label (e.g. `'ms'`, `'bytes'`). |
| `tags` | `HObservationTags` | Dimension tags (`Record<string, string \| number \| boolean>`). |
| `data` | `HObservationData` | Arbitrary key/value payload. |

`counter(name, value?, input?)` — `value` defaults to `1`.  
`gauge(name, value, input?)` and `timing(name, durationMs, input?)` require an explicit value.

## HTrace + HSpan

`obs.trace.start(name, input?)` creates an `HSpan` and immediately emits a `'span'` observation with `status: 'active'`. Call `span.end()` or `span.error(err)` to close it.

```ts
const span = obs.trace.start('render-report', { category: 'ui' });

// always close the span
try {
  const result = await generateReport();
  span.end({ rowCount: result.rows.length });
} catch (err) {
  span.error(err);
}
```

`end` and `error` are both idempotent: calling them more than once after the span is closed is a no-op.

### `HTraceStatus`

| Value | When set |
|-------|----------|
| `'active'` | Span has started, not yet closed. |
| `'ok'` | `span.end()` was called. |
| `'error'` | `span.error(err)` was called. |

### `HTraceInput`

| Name | Type | Description |
|------|------|-------------|
| `traceId` | `string` | Explicit trace ID. Defaults to the span's own ID. |
| `parentId` | `string` | Parent span ID for nested traces. |
| `category` | `string` | Logical grouping. |
| `data` | `HObservationData` | Initial data payload; merged with any data passed to `end`/`error`. |

## Subscribing to observations

`subscribe` returns an `HUnsubscribe` function. Call it to remove the sink.

```ts
import type { HObservationSink } from 'hudsonkit/observability';

const sink: HObservationSink = (event) => {
  const prefix = `[${event.kind.toUpperCase()}]`;
  if (event.kind === 'log') console.log(prefix, event.level, event.message);
  else if (event.kind === 'metric') console.log(prefix, event.name, event.value);
  else if (event.kind === 'span') console.log(prefix, event.name, event.status, event.durationMs);
};

const unsubscribe = obs.subscribe(sink, {
  kinds: ['log', 'metric'],  // omit to receive all kinds
  replay: true,              // replay buffered events immediately on subscribe
});

// later
unsubscribe();
```

### `HSubscribeOptions`

| Name | Type | Description |
|------|------|-------------|
| `kinds` | `HObservationKind[]` | Filter to specific event kinds. Omit to receive everything. |
| `replay` | `boolean` | If `true`, the sink receives all buffered events synchronously before new ones. |

Sinks must never throw. Any thrown error is swallowed to protect product code paths.

## Types

All types are exported from `hudsonkit/observability`. Full shapes are in `src/types/observability.ts`.

| Type | Description |
|------|-------------|
| `HLogEvent` | Emitted observation for a log call. Extends `HObservationBase` with `level` and `message`. |
| `HLogInput` | Input to `HLogger` methods: `category` and `data`. |
| `HLogLevel` | `'debug' \| 'info' \| 'warn' \| 'error'` |
| `HMetricEvent` | Emitted observation for a metric call. Adds `metricType`, `name`, `value`, `unit`, `tags`. |
| `HMetricInput` | Input to `HMetrics` methods: `category`, `unit`, `tags`, `data`. |
| `HMetricType` | `'counter' \| 'gauge' \| 'timing'` |
| `HObservabilityOptions` | Constructor options for `HObservability`. |
| `HObservation` | Union of `HLogEvent \| HMetricEvent \| HTraceSpan`. |
| `HObservationBase` | Common fields on every observation: `id`, `kind`, `timestamp`, `category`, `data`. |
| `HObservationData` | `Record<string, unknown>` — free-form event payload. |
| `HObservationKind` | `'log' \| 'metric' \| 'span'` |
| `HObservationSink` | `(event: HObservation) => void` — the shape of a subscriber callback. |
| `HObservationTags` | `Record<string, string \| number \| boolean>` — metric dimension tags. |
| `HSubscribeOptions` | Options for `subscribe`: `kinds` filter and `replay` flag. |
| `HTraceInput` | Input to `HTrace.start`: `traceId`, `parentId`, `category`, `data`. |
| `HTraceSpan` | Emitted observation for a span. Adds `name`, `traceId`, `parentId`, `startTime`, `endTime`, `durationMs`, `status`, `error`. |
| `HTraceStatus` | `'active' \| 'ok' \| 'error'` |
| `HUnsubscribe` | `() => void` — return type of `subscribe`. |

## Apple (HudsonObservability)

Hudson's Apple SDK ships `HudsonObservability` as a first-class target in the `HudsonKit` Swift package. It mirrors the web SDK's three-emitter shape (logger / metrics / trace) but is built on Apple-native primitives: `os.Logger` for structured logging and `OSSignposter` for traces. Events show up in Console.app and Instruments without extra wiring.

### HudInstrumentation — the entrypoint

`HudInstrumentation` bundles a `HudLogger` and `HudTrace` together. Two pre-configured instances cover most call sites:

```swift
import HudsonObservability

HudInstrumentation.ui.event("Voice.listen", metadata: ["status": "start"])
HudInstrumentation.observability.count("buffer.flush")
```

Or instantiate your own:

```swift
let instr = HudInstrumentation(category: "network")
```

### HudLogger — structured logs

`HudLogger` writes to `os.Logger` with public/private metadata partitioning. Six levels: `debug`, `info`, `notice`, `warning`, `error`, `fault`.

```swift
import HudsonObservability

let log = HudLogger(category: "lifecycle")
log.info("app mounted")
log.warning("rate limit approaching", metadata: ["remaining": "5"])
log.error("fetch failed", metadata: ["url": "/api/items"])
```

Metadata keys in the SDK's `publicMetadataKeys` allowlist (e.g. `state`, `status`, `outcome`, `name`, `value`) are emitted with `privacy: .public`; everything else is logged as `.private` so it redacts in shipped builds.

### HudLogStore — in-memory replay

For dev tools and Settings inspectors, install `HudLogStore.shared` (an `ObservableObject` bounded buffer) as a sink at app boot:

```swift
HudLoggerSinks.install(HudLogStore.shared)

// elsewhere, in SwiftUI:
@StateObject private var logs = HudLogStore.shared
```

Production code installs no sinks, so `HudLogger` calls cost only the underlying `os.Logger` write.

### HudMetric — counters, durations, sizes

```swift
let instr = HudInstrumentation.ui
instr.count("button.click")
instr.duration("db.query", milliseconds: 38)
instr.memory("cache.bytes", bytes: 1_048_576)

// or directly:
HudMetric("api.request", unit: .count).record(1, metadata: ["route": "/items"])
```

`HudMetricUnit` covers `.count`, `.milliseconds`, `.bytes`, `.ratio`, and `.custom("...")`. Metrics are written through `HudLogger` as `metric.record` events with `metric`, `unit`, and `value` metadata — pick them up via `HudLoggerSinks` if you want to forward to a metrics backend.

### HudTrace + HudSpan

`HudTrace` wraps `OSSignposter`, so spans appear in Instruments' Points of Interest track.

```swift
let result = try HudInstrumentation.ui.span("Voice.listen.start", metadata: ["clientId": "my-app"]) {
    try await session.start()
}
```

`span(_:metadata:_:)` has sync and async overloads. On throw, the span ends with `outcome=error` and an `error` log is emitted automatically. For manual control, call `beginSpan` and `span.end()` (or `span.end("error")`) yourself.
