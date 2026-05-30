import { describe, expect, it } from 'vitest';
import {
  inferAgentActionAppId,
  prepareHudAgentActionEvents,
} from '../src/observability/agent-action-view';
import type { HObservation } from '../src/types/observability';

function logEvent(overrides: Partial<Extract<HObservation, { kind: 'log' }>>): HObservation {
  return {
    id: overrides.id ?? `h_${Math.random().toString(36).slice(2)}`,
    kind: 'log',
    timestamp: overrides.timestamp ?? Date.now(),
    category: 'agent-action',
    level: overrides.level ?? 'info',
    message: overrides.message ?? 'agent.task.started',
    data: overrides.data ?? {},
  };
}

describe('agent action view preparation', () => {
  it('hides generic read-only command probes from the default action view', () => {
    const events: HObservation[] = [
      logEvent({
        id: 'done',
        timestamp: 2,
        message: 'agent.task.completed',
        data: {
          triggeredBy: 'agent',
          status: 'completed',
          action: 'agent.task',
          traceId: 'tr_read',
          metadata: { command: ['rg', 'LogoTemplate', 'app/apps/logo', '-g', '*.tsx'] },
        },
      }),
      logEvent({
        id: 'start',
        timestamp: 1,
        message: 'agent.task.started',
        data: {
          triggeredBy: 'agent',
          status: 'started',
          action: 'agent.task',
          traceId: 'tr_read',
          metadata: { command: ['rg', 'LogoTemplate', 'app/apps/logo', '-g', '*.tsx'] },
        },
      }),
    ];

    const result = prepareHudAgentActionEvents(events, 'actions');

    expect(result.events).toHaveLength(0);
    expect(result.hiddenDetailEvents).toBe(2);
    expect(inferAgentActionAppId(events[0])).toBe('logo');
  });

  it('collapses a user-level prompt lifecycle and relates child tool calls by parent trace', () => {
    const events: HObservation[] = [
      logEvent({
        id: 'child-done',
        timestamp: 4,
        message: 'hudson.agent.action',
        data: {
          triggeredBy: 'agent',
          source: 'logo-ai',
          status: 'completed',
          action: 'update_template',
          traceId: 'tr_tool',
          parentTraceId: 'tr_prompt',
          appId: 'logo',
        },
      }),
      logEvent({
        id: 'prompt-done',
        timestamp: 3,
        message: 'hudson.agent.action',
        data: {
          triggeredBy: 'agent',
          source: 'logo-ai',
          status: 'completed',
          action: 'logo.polish',
          traceId: 'tr_prompt',
          appId: 'logo',
          args: { prompt: 'Polish this logo.' },
        },
      }),
      logEvent({
        id: 'prompt-start',
        timestamp: 1,
        message: 'hudson.agent.action',
        data: {
          triggeredBy: 'agent',
          source: 'logo-ai',
          status: 'started',
          action: 'logo.polish',
          traceId: 'tr_prompt',
          appId: 'logo',
          args: { prompt: 'Polish this logo.' },
        },
      }),
    ];

    const result = prepareHudAgentActionEvents(events, 'actions');

    expect(result.events.map(event => event.id)).toEqual(['prompt-done']);
    expect(result.collapsedEvents).toBe(1);
    expect(result.relatedEventsByTrace.get('tr_prompt')?.map(event => event.id)).toEqual([
      'prompt-start',
      'prompt-done',
      'child-done',
    ]);
  });
});
