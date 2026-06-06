import type { HObservation } from '../types/observability';

export type HudAgentActionViewMode = 'actions' | 'details' | 'raw';

export interface AgentActionTraceSummary {
  traceId: string;
  eventCount: number;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  hiddenDetailEvents: number;
}

export interface AgentActionViewResult {
  events: HObservation[];
  hiddenDetailEvents: number;
  collapsedEvents: number;
  relatedEventsByTrace: Map<string, HObservation[]>;
}

const TRACE_SUMMARY_KEY = 'hudsonTrace';
const READ_COMMANDS = new Set([
  'cat',
  'find',
  'fd',
  'grep',
  'head',
  'ls',
  'pwd',
  'rg',
  'sed',
  'tail',
  'wc',
  'which',
]);
const READONLY_GIT_COMMANDS = new Set([
  'branch',
  'diff',
  'ls-files',
  'log',
  'rev-parse',
  'show',
  'status',
]);
const GENERIC_AGENT_ACTIONS = new Set(['', 'agent.task']);

export function prepareHudAgentActionEvents(
  events: readonly HObservation[],
  mode: HudAgentActionViewMode,
): AgentActionViewResult {
  const agentEvents = events.filter(isAgentActionEvent);
  const relatedEventsByTrace = buildRelatedEventsByTrace(agentEvents);

  if (mode === 'raw') {
    return {
      events: agentEvents,
      hiddenDetailEvents: 0,
      collapsedEvents: 0,
      relatedEventsByTrace,
    };
  }

  const groups = groupByOwnTrace(agentEvents);
  const rows: HObservation[] = [];
  let rawEventsInVisibleRows = 0;

  for (const group of groups.values()) {
    const showGroup = mode === 'details' || isUserLevelActionGroup(group);
    if (!showGroup) continue;
    rawEventsInVisibleRows += group.length;
    rows.push(representativeEvent(group));
  }

  return {
    events: rows,
    hiddenDetailEvents: Math.max(0, agentEvents.length - rawEventsInVisibleRows),
    collapsedEvents: Math.max(0, rawEventsInVisibleRows - rows.length),
    relatedEventsByTrace,
  };
}

export function isAgentActionEvent(event: HObservation) {
  const data = eventData(event);
  return (
    event.category === 'agent-action' ||
    data.triggeredBy === 'agent' ||
    data.source === 'workspace-ai'
  );
}

export function eventData(event: HObservation): Record<string, unknown> {
  return event.data && typeof event.data === 'object' && !Array.isArray(event.data)
    ? event.data
    : {};
}

export function dataString(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

export function agentActionTraceId(event: HObservation): string | null {
  if (event.kind === 'span') return event.traceId;
  return dataString(eventData(event), 'traceId');
}

export function agentActionParentTraceId(event: HObservation): string | null {
  return dataString(eventData(event), 'parentTraceId');
}

export function agentActionCommand(event: HObservation): string[] | null {
  const metadata = eventData(event).metadata;
  if (!isRecord(metadata)) return null;
  const command = metadata.command;
  if (Array.isArray(command) && command.every(part => typeof part === 'string')) return command;
  if (typeof command === 'string' && command.trim()) return command.trim().split(/\s+/);
  return null;
}

export function isNoisyAgentCommand(command: readonly string[] | null): boolean {
  if (!command || command.length === 0) return false;
  const executable = commandBaseName(command[0]);
  if (READ_COMMANDS.has(executable)) return true;
  if (executable === 'git') {
    const subcommand = command.find((part, index) => index > 0 && !part.startsWith('-'));
    return subcommand ? READONLY_GIT_COMMANDS.has(subcommand) : false;
  }
  return false;
}

export function inferAgentActionAppId(event: HObservation): string | null {
  const data = eventData(event);
  const explicit =
    dataString(data, 'appId') ??
    dataString(data, 'targetAppId');
  if (explicit) return explicit;

  const action = dataString(data, 'action') ?? dataString(data, 'playbook') ?? dataString(data, 'commandId');
  const appFromAction = inferAppIdFromAction(action);
  if (appFromAction) return appFromAction;

  const command = agentActionCommand(event);
  for (const part of command ?? []) {
    const appFromPath = inferAppIdFromPath(part);
    if (appFromPath) return appFromPath;
  }

  return null;
}

export function agentActionTraceSummary(event: HObservation): AgentActionTraceSummary | null {
  const value = eventData(event)[TRACE_SUMMARY_KEY];
  if (!isRecord(value)) return null;
  const traceId = dataString(value, 'traceId');
  const eventCount = numberField(value, 'eventCount');
  const startedAt = numberField(value, 'startedAt');
  const endedAt = numberField(value, 'endedAt');
  const durationMs = numberField(value, 'durationMs');
  const hiddenDetailEvents = numberField(value, 'hiddenDetailEvents') ?? 0;
  if (!traceId || eventCount === undefined || startedAt === undefined || endedAt === undefined || durationMs === undefined) {
    return null;
  }
  return { traceId, eventCount, startedAt, endedAt, durationMs, hiddenDetailEvents };
}

export function summarizeAgentActionCommand(command: readonly string[] | null): string | null {
  if (!command || command.length === 0) return null;
  const executable = commandBaseName(command[0]);
  const target = command.map(inferLabelPath).find(Boolean);

  if (isNoisyAgentCommand(command)) {
    return target ? `Read ${target} with ${executable}` : `Read with ${executable}`;
  }

  if (executable === 'bun' && command[1] === 'run' && command[2]) {
    return `Run bun ${command[2]}`;
  }

  return command.slice(0, 4).join(' ');
}

export function formatAgentActionName(action: string | null): string {
  if (!action || action === 'agent.task') return 'Agent task';
  const normalized = action
    .replace(/^hudson\./, '')
    .replace(/[._:-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized
    .split(' ')
    .map((part, index) => index === 0 ? capitalize(part) : part)
    .join(' ');
}

function groupByOwnTrace(events: readonly HObservation[]) {
  const groups = new Map<string, HObservation[]>();
  for (const event of events) {
    const traceId = agentActionTraceId(event) ?? event.id;
    const group = groups.get(traceId);
    if (group) {
      group.push(event);
    } else {
      groups.set(traceId, [event]);
    }
  }
  return groups;
}

function buildRelatedEventsByTrace(events: readonly HObservation[]) {
  const byTrace = new Map<string, HObservation[]>();
  const append = (traceId: string | null, event: HObservation) => {
    if (!traceId) return;
    const list = byTrace.get(traceId);
    if (list) {
      if (!list.some(existing => existing.id === event.id)) list.push(event);
    } else {
      byTrace.set(traceId, [event]);
    }
  };

  for (const event of events) {
    append(agentActionTraceId(event) ?? event.id, event);
    append(agentActionParentTraceId(event), event);
    append(event.kind === 'span' ? event.parentId ?? null : null, event);
  }

  for (const list of byTrace.values()) {
    list.sort((left, right) => left.timestamp - right.timestamp);
  }
  return byTrace;
}

function representativeEvent(group: readonly HObservation[]): HObservation {
  const ordered = [...group].sort((left, right) => left.timestamp - right.timestamp);
  const representative =
    findLatest(ordered, event => terminalRank(event) === 3) ??
    findLatest(ordered, event => terminalRank(event) === 2) ??
    findLatest(ordered, event => terminalRank(event) === 1) ??
    ordered[ordered.length - 1];

  const traceId = agentActionTraceId(representative) ?? representative.id;
  const startedAt = ordered[0]?.timestamp ?? representative.timestamp;
  const endedAt = ordered[ordered.length - 1]?.timestamp ?? representative.timestamp;
  return {
    ...representative,
    data: {
      ...eventData(representative),
      [TRACE_SUMMARY_KEY]: {
        traceId,
        eventCount: ordered.length,
        startedAt,
        endedAt,
        durationMs: Math.max(0, endedAt - startedAt),
        hiddenDetailEvents: Math.max(0, ordered.length - 1),
      },
    },
  };
}

function isUserLevelActionGroup(group: readonly HObservation[]) {
  if (group.every(event => agentActionParentTraceId(event))) return false;
  return group.some(event => {
    if (event.kind === 'span') return true;
    const data = eventData(event);
    const action = dataString(data, 'action') ?? dataString(data, 'playbook') ?? '';
    const hasExplicitAction = !GENERIC_AGENT_ACTIONS.has(action);
    const command = agentActionCommand(event);
    if (hasExplicitAction) return true;
    if (dataString(data, 'commandId')) return true;
    if (inferAgentActionAppId(event) && !command) return true;
    if (hasPrompt(data) && !isNoisyAgentCommand(command)) return true;
    return Boolean(command && !isNoisyAgentCommand(command));
  });
}

function hasPrompt(data: Record<string, unknown>) {
  const args = data.args;
  return isRecord(args) && typeof args.prompt === 'string' && args.prompt.trim().length > 0;
}

function terminalRank(event: HObservation) {
  if (event.kind === 'span') {
    if (event.status === 'error') return 3;
    if (event.status === 'ok') return 2;
    if (event.status === 'active') return 1;
    return 0;
  }

  const status = dataString(eventData(event), 'status') ?? (event.kind === 'log' ? event.level : undefined);
  if (status === 'failed' || status === 'error') return 3;
  if (status === 'completed' || status === 'ok') return 2;
  if (status === 'started' || status === 'active') return 1;
  return 0;
}

function findLatest(
  events: readonly HObservation[],
  predicate: (event: HObservation) => boolean,
): HObservation | undefined {
  for (let index = events.length - 1; index >= 0; index--) {
    if (predicate(events[index])) return events[index];
  }
  return undefined;
}

function inferAppIdFromAction(action: string | null) {
  if (!action) return null;
  const [prefix] = action.split(/[.:_-]/);
  return prefix || null;
}

function inferAppIdFromPath(path: string) {
  const appMatch = path.match(/(?:^|\/)app\/apps\/([^/\s]+)/);
  if (appMatch) return appMatch[1];
  return null;
}

function inferLabelPath(path: string) {
  const appId = inferAppIdFromPath(path);
  if (appId) return appId;
  return null;
}

function commandBaseName(command: string) {
  return command.split('/').pop() ?? command;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function capitalize(value: string) {
  if (!value) return value;
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}
