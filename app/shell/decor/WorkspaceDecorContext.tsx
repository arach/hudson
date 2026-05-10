'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { usePersistentState } from 'hudsonkit';
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
import { SEED_BY_WORKSPACE } from './seed';

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
  return Math.random().toString(36).slice(2, 10);
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
  const initial = useMemo<DecorState>(() => {
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

  const setVisible = useCallback(
    (v: boolean) => setState((s) => ({ ...s, visible: v })),
    [setState],
  );

  const addItem = useCallback(
    (type: DecorationType, atCenter?: { x: number; y: number }) => {
      const item = makeItem(type, atCenter ?? { x: 0, y: 0 });
      setState((s) => ({ ...s, items: [...s.items, item] }));
      setSelectedId(item.id);
      return item.id;
    },
    [setState, setSelectedId],
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<DecorationItem>) => {
      setState((s) => ({
        ...s,
        items: s.items.map((it) =>
          it.id === id ? ({ ...it, ...patch } as DecorationItem) : it,
        ),
      }));
    },
    [setState],
  );

  const removeItem = useCallback(
    (id: string) => {
      setState((s) => ({ ...s, items: s.items.filter((it) => it.id !== id) }));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [setState, setSelectedId],
  );

  const resetToSeed = useCallback(() => {
    const seed = SEED_BY_WORKSPACE[workspaceId];
    setState({ items: seed ?? [], visible: true });
    setSelectedId(null);
  }, [workspaceId, setState, setSelectedId]);

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
    ],
  );

  return (
    <WorkspaceDecorContext.Provider value={value}>{children}</WorkspaceDecorContext.Provider>
  );
}
