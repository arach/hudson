'use client';

import type { HudsonWorkspace } from '@hudson/sdk';

interface WorkspaceSwitcherProps {
  workspaces: HudsonWorkspace[];
  activeId: string;
  onSwitch: (id: string) => void;
}

export function WorkspaceSwitcher({ workspaces, activeId, onSwitch }: WorkspaceSwitcherProps) {
  if (workspaces.length <= 1) {
    return (
      <span className="text-[11px] font-mono text-neutral-300">
        {workspaces[0]?.name ?? 'Workspace'}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      {workspaces.map(ws => (
        <button
          key={ws.id}
          onClick={() => onSwitch(ws.id)}
          className={`px-2.5 py-1 rounded-md text-[10px] font-mono transition-colors ${
            ws.id === activeId
              ? 'bg-white/10 text-white'
              : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
          }`}
          title={ws.description}
        >
          {ws.name}
        </button>
      ))}
    </div>
  );
}
