'use client';

import { useMemo, useRef, useEffect } from 'react';
import { Volume2, MessageCircle, Radio, Zap } from 'lucide-react';
import { useOpenScout, type ChannelEntry } from './OpenScoutProvider';

// ---------------------------------------------------------------------------
// Message parsing — extract tags, mentions, and body from relay messages
// ---------------------------------------------------------------------------

interface ParsedMessage {
  tags: { type: string; id?: string }[];    // [ask:id], [speak], [reply:id]
  mentions: string[];                        // @operator, @hudson
  body: string;                              // Clean message text
  isSystem: boolean;
}

function parseMessage(entry: ChannelEntry): ParsedMessage {
  const isSystem = entry.type === 'SYS';
  let raw = entry.message;

  // Extract [tag:id] or [tag] brackets
  const tags: ParsedMessage['tags'] = [];
  raw = raw.replace(/\[(\w+)(?::([^\]]+))?\]\s*/g, (_, type, id) => {
    tags.push({ type, id });
    return '';
  });

  // Extract @mentions
  const mentions: string[] = [];
  raw = raw.replace(/@([\w.-]+)/g, (_, name) => {
    mentions.push(name);
    return `@${name}`; // keep in body for display
  });

  return { tags, mentions, body: raw.trim(), isSystem };
}

// ---------------------------------------------------------------------------
// Tag badge component
// ---------------------------------------------------------------------------

function TagBadge({ tag }: { tag: { type: string; id?: string } }) {
  const config: Record<string, { icon: typeof Zap; color: string; label: string }> = {
    ask: { icon: MessageCircle, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', label: 'ask' },
    reply: { icon: Zap, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'reply' },
    speak: { icon: Volume2, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', label: 'speak' },
  };

  const c = config[tag.type] ?? { icon: Radio, color: 'text-white/30 bg-white/5 border-white/10', label: tag.type };
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border ${c.color}`}>
      <Icon size={9} />
      {c.label}
      {tag.id && <span className="text-white/20">{tag.id.slice(0, 12)}</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Render message body with highlighted @mentions
// ---------------------------------------------------------------------------

function MessageBody({ text }: { text: string }) {
  const parts = text.split(/(@[\w.-]+)/g);
  return (
    <span>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="text-cyan-400 font-medium">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Single message row
// ---------------------------------------------------------------------------

const AGENT_COLORS: Record<string, string> = {
  operator: 'text-cyan-400',
  arach: 'text-cyan-400',
  system: 'text-white/20',
  hudson: 'text-emerald-400',
  dev: 'text-blue-400',
  logos: 'text-amber-400',
  test: 'text-rose-400',
};

function MessageRow({ entry }: { entry: ChannelEntry }) {
  const parsed = useMemo(() => parseMessage(entry), [entry]);

  if (parsed.isSystem) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 text-[10px] text-white/15 font-mono">
        <span className="tabular-nums shrink-0 w-[40px]">
          {new Date(entry.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="text-white/8">·</span>
        <span className="text-white/12">{entry.agent}</span>
        <span className="text-white/8">{parsed.body}</span>
      </div>
    );
  }

  const agentColor = AGENT_COLORS[entry.agent] ?? 'text-white/50';
  const hasAsk = parsed.tags.some(t => t.type === 'ask');

  return (
    <div className={`group flex gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-white/[0.02] ${hasAsk ? 'border-l-2 border-cyan-500/20 pl-2.5' : ''}`}>
      {/* Timestamp */}
      <span className="text-[10px] text-white/15 tabular-nums shrink-0 pt-0.5 font-mono w-[40px]">
        {new Date(entry.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Agent name + tags */}
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[12px] font-semibold ${agentColor}`}>{entry.agent}</span>
          {parsed.tags.map((tag, i) => (
            <TagBadge key={i} tag={tag} />
          ))}
        </div>

        {/* Message body */}
        <div className="text-[12px] text-white/60 leading-relaxed break-words">
          <MessageBody text={parsed.body} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Channel content
// ---------------------------------------------------------------------------

export function OpenScoutContent() {
  const { channel, selectedAgent, error } = useOpenScout();
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredChannel = useMemo(() =>
    selectedAgent
      ? channel.filter(e => e.agent === selectedAgent)
      : channel,
    [channel, selectedAgent],
  );

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filteredChannel.length]);

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div className="px-4 py-2 text-xs text-red-400 bg-red-500/10 border-b border-red-500/20">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-2 border-b border-white/[0.04]">
        <span className="text-[9px] font-mono uppercase tracking-widest text-white/20">
          {selectedAgent ? `${selectedAgent}` : 'Channel'}
        </span>
        <span className="text-[9px] text-white/10 ml-2">{filteredChannel.length} messages</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-1 frame-scrollbar">
        {filteredChannel.map((entry, i) => (
          <MessageRow key={`${entry.timestamp}-${i}`} entry={entry} />
        ))}
        {filteredChannel.length === 0 && (
          <div className="text-[11px] text-white/15 mt-8 text-center">No messages</div>
        )}
      </div>
    </div>
  );
}
