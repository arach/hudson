'use client';

import type { HudsonWorkspace } from 'hudsonkit';

interface WorkspaceSwitcherProps {
  workspaces: HudsonWorkspace[];
  activeId: string;
  onSwitch: (id: string) => void;
}

export function WorkspaceSwitcher({ workspaces, activeId, onSwitch }: WorkspaceSwitcherProps) {
  if (workspaces.length <= 1) {
    return (
      <span className="text-[11px] font-mono text-muted-foreground">
        {workspaces[0]?.name ?? 'Workspace'}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {workspaces.map(ws => {
        const isActive = ws.id === activeId;
        return (
          <button
            key={ws.id}
            onClick={() => onSwitch(ws.id)}
            className={`px-2.5 py-1 rounded-md border text-[10px] font-mono transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:outline-none ${
              isActive
                ? 'bg-accent/10 text-accent border-accent/30'
                : 'border-border bg-card/40 text-foreground/80 hover:bg-muted hover:text-foreground hover:border-border'
            }`}
            title={ws.description}
            aria-pressed={isActive}
          >
            {ws.name}
          </button>
        );
      })}
    </div>
  );
}

export function WorkspaceRail({ workspaces, activeId, onSwitch }: WorkspaceSwitcherProps) {
  if (workspaces.length <= 1) return null;

  return (
    <nav
      aria-label="Workspaces"
      className="fixed left-3 top-[68px] z-[45] w-[152px] pointer-events-auto select-none rounded-lg border border-border/80 bg-card/92 backdrop-blur-xl shadow-[0_18px_50px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.08)] overflow-hidden font-mono"
    >
      <div className="px-3 py-2 border-b border-border/70 text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-500">
        Workspaces
      </div>
      <div className="p-1.5 space-y-1">
        {workspaces.map(ws => {
          const isActive = ws.id === activeId;
          return (
            <button
              key={ws.id}
              onClick={() => onSwitch(ws.id)}
              className={`group relative w-full rounded-md border px-2.5 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:outline-none ${
                isActive
                  ? 'border-cyan-500/40 bg-cyan-500/12 text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/65 hover:text-foreground'
              }`}
              title={ws.description}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isActive ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.7)]' : 'bg-muted-foreground/45 group-hover:bg-cyan-400/70'
                  }`}
                  aria-hidden="true"
                />
                <span className="min-w-0 truncate text-[11px] font-semibold">
                  {ws.name}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
