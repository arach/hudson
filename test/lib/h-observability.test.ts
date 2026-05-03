import { describe, expect, it } from 'vitest';
import {
  HObservability,
  type HMetricEvent,
  type HObservation,
  type HTraceSpan,
} from '../../packages/web/hudsonkit/src/observability';

const createTestObservability = () => {
  let tick = 100;
  let id = 0;
  return new HObservability({
    enabled: true,
    now: () => tick++,
    createId: () => `id_${++id}`,
  });
};

describe('HObservability', () => {
  it('records and flushes structured log events', () => {
    const observability = createTestObservability();
    const seen: HObservation[] = [];

    observability.subscribe((event) => seen.push(event));
    const log = observability.logger.info('Canvas ready', {
      category: 'shell',
      data: { workspaceId: 'hudson-os' },
    });

    expect(log).toMatchObject({
      kind: 'log',
      id: 'id_1',
      timestamp: 100,
      level: 'info',
      message: 'Canvas ready',
      category: 'shell',
      data: { workspaceId: 'hudson-os' },
    });
    expect(seen).toEqual([log]);
    expect(observability.flush()).toEqual([log]);
    expect(observability.flush()).toEqual([]);
  });

  it('records counters, gauges, and timing metrics', () => {
    const observability = createTestObservability();

    observability.metrics.counter('window.opened', 2, {
      category: 'windows',
      tags: { app: 'shaper' },
    });
    observability.metrics.gauge('canvas.zoom', 1.25, { category: 'canvas' });
    observability.metrics.timing('boot.duration', 42, { category: 'boot' });

    const metrics = observability.flush() as HMetricEvent[];

    expect(metrics).toMatchObject([
      {
        kind: 'metric',
        metricType: 'counter',
        name: 'window.opened',
        value: 2,
        category: 'windows',
        tags: { app: 'shaper' },
      },
      {
        kind: 'metric',
        metricType: 'gauge',
        name: 'canvas.zoom',
        value: 1.25,
        category: 'canvas',
      },
      {
        kind: 'metric',
        metricType: 'timing',
        name: 'boot.duration',
        value: 42,
        unit: 'ms',
        category: 'boot',
      },
    ]);
  });

  it('emits trace span start and end records', () => {
    const observability = createTestObservability();
    const span = observability.trace.start('workspace.load', {
      category: 'workspace',
      data: { workspaceId: 'hudson-os' },
    });

    span.end({ apps: 3 });

    const spans = observability.flush() as HTraceSpan[];

    expect(spans).toHaveLength(2);
    expect(spans[0]).toMatchObject({
      kind: 'span',
      id: 'id_1',
      traceId: 'id_1',
      name: 'workspace.load',
      status: 'active',
      startTime: 100,
      category: 'workspace',
      data: { workspaceId: 'hudson-os' },
    });
    expect(spans[1]).toMatchObject({
      kind: 'span',
      id: 'id_1',
      traceId: 'id_1',
      name: 'workspace.load',
      status: 'ok',
      startTime: 100,
      endTime: 101,
      durationMs: 1,
      data: { workspaceId: 'hudson-os', apps: 3 },
    });
  });

  it('emits errored trace spans and ignores duplicate completion', () => {
    const observability = createTestObservability();
    const span = observability.trace.start('intent.execute');

    span.error(new Error('Command failed'));
    span.end();

    const spans = observability.flush() as HTraceSpan[];

    expect(spans).toHaveLength(2);
    expect(spans[1]).toMatchObject({
      status: 'error',
      error: { name: 'Error', message: 'Command failed' },
      durationMs: 1,
    });
  });

  it('supports filtered subscriptions and replay from the buffer', () => {
    const observability = createTestObservability();
    const metrics: HObservation[] = [];
    const replayed: HObservation[] = [];

    observability.logger.debug('Skipped by metric subscriber');
    observability.metrics.counter('frame.render');

    observability.subscribe((event) => metrics.push(event), { kinds: ['metric'], replay: true });
    observability.metrics.gauge('frame.fps', 60);
    observability.logger.warn('Still skipped by metric subscriber');

    observability.subscribe((event) => replayed.push(event), { replay: true });

    expect(metrics.map((event) => event.kind)).toEqual(['metric', 'metric']);
    expect(metrics.map((event) => event.kind === 'metric' ? event.name : '')).toEqual([
      'frame.render',
      'frame.fps',
    ]);
    expect(replayed).toHaveLength(4);
  });

  it('isolates throwing sinks from product code paths', () => {
    const observability = createTestObservability();
    const seen: HObservation[] = [];

    observability.subscribe(() => {
      throw new Error('Sink failed');
    });
    observability.subscribe((event) => seen.push(event));

    expect(() => observability.logger.info('Safe to emit')).not.toThrow();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ kind: 'log', message: 'Safe to emit' });
  });

  it('can be disabled for zero-buffer production defaults', () => {
    const observability = new HObservability({ enabled: false });
    const seen: HObservation[] = [];

    observability.subscribe((event) => seen.push(event));
    observability.logger.info('No-op');
    observability.metrics.counter('ignored');
    observability.trace.start('ignored').end();

    expect(seen).toEqual([]);
    expect(observability.flush()).toEqual([]);
  });
});
