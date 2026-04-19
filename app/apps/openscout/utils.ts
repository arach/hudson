'use client';

export type OpenScoutActivityFilter = 'all' | 'ask' | 'reply' | 'speak' | 'system';

interface OpenScoutMessageLike {
  type: string;
  message: string;
}

export interface OpenScoutTag {
  type: string;
  id?: string;
}

export interface ParsedOpenScoutMessage {
  tags: OpenScoutTag[];
  mentions: string[];
  body: string;
  isSystem: boolean;
}

const OPENSCOUT_ONLINE_WINDOW_SECONDS = 300;

export function isOpenScoutAgentOnline(timestampSeconds: number): boolean {
  if (!timestampSeconds) return false;
  return Math.floor(Date.now() / 1000) - timestampSeconds < OPENSCOUT_ONLINE_WINDOW_SECONDS;
}

export function formatOpenScoutRelativeTime(timestampSeconds: number): string {
  if (!timestampSeconds) return 'never';
  const diff = Math.floor(Date.now() / 1000) - timestampSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function formatOpenScoutAbsoluteTime(timestampSeconds: number): string {
  if (!timestampSeconds) return '—';
  return new Date(timestampSeconds * 1000).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function parseOpenScoutMessage(entry: OpenScoutMessageLike): ParsedOpenScoutMessage {
  const isSystem = entry.type === 'SYS';
  let raw = entry.message;

  const tags: OpenScoutTag[] = [];
  raw = raw.replace(/\[(\w+)(?::([^\]]+))?\]\s*/g, (_, type: string, id?: string) => {
    tags.push({ type, id });
    return '';
  });

  const mentions: string[] = [];
  raw = raw.replace(/@([\w.-]+)/g, (_, name: string) => {
    mentions.push(name);
    return `@${name}`;
  });

  return { tags, mentions, body: raw.trim(), isSystem };
}

export function matchesOpenScoutActivityFilter(
  entry: OpenScoutMessageLike,
  filter: OpenScoutActivityFilter,
): boolean {
  if (filter === 'all') return true;
  const parsed = parseOpenScoutMessage(entry);
  if (filter === 'system') return parsed.isSystem;
  if (parsed.isSystem) return false;
  return parsed.tags.some(tag => tag.type === filter);
}
