'use client';

import { useOpenScout } from './OpenScoutProvider';
import { Circle } from 'lucide-react';

function isOnline(ts: number): boolean {
  if (!ts) return false;
  return Math.floor(Date.now() / 1000) - ts < 300;
}

function formatTime(ts: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5">
      <span className="text-[10px] text-white/25 shrink-0">{label}</span>
      <span className="text-[11px] text-white/60 text-right truncate">{value}</span>
    </div>
  );
}

export function OpenScoutInspector() {
  const { agents, selectedAgent } = useOpenScout();
  const agent = agents.find(a => a.name === selectedAgent);

  if (!agent) {
    return (
      <div className="p-4 text-[11px] text-white/20 text-center mt-8">
        Select an agent to inspect
      </div>
    );
  }

  const online = isOnline(agent.lastSeen);

  return (
    <div className="p-3 space-y-3 overflow-y-auto h-full">
      {/* Agent header */}
      <div className="flex items-center gap-2.5 px-1 pb-2 border-b border-white/[0.06]">
        <Circle
          size={8}
          className={online ? 'text-emerald-400 fill-emerald-400' : 'text-neutral-600 fill-neutral-600'}
        />
        <div>
          <div className="text-[13px] font-medium text-white/80">{agent.name}</div>
          <div className="text-[10px] text-white/25">{online ? 'Online' : 'Offline'}</div>
        </div>
      </div>

      {/* Details */}
      <div className="divide-y divide-white/[0.04]">
        <DetailRow label="Project" value={agent.project} />
        {agent.cwd && <DetailRow label="Directory" value={agent.cwd.replace(/^\/Users\/\w+/, '~')} />}
        {agent.pid && <DetailRow label="PID" value={agent.pid} />}
        <DetailRow label="Messages" value={agent.messageCount} />
        <DetailRow label="Last seen" value={formatTime(agent.lastSeen)} />
        <DetailRow label="Registered" value={agent.registered ? 'Yes' : 'No'} />
      </div>
    </div>
  );
}
