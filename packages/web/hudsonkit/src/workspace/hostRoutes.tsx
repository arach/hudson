'use client';

import { createContext, useContext, type ReactNode } from 'react';

export interface WorkspaceHostRoutes {
  agentActions?: string;
  aiChat?: string;
  apiProxy?: string;
  fetchImage?: string;
  imageGeneration?: string;
  localEnvironment?: string;
  pipes?: string;
  pipeEvents?: string;
  relayUpload?: string;
  services?: string;
  serviceExecute?: string;
  speech?: string;
  traces?: string;
  voiceApiBase?: string;
  voices?: string;
  workspaceDecor?: string;
  workspaceState?: string;
}

/**
 * Neutral alias for {@link WorkspaceHostRoutes}. Both shells consume the same
 * host-route map; prefer this name in single-app (AppShell) contexts where
 * the "workspace" prefix would be misleading.
 */
export type HudsonHostRoutes = WorkspaceHostRoutes;

const WorkspaceHostRoutesContext = createContext<WorkspaceHostRoutes>({});

export function WorkspaceHostRoutesProvider({
  routes,
  children,
}: {
  routes?: WorkspaceHostRoutes;
  children: ReactNode;
}) {
  return (
    <WorkspaceHostRoutesContext.Provider value={routes ?? {}}>
      {children}
    </WorkspaceHostRoutesContext.Provider>
  );
}

export function useWorkspaceHostRoutes() {
  return useContext(WorkspaceHostRoutesContext);
}

export function routeWithQuery(route: string, params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const query = search.toString();
  if (!query) return route;
  return `${route}${route.includes('?') ? '&' : '?'}${query}`;
}
