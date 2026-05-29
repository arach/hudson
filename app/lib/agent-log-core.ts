import { appendFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';

/** Override path for tests; falls back to the canonical `.data/agent-actions.jsonl`. */
export const AGENT_LOG_FILE =
  process.env.HUDSON_AGENT_LOG_FILE_OVERRIDE ??
  join(process.cwd(), '.data', 'agent-actions.jsonl');

// ---------------------------------------------------------------------------
// Limits — keep individual JSONL lines bounded so a runaway payload can't
// blow up the file or the GET tail. Sized to stay well under regular-file
// fs writev safety margins for local appends on macOS/Linux.
// ---------------------------------------------------------------------------
const MAX_LINE_BYTES = 16 * 1024;
const TRUNCATION_MARKER = '[truncated]';

export type AgentLogStatus = 'started' | 'completed' | 'failed';
export type AgentLogLevel = 'debug' | 'info' | 'warn' | 'error';

// ---------------------------------------------------------------------------
// Event shapes — match `HObservation` in hudsonkit so HudLogger renders them
// natively. Spans are first-class for intent envelopes; logs for milestones.
// ---------------------------------------------------------------------------
interface BaseEvent {
  id: string;
  timestamp: number;
  category: 'agent-action';
  data: Record<string, unknown>;
}

interface LogEvent extends BaseEvent {
  kind: 'log';
  level: AgentLogLevel;
  message: string;
}

interface SpanEvent extends BaseEvent {
  kind: 'span';
  name: string;
  traceId: string;
  parentId?: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: 'active' | 'ok' | 'error';
  error?: { name?: string; message: string };
}

type WrittenEvent = LogEvent | SpanEvent;

const LOG_LEVELS = new Set<AgentLogLevel>(['debug', 'info', 'warn', 'error']);
const SPAN_STATUSES = new Set<SpanEvent['status']>(['active', 'ok', 'error']);

// ---------------------------------------------------------------------------
// File handle plumbing
// ---------------------------------------------------------------------------
let ensured = false;
async function ensureLogFile() {
  if (ensured) return;
  await mkdir(dirname(AGENT_LOG_FILE), { recursive: true });
  ensured = true;
}

function makeId(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}_${s}`;
}

export function makeTraceId(): string {
  return makeId('tr');
}

function serializeError(error: unknown): { name?: string; message: string } | undefined {
  if (!error) return undefined;
  if (error instanceof Error) return { name: error.name, message: error.message };
  if (typeof error === 'string') return { message: error };
  if (typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    const message = typeof obj.message === 'string' ? obj.message : JSON.stringify(error);
    const name = typeof obj.name === 'string' ? obj.name : undefined;
    return name ? { name, message } : { message };
  }
  return { message: String(error) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function recordField(record: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = record[key];
  return isRecord(value) ? value : undefined;
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

/** Strip secret-shaped keys from arbitrary payloads before they hit disk. */
function redactPayloadFields(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const action = typeof data.action === 'string'
    ? data.action
    : typeof data.playbook === 'string'
      ? data.playbook
      : undefined;
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (key === 'args') {
      out[key] = redactAgentActionValue(value, action ? [action] : []);
    } else if (key === 'metadata' || key === 'data') {
      out[key] = redactAgentActionValue(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Cap line size by replacing oversized payload fields with a marker. */
function fitLine(event: WrittenEvent): string {
  const serialized = JSON.stringify(event);
  if (Buffer.byteLength(serialized, 'utf-8') <= MAX_LINE_BYTES) return serialized;

  // Strip args/metadata/data first — typically the big ones.
  const trimmed: WrittenEvent = {
    ...event,
    data: {
      ...event.data,
      args: event.data.args === undefined ? undefined : TRUNCATION_MARKER,
      metadata: event.data.metadata === undefined ? undefined : TRUNCATION_MARKER,
      data: event.data.data === undefined ? undefined : TRUNCATION_MARKER,
    },
  };
  const trimmedSerialized = JSON.stringify(trimmed);
  if (Buffer.byteLength(trimmedSerialized, 'utf-8') <= MAX_LINE_BYTES) return trimmedSerialized;

  // Still too big — fall back to a stub that preserves the envelope.
  const stub: BaseEvent & { kind: WrittenEvent['kind'] } = {
    id: event.id,
    timestamp: event.timestamp,
    category: event.category,
    kind: event.kind,
    data: { truncated: true, originalKind: event.kind },
  };
  return JSON.stringify(stub);
}

async function writeEvent(event: WrittenEvent): Promise<void> {
  try {
    await ensureLogFile();
    await appendFile(AGENT_LOG_FILE, fitLine(event) + '\n', 'utf-8');
  } catch {
    // Logging must never break the request it's recording.
  }
}

// ---------------------------------------------------------------------------
// Public writer API — kind: 'log' and kind: 'span' have separate entries so
// callers can't accidentally emit a span-shaped log event or vice versa.
// ---------------------------------------------------------------------------

export interface AgentLogInput {
  message: string;
  level?: AgentLogLevel;
  triggeredBy?: 'server' | 'agent';
  source?: string;
  origin?: string;
  actor?: string;
  status?: AgentLogStatus;
  action?: string;
  playbook?: string;
  traceId?: string;
  appId?: string;
  appName?: string;
  workspaceId?: string;
  workspaceName?: string;
  target?: string;
  chatId?: string;
  args?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  data?: Record<string, unknown>;
  error?: unknown;
}

export async function appendAgentLog(input: AgentLogInput): Promise<void> {
  const event: LogEvent = {
    id: makeId('h'),
    kind: 'log',
    timestamp: Date.now(),
    category: 'agent-action',
    level: input.level ?? 'info',
    message: input.message,
    data: redactPayloadFields({
      triggeredBy: input.triggeredBy ?? 'server',
      source: input.source ?? 'server',
      origin: input.origin,
      actor: input.actor,
      status: input.status,
      playbook: input.playbook,
      action: input.action ?? input.playbook,
      traceId: input.traceId,
      target: input.target,
      appId: input.appId,
      appName: input.appName,
      workspaceId: input.workspaceId,
      workspaceName: input.workspaceName,
      chatId: input.chatId,
      args: input.args,
      metadata: input.metadata,
      data: input.data,
      error: serializeError(input.error),
    }),
  };
  await writeEvent(event);
}

export interface AgentTaskLogInput {
  status: AgentLogStatus;
  prompt?: string;
  message?: string;
  source?: string;
  origin?: string;
  actor?: string;
  action?: string;
  traceId?: string;
  appId?: string;
  appName?: string;
  workspaceId?: string;
  workspaceName?: string;
  target?: string;
  chatId?: string;
  args?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  error?: unknown;
}

export async function appendAgentTaskLog(input: AgentTaskLogInput): Promise<void> {
  const action = input.action ?? 'agent.task';
  await appendAgentLog({
    message: input.message ?? `agent.task.${input.status}`,
    level: input.status === 'failed' ? 'error' : 'info',
    triggeredBy: 'agent',
    source: input.source ?? 'cli',
    origin: input.origin ?? 'cli',
    actor: input.actor,
    status: input.status,
    action,
    playbook: action,
    traceId: input.traceId,
    appId: input.appId,
    appName: input.appName,
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    target: input.target,
    chatId: input.chatId,
    args: {
      ...(input.args ?? {}),
      ...(input.prompt ? { prompt: input.prompt } : {}),
    },
    metadata: input.metadata,
    error: input.error,
  });
}

export interface SpanStartInput {
  name: string;
  traceId: string;
  parentId?: string;
  source?: string;
  playbook?: string;
  appId?: string;
  workspaceId?: string;
  target?: string;
  args?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function appendAgentSpanStart(input: SpanStartInput): Promise<void> {
  const now = Date.now();
  const event: SpanEvent = {
    id: makeId('h'),
    kind: 'span',
    timestamp: now,
    category: 'agent-action',
    name: input.name,
    traceId: input.traceId,
    parentId: input.parentId,
    startTime: now,
    status: 'active',
    data: redactPayloadFields({
      triggeredBy: 'server',
      source: input.source ?? 'intent',
      playbook: input.playbook ?? input.name,
      action: input.name,
      appId: input.appId,
      workspaceId: input.workspaceId,
      target: input.target,
      args: input.args,
      metadata: input.metadata,
    }),
  };
  await writeEvent(event);
}

export interface SpanEndInput {
  name: string;
  traceId: string;
  startedAt: number;
  status: 'ok' | 'error';
  parentId?: string;
  source?: string;
  playbook?: string;
  appId?: string;
  workspaceId?: string;
  target?: string;
  metadata?: Record<string, unknown>;
  error?: unknown;
}

export async function appendAgentSpanEnd(input: SpanEndInput): Promise<void> {
  const now = Date.now();
  const event: SpanEvent = {
    id: makeId('h'),
    kind: 'span',
    timestamp: now,
    category: 'agent-action',
    name: input.name,
    traceId: input.traceId,
    parentId: input.parentId,
    startTime: input.startedAt,
    endTime: now,
    durationMs: Math.max(0, now - input.startedAt),
    status: input.status,
    error: serializeError(input.error),
    data: redactPayloadFields({
      triggeredBy: 'server',
      source: input.source ?? 'intent',
      playbook: input.playbook ?? input.name,
      action: input.name,
      appId: input.appId,
      workspaceId: input.workspaceId,
      target: input.target,
      metadata: input.metadata,
    }),
  };
  await writeEvent(event);
}

/** Persist a client-side HObservation exactly enough for HudLogger replay.
 *  The API route filters to agent-action observations; this writer validates
 *  shape, preserves ids/timestamps for live/replay dedupe, and redacts payloads. */
export async function appendAgentObservation(input: unknown): Promise<boolean> {
  if (!isRecord(input)) return false;
  const kind = stringField(input, 'kind');
  const id = stringField(input, 'id') ?? makeId('h');
  const timestamp = numberField(input, 'timestamp') ?? Date.now();
  const data = redactPayloadFields(recordField(input, 'data') ?? {});

  if (kind === 'log') {
    const rawLevel = stringField(input, 'level');
    const level = rawLevel && LOG_LEVELS.has(rawLevel as AgentLogLevel)
      ? rawLevel as AgentLogLevel
      : 'info';
    await writeEvent({
      id,
      kind: 'log',
      timestamp,
      category: 'agent-action',
      level,
      message: stringField(input, 'message') ?? 'hudson.agent.action',
      data,
    });
    return true;
  }

  if (kind === 'span') {
    const rawStatus = stringField(input, 'status');
    const status = rawStatus && SPAN_STATUSES.has(rawStatus as SpanEvent['status'])
      ? rawStatus as SpanEvent['status']
      : 'active';
    await writeEvent({
      id,
      kind: 'span',
      timestamp,
      category: 'agent-action',
      name: stringField(input, 'name') ?? 'hudson.agent.action',
      traceId: stringField(input, 'traceId') ?? id,
      parentId: stringField(input, 'parentId'),
      startTime: numberField(input, 'startTime') ?? timestamp,
      endTime: numberField(input, 'endTime'),
      durationMs: numberField(input, 'durationMs'),
      status,
      error: serializeError(input.error),
      data,
    });
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// hudsonLog — importable milestone logger
// ---------------------------------------------------------------------------

export interface LogPayload {
  data?: Record<string, unknown>;
  target?: string;
  args?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface LogContext {
  source?: string;
  playbook?: string;
  traceId?: string;
  appId?: string;
  workspaceId?: string;
  target?: string;
}

export interface HudsonLogger {
  /** Returns a promise that resolves once the entry is on disk. Callers
   *  may `void` the return for fire-and-forget, or `await` for durability. */
  info(message: string, payload?: LogPayload): Promise<void>;
  warn(message: string, payload?: LogPayload): Promise<void>;
  error(message: string, error?: unknown, payload?: LogPayload): Promise<void>;
  debug(message: string, payload?: LogPayload): Promise<void>;
  /** Bind a context that subsequent emits merge onto. Per-call payload
   *  fields override the scoped context where they collide (e.g. `target`). */
  scope(context: LogContext): HudsonLogger;
}

function emit(
  context: LogContext,
  level: AgentLogLevel,
  message: string,
  payload: LogPayload = {},
  error?: unknown,
): Promise<void> {
  return appendAgentLog({
    message,
    level,
    source: context.source,
    playbook: context.playbook,
    traceId: context.traceId,
    target: payload.target ?? context.target,
    appId: context.appId,
    workspaceId: context.workspaceId,
    args: payload.args,
    metadata: payload.metadata,
    data: payload.data,
    error,
  });
}

function makeLogger(context: LogContext): HudsonLogger {
  return {
    info: (msg, p) => emit(context, 'info', msg, p),
    warn: (msg, p) => emit(context, 'warn', msg, p),
    error: (msg, err, p) => emit(context, 'error', msg, p, err),
    debug: (msg, p) => emit(context, 'debug', msg, p),
    scope: (more) => makeLogger({ ...context, ...more }),
  };
}

export const hudsonLog: HudsonLogger = makeLogger({});

// ---------------------------------------------------------------------------
// Internals exposed for tests
// ---------------------------------------------------------------------------
export const __agentLogInternals = {
  MAX_LINE_BYTES,
  TRUNCATION_MARKER,
  fitLine: (event: WrittenEvent) => fitLine(event),
};
