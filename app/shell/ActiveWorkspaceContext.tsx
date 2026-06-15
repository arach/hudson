'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { HudsonWorkspace } from 'hudsonkit';

interface ActiveWorkspaceContextValue {
  workspaceId: string;
  workspace: HudsonWorkspace;
}

const ActiveWorkspaceContext = createContext<ActiveWorkspaceContextValue | null>(null);

export function ActiveWorkspaceProvider({
  workspaceId,
  workspace,
  children,
}: {
  workspaceId: string;
  workspace: HudsonWorkspace;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ workspaceId, workspace }), [workspaceId, workspace]);
  return (
    <ActiveWorkspaceContext.Provider value={value}>
      {children}
    </ActiveWorkspaceContext.Provider>
  );
}

export function useActiveWorkspace() {
  const ctx = useContext(ActiveWorkspaceContext);
  if (!ctx) throw new Error('useActiveWorkspace must be used within ActiveWorkspaceProvider');
  return ctx;
}
