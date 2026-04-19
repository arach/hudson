'use client';

import { useOpenScout, type AgentInfo } from './OpenScoutProvider';
import { Circle } from 'lucide-react';
import { formatOpenScoutRelativeTime, isOpenScoutAgentOnline } from './utils';

function AgentRow({ agent, selected, onSelect }: { agent: AgentInfo; selected: boolean; onSelect: () => void }) {
  const online = isOpenScoutAgentOnline(agent.lastSeen);

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
        <div className="text-[10px] text-white/20 truncate">
          {agent.project}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-white/25">
          <span>{agent.messageCount} msgs</span>
          <span>·</span>
          <span>{formatOpenScoutRelativeTime(agent.lastSeen)}</span>
        </div>
      </div>
    </button>
  );
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="px-2.5 pt-2 pb-1 text-[9px] font-mono uppercase tracking-[0.18em] text-white/18">
      {label}
      <span className="ml-2 text-white/10">{count}</span>
    </div>
  );
}

export function OpenScoutLeftPanel() {
  const {
    agents,
    filteredAgents,
    loading,
    selectedAgent,
    setSelectedAgent,
    onlineCount,
    channel,
    searchQuery,
  } = useOpenScout();
  const onlineAgents = filteredAgents.filter(agent => isOpenScoutAgentOnline(agent.lastSeen));
  const offlineAgents = filteredAgents.filter(agent => !isOpenScoutAgentOnline(agent.lastSeen));

  return (
    <div className="p-1.5 space-y-0.5 overflow-y-auto h-full">
      <button
        type="button"
        onClick={() => setSelectedAgent(null)}
        className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
          selectedAgent === null
            ? 'border-cyan-500/20 bg-cyan-500/10'
            : 'border-transparent hover:bg-white/[0.04]'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-medium text-white/75">All Activity</span>
          <span className="text-[10px] font-mono text-white/25">{channel.length}</span>
        </div>
        <div className="text-[10px] text-white/20">
          {onlineCount}/{agents.length} live agents
        </div>
      </button>

      {onlineAgents.length > 0 && <SectionLabel label="Online" count={onlineAgents.length} />}
      {onlineAgents.map(agent => (
        <AgentRow
          key={agent.name}
          agent={agent}
          selected={selectedAgent === agent.name}
          onSelect={() => setSelectedAgent(selectedAgent === agent.name ? null : agent.name)}
        />
      ))}

      {offlineAgents.length > 0 && <SectionLabel label="Offline" count={offlineAgents.length} />}
      {offlineAgents.map(agent => (
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
      {!loading && agents.length > 0 && filteredAgents.length === 0 && (
        <div className="px-3 py-6 text-[11px] text-white/25 text-center">
          No Scout agents match “{searchQuery}”.
        </div>
      )}
    </div>
  );
}
