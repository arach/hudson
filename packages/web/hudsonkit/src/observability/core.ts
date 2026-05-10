import type {
  HLogEvent,
  HLogInput,
  HLogLevel,
  HMetricEvent,
  HMetricInput,
  HMetricType,
  HObservabilityOptions,
  HObservation,
  HObservationKind,
  HObservationSink,
  HSubscribeOptions,
  HTraceInput,
  HTraceSpan,
  HUnsubscribe,
} from '../types/observability';
import { createHudsonId } from '../lib/id';

const DEFAULT_BUFFER_SIZE = 200;

const defaultNow = () => Date.now();

const createDefaultId = () => {
  return createHudsonId('h', 12);
};

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { message: String(error) };
};

const shouldEnableDefaultGlobal = () => {
  const root = globalThis as unknown as Record<string, unknown>;
  return root.H_OBSERVABILITY === true || root.H_DEBUG === true;
};

class HSinkSet {
  private readonly sinks = new Map<
    HObservationSink,
    { kinds: Set<HObservationKind> | null }
  >();

  get size() {
    return this.sinks.size;
  }

  add(sink: HObservationSink, options: HSubscribeOptions = {}): HUnsubscribe {
    const kinds = options.kinds ? new Set(options.kinds) : null;
    this.sinks.set(sink, { kinds });
    return () => {
      this.sinks.delete(sink);
    };
  }

  emit(event: HObservation) {
    for (const [sink, config] of this.sinks) {
      if (config.kinds && !config.kinds.has(event.kind)) continue;
      try {
        sink(event);
      } catch {
        // Observability sinks must never break product code paths.
      }
    }
  }
}

export class HLogger {
  constructor(private readonly owner: HObservability) {}

  log(level: HLogLevel, message: string, input: HLogInput = {}) {
    const event: HLogEvent = {
      id: this.owner.createId(),
      kind: 'log',
      timestamp: this.owner.now(),
      level,
      message,
      category: input.category,
      data: input.data,
    };
    this.owner.emit(event);
    return event;
  }

  debug(message: string, input?: HLogInput) {
    return this.log('debug', message, input);
  }

  info(message: string, input?: HLogInput) {
    return this.log('info', message, input);
  }

  warn(message: string, input?: HLogInput) {
    return this.log('warn', message, input);
  }

  error(message: string, input?: HLogInput) {
    return this.log('error', message, input);
  }
}

export class HMetrics {
  constructor(private readonly owner: HObservability) {}

  counter(name: string, value = 1, input: HMetricInput = {}) {
    return this.record('counter', name, value, input);
  }

  gauge(name: string, value: number, input: HMetricInput = {}) {
    return this.record('gauge', name, value, input);
  }

  timing(name: string, durationMs: number, input: HMetricInput = {}) {
    return this.record('timing', name, durationMs, { ...input, unit: input.unit ?? 'ms' });
  }

  private record(
    metricType: HMetricType,
    name: string,
    value: number,
    input: HMetricInput,
  ) {
    const event: HMetricEvent = {
      id: this.owner.createId(),
      kind: 'metric',
      timestamp: this.owner.now(),
      metricType,
      name,
      value,
      category: input.category,
      unit: input.unit,
      tags: input.tags,
      data: input.data,
    };
    this.owner.emit(event);
    return event;
  }
}

export class HSpan {
  private ended = false;

  constructor(
    private readonly owner: HObservability,
    readonly event: HTraceSpan,
  ) {
    this.owner.emit({ ...event });
  }

  end(data?: HTraceInput['data']) {
    if (this.ended) return this.event;
    const endTime = this.owner.now();
    this.ended = true;
    this.event.endTime = endTime;
    this.event.durationMs = Math.max(0, endTime - this.event.startTime);
    this.event.status = 'ok';
    if (data) {
      this.event.data = { ...this.event.data, ...data };
    }
    this.owner.emit({ ...this.event });
    return this.event;
  }

  error(error: unknown, data?: HTraceInput['data']) {
    if (this.ended) return this.event;
    const endTime = this.owner.now();
    this.ended = true;
    this.event.endTime = endTime;
    this.event.durationMs = Math.max(0, endTime - this.event.startTime);
    this.event.status = 'error';
    this.event.error = serializeError(error);
    if (data) {
      this.event.data = { ...this.event.data, ...data };
    }
    this.owner.emit({ ...this.event });
    return this.event;
  }
}

export class HTrace {
  constructor(private readonly owner: HObservability) {}

  start(name: string, input: HTraceInput = {}) {
    const id = this.owner.createId();
    const startTime = this.owner.now();
    const event: HTraceSpan = {
      id,
      kind: 'span',
      timestamp: startTime,
      name,
      traceId: input.traceId ?? id,
      parentId: input.parentId,
      startTime,
      status: 'active',
      category: input.category,
      data: input.data,
    };
    return new HSpan(this.owner, event);
  }
}

export class HObservability {
  readonly logger = new HLogger(this);
  readonly metrics = new HMetrics(this);
  readonly trace = new HTrace(this);

  private readonly sinks = new HSinkSet();
  private readonly buffer: HObservation[] = [];
  private readonly maxBufferSize: number;
  private enabled: boolean;
  private readonly nowFn: () => number;
  private readonly createIdFn: () => string;

  constructor(options: HObservabilityOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.maxBufferSize = Math.max(0, options.maxBufferSize ?? DEFAULT_BUFFER_SIZE);
    this.nowFn = options.now ?? defaultNow;
    this.createIdFn = options.createId ?? createDefaultId;
  }

  static global(options: HObservabilityOptions = {}) {
    return new HObservability({
      ...options,
      enabled: options.enabled ?? shouldEnableDefaultGlobal(),
    });
  }

  get isEnabled() {
    return this.enabled;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  subscribe(sink: HObservationSink, options: HSubscribeOptions = {}) {
    const unsubscribe = this.sinks.add(sink, options);
    if (options.replay) {
      for (const event of this.buffer) {
        if (options.kinds && !options.kinds.includes(event.kind)) continue;
        sink(event);
      }
    }
    return unsubscribe;
  }

  flush() {
    const events = this.buffer.slice();
    this.buffer.length = 0;
    return events;
  }

  snapshot() {
    return this.buffer.slice();
  }

  emit(event: HObservation) {
    if (!this.enabled) return event;
    this.remember(event);
    if (this.sinks.size > 0) {
      this.sinks.emit(event);
    }
    return event;
  }

  now() {
    return this.nowFn();
  }

  createId() {
    return this.createIdFn();
  }

  private remember(event: HObservation) {
    if (this.maxBufferSize === 0) return;
    this.buffer.push(event);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.splice(0, this.buffer.length - this.maxBufferSize);
    }
  }
}
