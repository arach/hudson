'use client';

import { useRef, useCallback } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import type { AppIntent } from 'hudsonkit';
import { useExplorer } from './IntentProvider';
import { CATEGORY_COLORS } from './types';

// ---------------------------------------------------------------------------
// IntentList — scrollable grouped intent list
// ---------------------------------------------------------------------------
export function IntentList() {
  const {
    groups,
    selectedIntentId,
    setSelectedIntentId,
    setDetailOpen,
    collapsedGroups,
    toggleGroup,
    setActiveGroupId,
  } = useExplorer();

  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const setGroupRef = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      groupRefs.current[id] = el;
    },
    [],
  );

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500 text-[12px] font-mono">
        No intents match your search
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto frame-scrollbar">
      <div className="py-2">
        {groups.map(group => {
          const isCollapsed = collapsedGroups.has(group.id);
          return (
            <div key={group.id} ref={setGroupRef(group.id)} data-group-id={group.id}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/5 transition-colors"
              >
                {isCollapsed ? (
                  <ChevronRight size={12} className="text-neutral-500 shrink-0" />
                ) : (
                  <ChevronDown size={12} className="text-neutral-500 shrink-0" />
                )}
                <span className="text-[11px] font-mono font-bold text-neutral-200 tracking-wider uppercase">
                  {group.label}
                </span>
                <span className="text-[10px] font-mono text-neutral-500">
                  ({group.intents.length})
                </span>
              </button>

              {/* Intent rows */}
              {!isCollapsed && (
                <div>
                  {group.intents.map(intent => (
                    <IntentRow
                      key={intent.commandId}
                      intent={intent}
                      isSelected={selectedIntentId === intent.commandId}
                      onSelect={() => {
                        setSelectedIntentId(intent.commandId);
                        setDetailOpen(true);
                        setActiveGroupId(group.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IntentRow
// ---------------------------------------------------------------------------
function IntentRow({
  intent,
  isSelected,
  onSelect,
}: {
  intent: AppIntent;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const categoryColors = CATEGORY_COLORS[intent.category];

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-1.5 text-left transition-colors ${
        isSelected
          ? 'bg-emerald-500/10 border-l-2 border-emerald-400'
          : 'border-l-2 border-transparent hover:bg-white/5'
      }`}
    >
      {/* Shortcut badge */}
      <div className="w-[52px] shrink-0 flex justify-end">
        {intent.shortcut ? (
          <span className="bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded text-[10px] font-mono leading-none">
            {intent.shortcut}
          </span>
        ) : (
          <span className="text-neutral-600 text-[10px] font-mono">--</span>
        )}
      </div>

      {/* Title */}
      <span
        className={`flex-1 text-[12px] font-mono truncate ${
          isSelected ? 'text-emerald-300' : 'text-neutral-200'
        }`}
      >
        {intent.title}
        {intent.dangerous && (
          <AlertTriangle size={10} className="inline ml-1.5 text-red-400" />
        )}
      </span>

      {/* Category pill */}
      <span
        className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${categoryColors}`}
      >
        {intent.category}
      </span>
    </button>
  );
}
