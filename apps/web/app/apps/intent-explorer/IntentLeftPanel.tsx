'use client';

import { Terminal, FileText } from 'lucide-react';
import { useExplorer } from './IntentProvider';

// Icons for known app groups
const GROUP_ICONS: Record<string, React.FC<{ size: number; className?: string }>> = {
  shell: Terminal,
  'hudson-docs': FileText,
};

export function IntentLeftPanel() {
  const { groups, activeGroupId, setActiveGroupId, setSelectedIntentId } = useExplorer();

  return (
    <div className="py-2">
      <div className="px-4 py-2 text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
        App Groups
      </div>
      {groups.map(group => {
        const isActive = activeGroupId === group.id;
        const Icon = GROUP_ICONS[group.id];

        return (
          <button
            key={group.id}
            onClick={() => {
              setActiveGroupId(group.id);
              // Scroll the group into view in the content area
              const el = document.querySelector(`[data-group-id="${group.id}"]`);
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
              isActive
                ? 'bg-accent/10 text-accent border-l-2 border-l-accent/50'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground border-l-2 border-transparent'
            }`}
          >
            {Icon && (
              <Icon
                size={14}
                className={isActive ? 'text-accent' : 'text-muted-foreground'}
              />
            )}
            <span className="text-[12px] font-mono tracking-wider uppercase flex-1">
              {group.label}
            </span>
            <span
              className={`text-[10px] font-mono ${
                isActive ? 'text-accent/70' : 'text-muted-foreground'
              }`}
            >
              {group.intents.length}
            </span>
          </button>
        );
      })}

      {/* Total count */}
      <div className="border-t border-border/60 mt-3 pt-3 px-4">
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
          <span>Total intents</span>
          <span className="text-foreground">
            {groups.reduce((sum, g) => sum + g.intents.length, 0)}
          </span>
        </div>
      </div>
    </div>
  );
}
