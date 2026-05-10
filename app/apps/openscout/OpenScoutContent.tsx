'use client';

import { useMemo, useRef, useEffect } from 'react';
import { Volume2, MessageCircle, Radio, Zap } from 'lucide-react';
import { useOpenScout, type ChannelEntry } from './OpenScoutProvider';
import { type OpenScoutActivityFilter, parseOpenScoutMessage } from './utils';

const FILTER_OPTIONS: Array<{ id: OpenScoutActivityFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'ask', label: 'Asks' },
  { id: 'reply', label: 'Replies' },
  { id: 'speak', label: 'Voice' },
  { id: 'system', label: 'System' },
];

// ---------------------------------------------------------------------------
// Tag badge component
// ---------------------------------------------------------------------------

function TagBadge({ tag }: { tag: { type: string; id?: string } }) {
  const config: Record<string, { icon: typeof Zap; color: string; label: string }> = {
    ask: { icon: MessageCircle, color: 'text-cyan-700 dark:text-cyan-400 bg-cyan-700/10 dark:bg-cyan-500/10 border-cyan-700/30 dark:border-cyan-500/20', label: 'ask' },
    reply: { icon: Zap, color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-700/10 dark:bg-emerald-500/10 border-emerald-700/30 dark:border-emerald-500/20', label: 'reply' },
    speak: { icon: Volume2, color: 'text-amber-700 dark:text-amber-400 bg-amber-700/10 dark:bg-amber-500/10 border-amber-700/30 dark:border-amber-500/20', label: 'speak' },
  };

  const c = config[tag.type] ?? { icon: Radio, color: 'text-muted-foreground bg-muted/40 border-border/40', label: tag.type };
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border ${c.color}`}>
      <Icon size={9} />
      {c.label}
      {tag.id && <span className="text-muted-foreground/60">{tag.id.slice(0, 12)}</span>}
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
          <span key={i} className="text-cyan-700 dark:text-cyan-400 font-medium">{part}</span>
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
  operator: 'text-cyan-700 dark:text-cyan-400',
  arach: 'text-cyan-700 dark:text-cyan-400',
  system: 'text-muted-foreground/60',
  hudson: 'text-emerald-700 dark:text-emerald-400',
  dev: 'text-blue-700 dark:text-blue-400',
  logos: 'text-amber-700 dark:text-amber-400',
  test: 'text-rose-700 dark:text-rose-400',
};

function MessageRow({ entry }: { entry: ChannelEntry }) {
  const parsed = useMemo(() => parseOpenScoutMessage(entry), [entry]);

  if (parsed.isSystem) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 text-[10px] text-muted-foreground/70 font-mono">
        <span className="tabular-nums shrink-0 w-[40px]">
          {new Date(entry.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-muted-foreground/60">{entry.agent}</span>
        <span className="text-muted-foreground/50">{parsed.body}</span>
      </div>
    );
  }

  const agentColor = AGENT_COLORS[entry.agent] ?? 'text-muted-foreground';
  const hasAsk = parsed.tags.some(t => t.type === 'ask');

  return (
    <div className={`group flex gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-muted/40 ${hasAsk ? 'border-l-2 border-cyan-700/30 dark:border-cyan-500/20 pl-2.5' : ''}`}>
      {/* Timestamp */}
      <span className="text-[10px] text-muted-foreground/70 tabular-nums shrink-0 pt-0.5 font-mono w-[40px]">
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
        <div className="text-[12px] text-foreground/72 leading-relaxed break-words">
          <MessageBody text={parsed.body} />
        </div>
      </div>
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-border/60 bg-card/60 px-2.5 py-1">
      <span className="text-[8px] font-mono uppercase tracking-[0.18em] text-muted-foreground/70">{label}</span>
      <span className="ml-2 text-[10px] font-mono text-foreground/72">{value}</span>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[10px] font-mono transition-colors ${
        active
          ? 'border-cyan-700/40 dark:border-cyan-500/25 bg-cyan-700/10 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
          : 'border-border/60 bg-card/60 text-muted-foreground hover:text-foreground/72'
      }`}
    >
      <span>{label}</span>
      <span className="ml-1.5 text-[9px] text-muted-foreground/70">{count}</span>
    </button>
  );
}

function formatRefreshTime(timestamp: number | null): string {
  if (!timestamp) return 'not synced';
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Channel content
// ---------------------------------------------------------------------------

export function OpenScoutContent() {
  const {
    agents,
    filteredChannel,
    selectedAgent,
    error,
    activityFilter,
    setActivityFilter,
    activityCounts,
    onlineCount,
    searchQuery,
    lastUpdatedAt,
  } = useOpenScout();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filteredChannel.length]);

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div className="px-4 py-2 text-xs text-red-700 dark:text-red-400 bg-red-700/10 dark:bg-red-500/10 border-b border-red-700/20 dark:border-red-500/20">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SummaryPill label="scope" value={selectedAgent ?? 'mesh'} />
          <SummaryPill label="agents" value={`${onlineCount}/${agents.length} live`} />
          <SummaryPill label="messages" value={`${filteredChannel.length} shown`} />
          <SummaryPill label="synced" value={formatRefreshTime(lastUpdatedAt)} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_OPTIONS.map(option => (
            <FilterChip
              key={option.id}
              label={option.label}
              count={activityCounts[option.id]}
              active={activityFilter === option.id}
              onClick={() => setActivityFilter(option.id)}
            />
          ))}
        </div>
        {(selectedAgent || searchQuery) && (
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-muted-foreground">
            {selectedAgent && (
              <span className="rounded-full border border-cyan-700/30 dark:border-cyan-500/15 bg-cyan-700/10 dark:bg-cyan-500/10 px-2 py-1 text-cyan-700 dark:text-cyan-300/80">
                agent {selectedAgent}
              </span>
            )}
            {searchQuery && (
              <span className="rounded-full border border-border/60 bg-card/60 px-2 py-1 text-foreground/72">
                search {searchQuery}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-1 frame-scrollbar">
        {filteredChannel.map((entry, i) => (
          <MessageRow key={`${entry.timestamp}-${i}`} entry={entry} />
        ))}
        {filteredChannel.length === 0 && (
          <div className="text-[11px] text-muted-foreground/70 mt-8 text-center">
            No messages match the current Scout scope.
          </div>
        )}
      </div>
    </div>
  );
}
