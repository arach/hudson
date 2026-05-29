import { HObservability, HObservabilityDefault } from './core';

export const HUDSON_AGENT_ACTION_EVENT = 'hudson:agent-action';

export type HudsonAgentActionStatus = 'started' | 'completed' | 'failed';

export interface HudsonAgentActionInput {
  source?: string;
  origin?: string;
  actor?: string;
  status?: HudsonAgentActionStatus;
  toolset?: string;
  chatId?: string;
  action?: string;
  commandId?: string;
  appId?: string;
  appName?: string;
  workspaceId?: string;
  workspaceName?: string;
  args?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  error?: unknown;
  traceId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function shouldRedactKey(key: string, path: string[]) {
  const lowered = key.toLowerCase();
  return (
    lowered.includes('secret') ||
    lowered.includes('token') ||
    lowered.includes('password') ||
    lowered.includes('apikey') ||
    lowered.includes('api_key') ||
    (path[0] === 'set_environment_variable' && lowered === 'value')
  );
}

export function redactAgentActionValue(value: unknown, path: string[] = []): unknown {
  if (Array.isArray(value)) {
    return value.map(item => redactAgentActionValue(item, path));
  }

  if (!isRecord(value)) return value;

  const redacted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    redacted[key] = shouldRedactKey(key, path)
      ? '[redacted]'
      : redactAgentActionValue(child, [...path, key]);
  }
  return redacted;
}

function serializeAgentActionError(error: unknown) {
  if (!error) return undefined;
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  if (isRecord(error)) {
    return redactAgentActionValue(error) as Record<string, unknown>;
  }
  return { message: String(error) };
}

export function logHudsonAgentAction(
  input: HudsonAgentActionInput,
  observability: HObservability = HObservabilityDefault,
) {
  const status = input.status ?? 'started';
  const level = status === 'failed' ? 'error' : 'info';

  return observability.logger[level]('hudson.agent.action', {
    category: 'agent-action',
    data: {
      triggeredBy: 'agent',
      source: input.source ?? 'external',
      origin: input.origin,
      actor: input.actor,
      status,
      toolset: input.toolset,
      chatId: input.chatId,
      action: input.action,
      commandId: input.commandId,
      appId: input.appId,
      appName: input.appName,
      workspaceId: input.workspaceId,
      workspaceName: input.workspaceName,
      traceId: input.traceId,
      args: input.args ? redactAgentActionValue(input.args, [input.action ?? '']) : undefined,
      metadata: input.metadata ? redactAgentActionValue(input.metadata) : undefined,
      error: serializeAgentActionError(input.error),
    },
  });
}

export function dispatchHudsonAgentAction(input: HudsonAgentActionInput) {
  if (typeof window === 'undefined') return false;
  window.dispatchEvent(new CustomEvent(HUDSON_AGENT_ACTION_EVENT, { detail: input }));
  return true;
}
