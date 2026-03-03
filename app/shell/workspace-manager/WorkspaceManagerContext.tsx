'use client';

import { createContext, useContext } from 'react';
import type { HudsonWorkspace } from '@hudson/sdk';
import type { ServiceRegistryValue } from '../../services/ServiceRegistryContext';
import type { AppSettingsEntry } from '../../apps/hudson-docs/components';

export interface WorkspaceManagerData {
  workspace: HudsonWorkspace;
  activatedAppIds: Set<string>;
  focusedAppId: string;
  onToggleAppVisibility: (appId: string) => void;
  onFocusApp: (appId: string) => void;
  serviceRegistry: ServiceRegistryValue;
  appSettings: AppSettingsEntry[];
}

const WorkspaceManagerContext = createContext<WorkspaceManagerData | null>(null);

export function WorkspaceManagerProvider({
  value,
  children,
}: {
  value: WorkspaceManagerData;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceManagerContext.Provider value={value}>
      {children}
    </WorkspaceManagerContext.Provider>
  );
}

export function useWorkspaceManager() {
  const ctx = useContext(WorkspaceManagerContext);
  if (!ctx) throw new Error('useWorkspaceManager must be used within WorkspaceManagerProvider');
  return ctx;
}
