'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  HudsonWorkspace,
  WorkspaceAppConfig,
} from '../../types/workspace';
import { routeWithQuery } from '../hostRoutes';

function readStorage(key: string): unknown {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : undefined;
  } catch {
    return undefined;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('hudson:saved', { detail: { key } }));
  } catch {}
}

export function sameWorkspaceAppIdList(
  a: readonly string[],
  b: readonly string[],
) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * Normalize a persisted app-id list against the current workspace apps.
 * Known IDs stay in their saved order, duplicate/deleted IDs are dropped, and
 * newly-added workspace apps are appended in authoring order.
 */
export function normalizeWorkspaceAppOrder(
  persistedOrder: unknown,
  currentAppIds: readonly string[],
): string[] {
  const current = new Set(currentAppIds);
  const seen = new Set<string>();
  const ordered = Array.isArray(persistedOrder)
    ? persistedOrder.filter((id): id is string => {
        if (typeof id !== 'string') return false;
        if (!current.has(id) || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
    : [];

  return [...ordered, ...currentAppIds.filter((id) => !seen.has(id))];
}

/** Normalize generic persisted app-id lists like disabledApps/visibleApps. */
export function normalizeWorkspaceAppIdList(
  persistedIds: unknown,
  currentAppIds: readonly string[],
): string[] {
  if (!Array.isArray(persistedIds)) return [];
  const current = new Set(currentAppIds);
  const seen = new Set<string>();
  return persistedIds.filter((id): id is string => {
    if (typeof id !== 'string') return false;
    if (!current.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function toggleWorkspaceDisabledAppIds(
  disabledIds: readonly string[],
  appId: string,
  currentAppIds: readonly string[],
): string[] {
  if (!currentAppIds.includes(appId)) {
    return normalizeWorkspaceAppIdList(disabledIds, currentAppIds);
  }

  const normalized = normalizeWorkspaceAppIdList(disabledIds, currentAppIds);
  if (normalized.includes(appId))
    return normalized.filter((id) => id !== appId);
  return [...normalized, appId];
}

export function orderWorkspaceAppConfigs<T extends WorkspaceAppConfig>(
  configs: readonly T[],
  appOrder: readonly string[],
): T[] {
  const rank = new Map(appOrder.map((id, index) => [id, index]));
  return [...configs].sort((a, b) => {
    const aRank = rank.get(a.app.id) ?? Number.MAX_SAFE_INTEGER;
    const bRank = rank.get(b.app.id) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return configs.indexOf(a) - configs.indexOf(b);
  });
}

export function orderWorkspaceApps(
  workspace: HudsonWorkspace,
  appOrder: readonly string[],
): HudsonWorkspace {
  return {
    ...workspace,
    apps: orderWorkspaceAppConfigs(workspace.apps, appOrder),
  };
}

export interface WorkspaceAppOrderStateOptions {
  workspaceId: string;
  appIds: readonly string[];
  persistSession: boolean;
  workspaceStateRoute?: string;
  initialAppOrder?: unknown;
  debounceMs?: number;
}

export interface WorkspaceAppOrderState {
  appOrder: string[];
  setAppOrder: (orderedIds: readonly string[]) => void;
  hasWorkspaceStateRoute: boolean;
}

/**
 * Route-backed app order state with localStorage fallback only when the host has
 * not supplied routes.workspaceState.
 */
export function useWorkspaceAppOrderState({
  workspaceId,
  appIds,
  persistSession,
  workspaceStateRoute,
  initialAppOrder,
  debounceMs = 1000,
}: WorkspaceAppOrderStateOptions): WorkspaceAppOrderState {
  const appIdsKey = appIds.join('\0');
  const storageKey = `hudson.ws.${workspaceId}.appOrder`;
  const hasWorkspaceStateRoute = Boolean(workspaceStateRoute);
  const defaultOrder = useMemo(
    () => normalizeWorkspaceAppOrder(initialAppOrder, appIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialAppOrder, appIdsKey],
  );

  const [localAppOrder, setLocalAppOrder] = useState<string[]>(defaultOrder);
  const [routeAppOrder, setRouteAppOrder] = useState<string[]>(defaultOrder);
  const [localReady, setLocalReady] = useState(
    !persistSession || hasWorkspaceStateRoute,
  );
  const [routeReadyVersion, setRouteReadyVersion] = useState(0);
  const routeReadyRef = useRef(!persistSession || !hasWorkspaceStateRoute);
  const routeGenerationRef = useRef(0);
  const routeDirtyRef = useRef(false);
  const skipRouteSaveOnceRef = useRef(false);
  const routeSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalAppOrder((prev) => normalizeWorkspaceAppOrder(prev, appIds));
    setRouteAppOrder((prev) => normalizeWorkspaceAppOrder(prev, appIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appIdsKey, workspaceId]);

  useEffect(() => {
    if (!persistSession || hasWorkspaceStateRoute) {
      setLocalReady(true);
      return;
    }

    let cancelled = false;
    setLocalReady(false);
    queueMicrotask(() => {
      if (cancelled) return;
      const saved = readStorage(storageKey);
      setLocalAppOrder(normalizeWorkspaceAppOrder(saved, appIds));
      setLocalReady(true);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistSession, hasWorkspaceStateRoute, storageKey, appIdsKey]);

  const rawAppOrder = hasWorkspaceStateRoute ? routeAppOrder : localAppOrder;
  const appOrder = useMemo(
    () => normalizeWorkspaceAppOrder(rawAppOrder, appIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawAppOrder, appIdsKey],
  );

  useEffect(() => {
    if (!persistSession || hasWorkspaceStateRoute || !localReady) return;
    writeStorage(storageKey, appOrder);
  }, [
    appOrder,
    hasWorkspaceStateRoute,
    localReady,
    persistSession,
    storageKey,
  ]);

  useEffect(() => {
    if (!persistSession || !workspaceStateRoute) {
      routeReadyRef.current = true;
      setRouteReadyVersion((version) => version + 1);
      return;
    }

    routeReadyRef.current = false;
    routeDirtyRef.current = false;
    const generation = ++routeGenerationRef.current;

    fetch(routeWithQuery(workspaceStateRoute, { id: workspaceId }))
      .then((response) => response.json())
      .then((data) => {
        if (generation !== routeGenerationRef.current) return;
        const dirty = routeDirtyRef.current;
        routeReadyRef.current = true;
        skipRouteSaveOnceRef.current = !dirty;
        if (!dirty) {
          setRouteAppOrder(normalizeWorkspaceAppOrder(data?.appOrder, appIds));
        }
        setRouteReadyVersion((version) => version + 1);
      })
      .catch(() => {
        if (generation !== routeGenerationRef.current) return;
        const dirty = routeDirtyRef.current;
        routeReadyRef.current = true;
        skipRouteSaveOnceRef.current = !dirty;
        if (!dirty) setRouteAppOrder(defaultOrder);
        setRouteReadyVersion((version) => version + 1);
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistSession, workspaceStateRoute, workspaceId, appIdsKey]);

  useEffect(() => {
    if (!persistSession || !workspaceStateRoute || !routeReadyRef.current)
      return;
    if (skipRouteSaveOnceRef.current) {
      skipRouteSaveOnceRef.current = false;
      return;
    }

    if (routeSaveTimerRef.current) clearTimeout(routeSaveTimerRef.current);
    routeSaveTimerRef.current = setTimeout(() => {
      fetch(workspaceStateRoute, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: workspaceId, state: { appOrder } }),
      }).catch(() => {});
    }, debounceMs);

    return () => {
      if (routeSaveTimerRef.current) clearTimeout(routeSaveTimerRef.current);
    };
  }, [
    appOrder,
    debounceMs,
    persistSession,
    routeReadyVersion,
    workspaceId,
    workspaceStateRoute,
  ]);

  const setAppOrder = useCallback(
    (orderedIds: readonly string[]) => {
      const next = normalizeWorkspaceAppOrder(orderedIds, appIds);
      if (hasWorkspaceStateRoute) {
        routeDirtyRef.current = true;
        setRouteAppOrder(next);
      } else {
        setLocalAppOrder(next);
      }
    },
    [appIds, hasWorkspaceStateRoute],
  );

  return { appOrder, setAppOrder, hasWorkspaceStateRoute };
}
