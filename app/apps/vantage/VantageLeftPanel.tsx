'use client';

import { VANTAGE_CONTROL_PROFILES } from '@/app/lib/vantage/paths';
import { useVantage } from './VantageProvider';
import { VantageIcon } from './VantageIcon';
import { SectionLabel } from './components';

export function VantageLeftPanel() {
  const {
    filteredNodes,
    selectedNodeId,
    setSelectedNodeId,
    profileId,
    setProfileId,
    phase,
  } = useVantage();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/50 p-3">
        <SectionLabel label="Control profile" />
        <select
          value={profileId}
          onChange={event => setProfileId(event.target.value)}
          className="mt-1 w-full rounded-md border border-border/70 bg-background/40 px-2.5 py-1.5 text-xs text-foreground/85 outline-none focus:border-cyan-500/25"
        >
          {VANTAGE_CONTROL_PROFILES.map(profile => (
            <option key={profile.id} value={profile.id}>{profile.label}</option>
          ))}
        </select>
      </div>

      <div className="border-b border-border/50 px-1 py-1">
        <SectionLabel label="Nodes" count={filteredNodes.length} />
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2 space-y-1">
        {filteredNodes.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            {phase === 'online' ? 'No nodes match this filter.' : 'Companion offline.'}
          </p>
        ) : (
          filteredNodes.map(node => {
            const active = selectedNodeId === node.id;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelectedNodeId(node.id)}
                className={`w-full rounded-md px-2.5 py-2 text-left transition-colors border ${
                  active
                    ? 'border-cyan-500/20 bg-cyan-500/8 text-foreground/90'
                    : 'border-transparent hover:border-border/50 hover:bg-muted/20 text-foreground/75'
                }`}
              >
                <div className="flex items-center gap-2">
                  <VantageIcon size={11} className={active ? 'text-cyan-300' : 'text-muted-foreground/60'} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px]">{node.title ?? node.id.slice(0, 12)}</div>
                    {node.subtitle && (
                      <div className="truncate font-mono text-[10px] text-muted-foreground/70">{node.subtitle}</div>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
