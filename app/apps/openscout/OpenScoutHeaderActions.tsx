'use client';

import { useOpenScout } from './OpenScoutProvider';
import { RefreshCw } from 'lucide-react';

function isOnline(ts: number): boolean {
  if (!ts) return false;
  return Math.floor(Date.now() / 1000) - ts < 300;
}

export function OpenScoutLeftHeaderActions() {
  const { agents, loading, refresh } = useOpenScout();
  const onlineCount = agents.filter(a => isOnline(a.lastSeen)).length;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/30 font-mono">
        {onlineCount}
      </span>
      <button
        onClick={refresh}
        className="p-1 rounded hover:bg-white/[0.06] text-white/25 hover:text-white/50 transition-colors"
        title="Refresh"
      >
        <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
      </button>
    </div>
  );
}
