'use client';

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { AppIntent, IntentCatalog } from '@hudson/sdk';
import { buildIntentCatalog } from '../../lib/intent-catalog';
import { hudsonOSWorkspace } from '../../workspaces/hudsonOS';
import type { FloatingCard } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface IntentGroup {
  id: string;
  label: string;
  intents: AppIntent[];
}

interface ExplorerContextValue {
  catalog: IntentCatalog;
  groups: IntentGroup[];
  selectedIntentId: string | null;
  setSelectedIntentId: (id: string | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  collapsedGroups: Set<string>;
  toggleGroup: (id: string) => void;
  activeGroupId: string | null;
  setActiveGroupId: (id: string | null) => void;

  // Detail column
  detailOpen: boolean;
  setDetailOpen: (open: boolean) => void;

  // Floating cards
  floatingCards: FloatingCard[];
  addFloatingCard: (intentId: string) => void;
  removeFloatingCard: (cardId: string) => void;
  bringCardToFront: (cardId: string) => void;
  cardPositions: Record<string, { x: number; y: number }>;
  handleCardDragStart: (cardId: string, e: React.MouseEvent) => void;
  isDraggingCardRef: React.RefObject<boolean>;
}

const ExplorerContext = createContext<ExplorerContextValue | null>(null);

export function useExplorer(): ExplorerContextValue {
  const ctx = useContext(ExplorerContext);
  if (!ctx) throw new Error('useExplorer must be used within IntentProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function matchesSearch(intent: AppIntent, query: string): boolean {
  const q = query.toLowerCase();
  return (
    intent.title.toLowerCase().includes(q) ||
    intent.description.toLowerCase().includes(q) ||
    intent.commandId.toLowerCase().includes(q) ||
    intent.keywords.some(k => k.toLowerCase().includes(q)) ||
    intent.category.toLowerCase().includes(q) ||
    (intent.shortcut?.toLowerCase().includes(q) ?? false)
  );
}

function buildGroups(catalog: IntentCatalog, query: string): IntentGroup[] {
  const groups: IntentGroup[] = [];

  // Shell group
  const shellIntents = query
    ? catalog.shell.filter(i => matchesSearch(i, query))
    : catalog.shell;
  if (shellIntents.length > 0) {
    groups.push({ id: 'shell', label: 'Shell', intents: shellIntents });
  }

  // App groups
  for (const app of catalog.apps) {
    const intents = query
      ? app.intents.filter(i => matchesSearch(i, query))
      : app.intents;
    if (intents.length > 0) {
      groups.push({ id: app.appId, label: app.appName, intents });
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
let cardIdCounter = 0;

export function IntentProvider({ children }: { children: ReactNode }) {
  const catalog = useMemo(() => buildIntentCatalog(hudsonOSWorkspace), []);

  const [selectedIntentId, setSelectedIntentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // Detail column
  const [detailOpen, setDetailOpen] = useState(false);

  // Floating cards
  const [floatingCards, setFloatingCards] = useState<FloatingCard[]>([]);
  const [cardPositions, setCardPositions] = useState<Record<string, { x: number; y: number }>>({});
  const zCounterRef = useRef(1);
  const isDraggingCardRef = useRef(false);

  const groups = useMemo(
    () => buildGroups(catalog, searchQuery),
    [catalog, searchQuery],
  );

  const toggleGroup = useCallback((id: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Floating card actions
  const addFloatingCard = useCallback((intentId: string) => {
    const id = `card-${++cardIdCounter}`;
    const z = zCounterRef.current++;
    // Stagger position based on current card count
    setFloatingCards(prev => {
      const offset = prev.length * 24;
      setCardPositions(p => ({ ...p, [id]: { x: 80 + offset, y: 60 + offset } }));
      return [...prev, { id, intentId, zIndex: z }];
    });
  }, []);

  const removeFloatingCard = useCallback((cardId: string) => {
    setFloatingCards(prev => prev.filter(c => c.id !== cardId));
    setCardPositions(prev => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
  }, []);

  const bringCardToFront = useCallback((cardId: string) => {
    const z = zCounterRef.current++;
    setFloatingCards(prev =>
      prev.map(c => (c.id === cardId ? { ...c, zIndex: z } : c)),
    );
  }, []);

  // Card drag handler (panel mode — no zoom division needed)
  const handleCardDragStart = useCallback((cardId: string, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    e.preventDefault();
    e.stopPropagation();

    bringCardToFront(cardId);

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = cardPositions[cardId] ?? { x: 80, y: 60 };
    let dragged = false;

    const onMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragged && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      dragged = true;
      isDraggingCardRef.current = true;

      setCardPositions(prev => ({
        ...prev,
        [cardId]: {
          x: startPos.x + dx,
          y: startPos.y + dy,
        },
      }));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      setTimeout(() => { isDraggingCardRef.current = false; }, 0);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [cardPositions, bringCardToFront]);

  const value: ExplorerContextValue = {
    catalog,
    groups,
    selectedIntentId,
    setSelectedIntentId,
    searchQuery,
    setSearchQuery,
    collapsedGroups,
    toggleGroup,
    activeGroupId,
    setActiveGroupId,
    detailOpen,
    setDetailOpen,
    floatingCards,
    addFloatingCard,
    removeFloatingCard,
    bringCardToFront,
    cardPositions,
    handleCardDragStart,
    isDraggingCardRef,
  };

  return (
    <ExplorerContext.Provider value={value}>{children}</ExplorerContext.Provider>
  );
}
