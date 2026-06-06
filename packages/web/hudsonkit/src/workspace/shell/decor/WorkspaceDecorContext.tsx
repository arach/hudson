'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createHudsonId, usePersistentState } from '../../../index';
import { useWorkspaceHostRoutes } from '../../hostRoutes';
import type {
  DecorationItem,
  DecorationType,
  DecorState,
  TextDecor,
  ImageDecor,
  WebDecor,
  StepCardDecor,
} from './types';
import { EMPTY_DECOR_STATE } from './types';
import { INITIAL_DECOR_BY_WORKSPACE, SEED_BY_WORKSPACE } from './seed';

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkspaceDecorContextValue {
  workspaceId: string;
  items: DecorationItem[];
  visible: boolean;
  setVisible: (v: boolean) => void;
  selectedId: string | null;
  selectItem: (id: string | null) => void;

  addItem: (type: DecorationType, atCenter?: { x: number; y: number }) => string;
  updateItem: (id: string, patch: Partial<DecorationItem>) => void;
  removeItem: (id: string) => void;
  resetToSeed: () => void;
  saveSnapshot: () => Promise<void>;
  isSaving: boolean;
  lastSavedAt: number | null;
  saveError: string | null;
}

const WorkspaceDecorContext = createContext<WorkspaceDecorContextValue | null>(null);

export function useWorkspaceDecor(): WorkspaceDecorContextValue {
  const ctx = useContext(WorkspaceDecorContext);
  if (!ctx) throw new Error('useWorkspaceDecor must be used inside WorkspaceDecorProvider');
  return ctx;
}

/** Returns the context if present (for the shell render layer to bail out
 *  cleanly when running outside a workspace). */
export function useOptionalWorkspaceDecor(): WorkspaceDecorContextValue | null {
  return useContext(WorkspaceDecorContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// Item factories
// ─────────────────────────────────────────────────────────────────────────────

function newId(): string {
  return createHudsonId('decor', 10);
}

function touchState(state: DecorState): DecorState {
  return { ...state, updatedAt: Date.now() };
}

function isDecorState(value: unknown): value is DecorState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<DecorState>;
  return Array.isArray(state.items) && typeof state.visible === 'boolean';
}

function makeItem(
  type: DecorationType,
  position: { x: number; y: number },
): DecorationItem {
  const id = newId();
  switch (type) {
    case 'text': {
      const item: TextDecor = {
        id,
        type: 'text',
        subtype: 'body',
        text: 'New text. Click to edit.',
        x: position.x,
        y: position.y,
        w: 420,
        h: 60,
      };
      return item;
    }
    case 'image': {
      const item: ImageDecor = {
        id,
        type: 'image',
        src: '',
        alt: '',
        x: position.x,
        y: position.y,
        w: 420,
        h: 240,
        sizing: 'medium',
      };
      return item;
    }
    case 'web': {
      const item: WebDecor = {
        id,
        type: 'web',
        url: 'https://example.com',
        title: 'Untitled embed',
        x: position.x,
        y: position.y,
        w: 640,
        h: 380,
        sizing: 'large',
      };
      return item;
    }
    case 'step-card': {
      const item: StepCardDecor = {
        id,
        type: 'step-card',
        step: '01',
        verb: 'STEP',
        body: 'description',
        code: '',
        x: position.x,
        y: position.y,
        w: 350,
        h: 180,
      };
      return item;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function WorkspaceDecorProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  const routes = useWorkspaceHostRoutes();
  const initial = useMemo<DecorState>(() => {
    const cached = INITIAL_DECOR_BY_WORKSPACE[workspaceId];
    if (cached) return cached;
    const seed = SEED_BY_WORKSPACE[workspaceId];
    if (seed && seed.length > 0) return { items: seed, visible: true };
    return EMPTY_DECOR_STATE;
  }, [workspaceId]);

  const [state, setState] = usePersistentState<DecorState>(
    `hudson.ws.${workspaceId}.decor`,
    initial,
  );

  const [selectedId, setSelectedId] = usePersistentState<string | null>(
    `hudson.ws.${workspaceId}.decor.selected`,
    null,
  );

  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const stateRef = useRef(state);
  const checkedInitialRestoreRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (checkedInitialRestoreRef.current) return;
    checkedInitialRestoreRef.current = true;
    const seed = SEED_BY_WORKSPACE[workspaceId];
    if (!seed || seed.length === 0) return;
    if (state.items.length > 0) return;

    setState({ items: seed, visible: true });
  }, [workspaceId, state.items.length, setState]);

  useEffect(() => {
    if (!routes.workspaceDecor) return;
    let cancelled = false;

    async function restoreCachedSnapshot() {
      try {
        const res = await fetch(`${routes.workspaceDecor}?id=${encodeURIComponent(workspaceId)}`);
        if (!res.ok) return;
        const cached = await res.json();
        if (cancelled || !isDecorState(cached)) return;

        setState((current) => {
          const currentUpdatedAt = current.updatedAt ?? 0;
          const cachedUpdatedAt = cached.updatedAt ?? 0;
          if (cachedUpdatedAt > currentUpdatedAt) return cached;
          return current;
        });
        if (typeof cached.updatedAt === 'number') setLastSavedAt(cached.updatedAt);
      } catch {
        // The API is a local/dev cache. Static embeds can run without it.
      }
    }

    void restoreCachedSnapshot();
    return () => { cancelled = true; };
  }, [routes.workspaceDecor, workspaceId, setState]);

  const setVisible = useCallback(
    (v: boolean) => setState((s) => touchState({ ...s, visible: v })),
    [setState],
  );

  const addItem = useCallback(
    (type: DecorationType, atCenter?: { x: number; y: number }) => {
      const item = makeItem(type, atCenter ?? { x: 0, y: 0 });
      setState((s) => touchState({ ...s, items: [...s.items, item] }));
      setSelectedId(item.id);
      return item.id;
    },
    [setState, setSelectedId],
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<DecorationItem>) => {
      setState((s) =>
        touchState({
          ...s,
          items: s.items.map((it) =>
            it.id === id ? ({ ...it, ...patch } as DecorationItem) : it,
          ),
        }),
      );
    },
    [setState],
  );

  const removeItem = useCallback(
    (id: string) => {
      setState((s) => touchState({ ...s, items: s.items.filter((it) => it.id !== id) }));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [setState, setSelectedId],
  );

  const resetToSeed = useCallback(() => {
    const seed = SEED_BY_WORKSPACE[workspaceId];
    setState(touchState({ items: seed ?? [], visible: true }));
    setSelectedId(null);
  }, [workspaceId, setState, setSelectedId]);

  const saveSnapshot = useCallback(async () => {
    if (!routes.workspaceDecor) {
      setSaveError(null);
      return;
    }
    const snapshot = touchState(stateRef.current);
    setState(snapshot);
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(routes.workspaceDecor, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: workspaceId, state: snapshot }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Save failed (${res.status})`);
      }
      const saved = await res.json();
      const savedAt = typeof saved.updatedAt === 'number' ? saved.updatedAt : snapshot.updatedAt ?? Date.now();
      setLastSavedAt(savedAt);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hudson:saved', {
          detail: { key: `hudson.ws.${workspaceId}.decor.cache` },
        }));
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }, [routes.workspaceDecor, workspaceId, setState]);

  const value = useMemo<WorkspaceDecorContextValue>(
    () => ({
      workspaceId,
      items: state.items,
      visible: state.visible,
      setVisible,
      selectedId,
      selectItem: setSelectedId,
      addItem,
      updateItem,
      removeItem,
      resetToSeed,
      saveSnapshot,
      isSaving,
      lastSavedAt,
      saveError,
    }),
    [
      workspaceId,
      state.items,
      state.visible,
      setVisible,
      selectedId,
      setSelectedId,
      addItem,
      updateItem,
      removeItem,
      resetToSeed,
      saveSnapshot,
      isSaving,
      lastSavedAt,
      saveError,
    ],
  );

  return (
    <WorkspaceDecorContext.Provider value={value}>{children}</WorkspaceDecorContext.Provider>
  );
}
