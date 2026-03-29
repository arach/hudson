'use client';

import { useOpenScout, type AgentInfo } from './OpenScoutProvider';
import { Circle } from 'lucide-react';

function isOnline(ts: number): boolean {
  if (!ts) return false;
  return Math.floor(Date.now() / 1000) - ts < 300;
}

function formatLastSeen(ts: number): string {
  if (!ts) return 'never';
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function AgentRow({ agent, selected, onSelect }: { agent: AgentInfo; selected: boolean; onSelect: () => void }) {
  const online = isOnline(agent.lastSeen);

  return (
    <button
      onClick={onSelect}
      className={`
        w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-colors rounded-lg
        ${selected
          ? 'bg-cyan-500/10 border border-cyan-500/20'
          : 'hover:bg-white/[0.04] border border-transparent'
        }
      `}
    >
      <Circle
        size={7}
        className={online ? 'text-emerald-400 fill-emerald-400' : 'text-neutral-600 fill-neutral-600'}
      />
      <div className="flex-1 min-w-0">
        <div className={`text-[12px] font-medium truncate ${online ? 'text-white/80' : 'text-white/35'}`}>
          {agent.name}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-white/25">
          <span>{agent.messageCount} msgs</span>
          <span>·</span>
          <span>{formatLastSeen(agent.lastSeen)}</span>
        </div>
      </div>
    </button>
  );
}

export function OpenScoutLeftPanel() {
  const { agents, loading, selectedAgent, setSelectedAgent } = useOpenScout();

  return (
    <div className="p-1.5 space-y-0.5 overflow-y-auto h-full">
      {agents.map((agent) => (
        <AgentRow
          key={agent.name}
          agent={agent}
          selected={selectedAgent === agent.name}
          onSelect={() => setSelectedAgent(selectedAgent === agent.name ? null : agent.name)}
        />
      ))}
      {!loading && agents.length === 0 && (
        <div className="px-3 py-6 text-[11px] text-white/25 text-center">No agents found</div>
      )}
    </div>
  );
}
