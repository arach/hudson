import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { basename, join } from 'path';

interface AgentRecord {
  pane: string;
  cwd: string;
  project: string;
  session_id: string;
  registered_at: number;
  pid: number;
}

interface ChannelEntry {
  timestamp: number;
  agent: string;
  type: string;
  message: string;
  /** For SYS messages: lifecycle, heartbeat, monitoring, watcher, etc. */
  subtype?: string;
}

interface BrokerAgentRecord {
  id: string;
  displayName?: string;
  handle?: string;
  selector?: string;
  defaultSelector?: string;
  metadata?: Record<string, unknown>;
}

interface BrokerEndpointRecord {
  id: string;
  agentId: string;
  state?: string;
  cwd?: string | null;
  projectRoot?: string | null;
  metadata?: Record<string, unknown>;
}

interface BrokerMessageRecord {
  id: string;
  actorId: string;
  class: string;
  body: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

interface BrokerSnapshot {
  agents?: Record<string, BrokerAgentRecord>;
  endpoints?: Record<string, BrokerEndpointRecord>;
}

const DEFAULT_BROKER_HOST = process.env.OPENSCOUT_BROKER_HOST ?? '127.0.0.1';
const DEFAULT_BROKER_PORT = process.env.OPENSCOUT_BROKER_PORT ?? '65535';
const DEFAULT_BROKER_URL = process.env.OPENSCOUT_BROKER_URL ?? `http://${DEFAULT_BROKER_HOST}:${DEFAULT_BROKER_PORT}`;

// SYS messages to hide — per OpenScout's recommendation:
// heartbeat, monitoring, joined/left/enrolled are lifecycle noise.
// Keep: twin spawned/stopped, forgotten, nudge, restart, linked.
const SYS_HIDE_PATTERNS: RegExp[] = [
  /^heartbeat$/,
  /monitoring the relay$/,
  /stopped monitoring$/,
  /joined the relay$/,
  /left the relay$/,
  /^enrolled$/,
  /^watcher-delivery$/,
];

// Classify remaining SYS messages for UI rendering
const SYS_SUBTYPE_PATTERNS: [RegExp, string][] = [
  [/^twin spawned/, 'lifecycle'],
  [/^twin stopped/, 'lifecycle'],
  [/^all twins stopped$/, 'lifecycle'],
  [/linked .+ to the relay$/, 'lifecycle'],
  [/forgotten by/, 'lifecycle'],
  [/^nudge/, 'nudge'],
  [/restart/, 'lifecycle'],
  [/online —/, 'session'],
];

function classifySys(body: string): string {
  for (const [re, subtype] of SYS_SUBTYPE_PATTERNS) {
    if (re.test(body)) return subtype;
  }
  return 'system';
}

function shouldHideSys(body: string): boolean {
  return SYS_HIDE_PATTERNS.some(re => re.test(body));
}

function parseChannelLog(raw: string): ChannelEntry[] {
  const entries: ChannelEntry[] = [];
  for (const line of raw.split('\n')) {
    const match = line.match(/^(\d+)\s+(\S+)\s+(MSG|SYS)\s+(.*)$/);
    if (!match) continue;

    const type = match[3];
    const message = match[4];

    // Filter out noise SYS messages
    if (type === 'SYS' && shouldHideSys(message)) continue;

    const entry: ChannelEntry = {
      timestamp: parseInt(match[1], 10),
      agent: match[2],
      type,
      message,
    };

    if (type === 'SYS') {
      entry.subtype = classifySys(message);
    }

    entries.push(entry);
  }
  return entries;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function readMetadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return isNonEmptyString(value) ? value : undefined;
}

function normalizeEpochSeconds(value: unknown): number {
  let numeric = 0;

  if (typeof value === 'number') {
    numeric = value;
  } else if (typeof value === 'string' && value.trim().length > 0) {
    numeric = Number(value);
  }

  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric > 1_000_000_000_000 ? Math.floor(numeric / 1000) : Math.floor(numeric);
}

function maxEpochSeconds(...values: unknown[]): number {
  let max = 0;
  for (const value of values) {
    const normalized = normalizeEpochSeconds(value);
    if (normalized > max) max = normalized;
  }
  return max;
}

function normalizeHandle(value: string | undefined): string | undefined {
  if (!isNonEmptyString(value)) return undefined;
  const normalized = value.replace(/^@/, '').trim();
  return normalized.length > 0 ? normalized : undefined;
}

function extractBrokerAgentHandle(agentId: string, agent: BrokerAgentRecord): string {
  return (
    normalizeHandle(readMetadataString(agent.metadata, 'agentName')) ??
    normalizeHandle(agent.handle) ??
    normalizeHandle(agent.defaultSelector) ??
    normalizeHandle(agent.selector) ??
    normalizeHandle(agent.displayName) ??
    agentId
  );
}

function extractBrokerProjectName(
  handle: string,
  agent: BrokerAgentRecord | undefined,
  endpoint: BrokerEndpointRecord | undefined,
): string {
  const endpointProject = readMetadataString(endpoint?.metadata, 'project');
  if (endpointProject) return endpointProject;

  const agentProject = readMetadataString(agent?.metadata, 'project');
  if (agentProject) return agentProject;

  const cwd = endpoint?.cwd ?? endpoint?.projectRoot ?? readMetadataString(agent?.metadata, 'projectRoot');
  if (cwd) return basename(cwd);

  return agent?.displayName ?? handle;
}

function buildBrokerAliasMap(agents: Record<string, BrokerAgentRecord>): Map<string, string> {
  const aliases = new Map<string, string>();

  for (const [agentId, agent] of Object.entries(agents)) {
    const handle = extractBrokerAgentHandle(agentId, agent);
    aliases.set(agentId, handle);
    aliases.set(handle, handle);

    const selector = normalizeHandle(agent.selector);
    if (selector) aliases.set(selector, handle);

    const defaultSelector = normalizeHandle(agent.defaultSelector);
    if (defaultSelector) aliases.set(defaultSelector, handle);

    const metadataHandle = normalizeHandle(readMetadataString(agent.metadata, 'agentName'));
    if (metadataHandle) aliases.set(metadataHandle, handle);

    const instanceId = normalizeHandle(readMetadataString(agent.metadata, 'instanceId'));
    if (instanceId) aliases.set(instanceId, handle);
  }

  return aliases;
}

function normalizeBrokerActor(actorId: string, aliases: Map<string, string>): string {
  return aliases.get(actorId) ?? normalizeHandle(actorId) ?? actorId;
}

function brokerEndpointTimestamp(endpoint: BrokerEndpointRecord | undefined): number {
  return maxEpochSeconds(
    endpoint?.metadata?.startedAt,
    endpoint?.metadata?.lastStartedAt,
    endpoint?.metadata?.lastCompletedAt,
    endpoint?.metadata?.lastFailedAt,
  );
}

function endpointScore(endpoint: BrokerEndpointRecord): number {
  if (endpoint.state && endpoint.state !== 'offline') return 2;
  if (endpoint.state === 'offline') return 1;
  return 0;
}

function preferEndpoint(current: BrokerEndpointRecord | undefined, candidate: BrokerEndpointRecord): BrokerEndpointRecord {
  if (!current) return candidate;

  const currentScore = endpointScore(current);
  const candidateScore = endpointScore(candidate);
  if (candidateScore !== currentScore) {
    return candidateScore > currentScore ? candidate : current;
  }

  return brokerEndpointTimestamp(candidate) >= brokerEndpointTimestamp(current) ? candidate : current;
}

function classifyBrokerSystem(message: BrokerMessageRecord): string {
  const body = message.body.toLowerCase();
  if (body.includes('failed')) return 'error';
  if (body.includes('working')) return 'status';
  return 'system';
}

function brokerMessageToChannelEntry(
  message: BrokerMessageRecord,
  aliases: Map<string, string>,
): ChannelEntry {
  const timestamp = normalizeEpochSeconds(message.createdAt);
  const agent = normalizeBrokerActor(message.actorId, aliases);

  if (message.class === 'status') {
    return {
      timestamp,
      agent,
      type: 'SYS',
      message: message.body,
      subtype: classifyBrokerSystem(message),
    };
  }

  let prefix = '';
  if (message.metadata?.source === 'scout-cli') {
    prefix = `[ask:${message.id}] `;
  } else if (
    message.metadata?.invocationId ||
    message.metadata?.flightId ||
    message.metadata?.responderHarness ||
    message.metadata?.requestedReturnAddress
  ) {
    prefix = `[reply:${message.id}] `;
  }

  const route = readMetadataString(message.metadata, 'route');
  if (route === 'voice') {
    prefix = `[speak] ${prefix}`;
  }

  return {
    timestamp,
    agent,
    type: 'MSG',
    message: `${prefix}${message.body}`.trim(),
  };
}

async function readBrokerJson<T>(path: string): Promise<T> {
  const url = new URL(path, DEFAULT_BROKER_URL);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Broker request failed for ${url.pathname}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function loadBrokerSnapshot(): Promise<{ agents: Array<{
  name: string;
  project: string;
  cwd: string | null;
  pid: number | null;
  registered: boolean;
  messageCount: number;
  lastSeen: number;
}>; channelEntries: ChannelEntry[] } | null> {
  try {
    const [snapshot, messages] = await Promise.all([
      readBrokerJson<BrokerSnapshot>('/v1/snapshot'),
      readBrokerJson<BrokerMessageRecord[]>('/v1/messages?limit=200'),
    ]);

    const brokerAgents = snapshot.agents ?? {};
    const aliases = buildBrokerAliasMap(brokerAgents);
    const normalizedAgents = new Map<string, BrokerAgentRecord>();
    for (const [agentId, agent] of Object.entries(brokerAgents)) {
      normalizedAgents.set(extractBrokerAgentHandle(agentId, agent), agent);
    }

    const endpointsByAgent = new Map<string, BrokerEndpointRecord>();
    for (const endpoint of Object.values(snapshot.endpoints ?? {})) {
      const handle = normalizeBrokerActor(endpoint.agentId, aliases);
      endpointsByAgent.set(handle, preferEndpoint(endpointsByAgent.get(handle), endpoint));
    }

    const activityStats = new Map<string, { messageCount: number; lastSeen: number }>();
    const channelEntries = messages.map((message) => brokerMessageToChannelEntry(message, aliases));
    for (const entry of channelEntries) {
      if (entry.type === 'SYS') continue;
      const stats = activityStats.get(entry.agent) ?? { messageCount: 0, lastSeen: 0 };
      stats.messageCount += 1;
      stats.lastSeen = Math.max(stats.lastSeen, entry.timestamp);
      activityStats.set(entry.agent, stats);
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const handles = new Set<string>([
      ...normalizedAgents.keys(),
      ...activityStats.keys(),
      ...endpointsByAgent.keys(),
    ]);

    const agents = Array.from(handles)
      .filter((handle) => handle !== 'system' && handle !== '/' && handle !== 'undefined')
      .map((handle) => {
        const agent = normalizedAgents.get(handle);
        const endpoint = endpointsByAgent.get(handle);
        const stats = activityStats.get(handle);
        const endpointSeenAt = brokerEndpointTimestamp(endpoint);
        const live = Boolean(endpoint?.state && endpoint.state !== 'offline');
        const cwd = endpoint?.cwd ?? endpoint?.projectRoot ?? readMetadataString(agent?.metadata, 'projectRoot') ?? null;

        return {
          name: handle,
          project: extractBrokerProjectName(handle, agent, endpoint),
          cwd,
          pid: null,
          registered: Boolean(agent || endpoint),
          messageCount: stats?.messageCount ?? 0,
          lastSeen: live
            ? nowSeconds
            : Math.max(
                stats?.lastSeen ?? 0,
                endpointSeenAt,
                maxEpochSeconds(
                  agent?.metadata?.registeredAt,
                  agent?.metadata?.startedAt,
                ),
              ),
        };
      })
      .sort((left, right) => right.lastSeen - left.lastSeen);

    return {
      agents,
      channelEntries: channelEntries.slice(-50),
    };
  } catch {
    return null;
  }
}

async function loadLegacyRelayData() {
  const relayDir = join(homedir(), '.openscout', 'relay');
  const [agentsRaw, channelRaw] = await Promise.all([
    readFile(join(relayDir, 'agents.json'), 'utf-8').catch(() => '{}'),
    readFile(join(relayDir, 'channel.log'), 'utf-8').catch(() => ''),
  ]);

  const agents: Record<string, AgentRecord> = JSON.parse(agentsRaw);
  const channelEntries = parseChannelLog(channelRaw);

  const stats: Record<string, { messageCount: number; lastSeen: number }> = {};
  for (const entry of channelEntries) {
    if (entry.type === 'SYS') continue;
    const record = stats[entry.agent] ??= { messageCount: 0, lastSeen: 0 };
    record.messageCount += 1;
    if (entry.timestamp > record.lastSeen) record.lastSeen = entry.timestamp;
  }

  const merged = Array.from(new Set([...Object.keys(agents), ...Object.keys(stats)]))
    .filter((name) => name !== '/' && name !== 'undefined')
    .map((name) => ({
      name,
      project: agents[name]?.project ?? name,
      cwd: agents[name]?.cwd ?? null,
      pid: agents[name]?.pid ?? null,
      registered: Boolean(agents[name]),
      messageCount: stats[name]?.messageCount ?? 0,
      lastSeen: stats[name]?.lastSeen ?? agents[name]?.registered_at ?? 0,
    }))
    .sort((left, right) => right.lastSeen - left.lastSeen);

  return { agents: merged, channelEntries: channelEntries.slice(-50) };
}

export async function GET() {
  try {
    const brokerData = await loadBrokerSnapshot();
    if (brokerData) {
      return NextResponse.json(brokerData);
    }

    return NextResponse.json(await loadLegacyRelayData());
  } catch {
    return NextResponse.json({ agents: [], channelEntries: [] });
  }
}
