'use client';

import { createContext, useContext, type ReactNode } from 'react';

interface ActiveWorkspaceContextValue {
  workspaceId: string;
}

const ActiveWorkspaceContext = createContext<ActiveWorkspaceContextValue | null>(null);

export function ActiveWorkspaceProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  return (
    <ActiveWorkspaceContext.Provider value={{ workspaceId }}>
      {children}
    </ActiveWorkspaceContext.Provider>
  );
}

export function useActiveWorkspace() {
  const ctx = useContext(ActiveWorkspaceContext);
  if (!ctx) throw new Error('useActiveWorkspace must be used within ActiveWorkspaceProvider');
  return ctx;
}
