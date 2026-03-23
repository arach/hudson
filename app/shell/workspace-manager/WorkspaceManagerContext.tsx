'use client';

import { createContext, useContext } from 'react';
import type { HudsonWorkspace } from '@hudson/sdk';
import type { ServiceRegistryValue } from '../../services/ServiceRegistryContext';
import type { AppSettingsEntry } from '../../apps/hudson-docs/components';
import type { HudsonSettings } from '../../apps/hudson-docs/types';

export type WindowBounds = { x: number; y: number; w: number; h: number };

export interface WorkspaceManagerData {
  /** Full workspace (all apps, including disabled) */
  workspace: HudsonWorkspace;
  workspaces: HudsonWorkspace[];
  activatedAppIds: Set<string>;
  /** Apps that are completely disabled (Provider not mounted, not rendered) */
  disabledAppIds: Set<string>;
  /** Ordered list of app IDs for display ordering */
  appOrder: string[];
  focusedAppId: string;
  onToggleAppVisibility: (appId: string) => void;
  onToggleAppDisabled: (appId: string) => void;
  onReorderApps: (orderedIds: string[]) => void;
  onFocusApp: (appId: string) => void;
  serviceRegistry: ServiceRegistryValue;
  appSettings: AppSettingsEntry[];
  /** Live window bounds for all windowed apps */
  windowBoundsMap: Record<string, WindowBounds>;
  /** Reset all window positions to defaults and re-tile */
  onResetLayout: () => void;
  /** Fit all windows into view */
  onFitAll: () => void;
  /** Shell-level settings */
  shellSettings: HudsonSettings;
  onUpdateShellSettings: (patch: Partial<HudsonSettings>) => void;
  onResetShellSettings: () => void;
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
