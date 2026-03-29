import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

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

// SYS messages that are pure noise — never send to the UI
const SYS_HIDDEN = new Set(['heartbeat', 'watcher-delivery']);

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

export async function GET() {
  const relayDir = join(homedir(), '.openscout', 'relay');

  try {
    const [agentsRaw, channelRaw] = await Promise.all([
      readFile(join(relayDir, 'agents.json'), 'utf-8').catch(() => '{}'),
      readFile(join(relayDir, 'channel.log'), 'utf-8').catch(() => ''),
    ]);

    const agents: Record<string, AgentRecord> = JSON.parse(agentsRaw);
    const channelEntries = parseChannelLog(channelRaw);

    // Build message counts & last seen per agent from channel log
    const stats: Record<string, { messageCount: number; lastSeen: number }> = {};
    for (const entry of channelEntries) {
      if (entry.type === 'SYS') continue;
      const s = stats[entry.agent] ??= { messageCount: 0, lastSeen: 0 };
      s.messageCount++;
      if (entry.timestamp > s.lastSeen) s.lastSeen = entry.timestamp;
    }

    // Merge agents.json with channel stats
    const allNames = new Set([...Object.keys(agents), ...Object.keys(stats)]);
    const merged = Array.from(allNames)
      .filter((name) => name !== '/' && name !== 'undefined')
      .map((name) => ({
        name,
        project: agents[name]?.project ?? name,
        cwd: agents[name]?.cwd ?? null,
        pid: agents[name]?.pid ?? null,
        registered: !!agents[name],
        messageCount: stats[name]?.messageCount ?? 0,
        lastSeen: stats[name]?.lastSeen ?? agents[name]?.registered_at ?? 0,
      }))
      .sort((a, b) => b.lastSeen - a.lastSeen);

    return NextResponse.json({ agents: merged, channelEntries: channelEntries.slice(-50) });
  } catch {
    return NextResponse.json({ agents: [], channelEntries: [] });
  }
}
