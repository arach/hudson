'use client';

import { useOpenScout } from './OpenScoutProvider';
import { RefreshCw } from 'lucide-react';

export function OpenScoutLeftHeaderActions() {
  const { agents, onlineCount, loading, refresh } = useOpenScout();

  return (
    <div className="flex items-center gap-1.5">
      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-mono text-white/30">
        {onlineCount}/{agents.length}
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
