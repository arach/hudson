'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTerminalRelay, TerminalRelay, usePlatform } from 'hudsonkit';
import { Plus, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Single session — one relay + one TerminalRelay component
// ---------------------------------------------------------------------------

function TerminalSession({ id, cwd }: { id: string; cwd: string }) {
  const { serviceApiUrl } = usePlatform();

  const relay = useTerminalRelay({
    url: 'ws://localhost:3600',
    systemPrompt: `You are a general-purpose terminal assistant running inside HudsonKit.
Help the user with shell commands, file management, coding, and any other tasks.
Be concise and action-oriented.`,
    cwd,
    sessionKey: `terminal-${id}`,
  });

  const configItems = useMemo(() => [
    { label: 'Relay', value: 'ws://localhost:3600' },
    { label: 'CWD', value: cwd },
  ], [cwd]);

  const handleStartRelay = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${serviceApiUrl}/api/services/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: 'relay', action: 'start', triggeredBy: 'user' }),
      });
      const data = await res.json();
      return data.success === true;
    } catch {
      return false;
    }
  }, [serviceApiUrl]);

  return (
    <TerminalRelay
      relay={relay}
      configItems={configItems}
      onStartService={handleStartRelay}
    />
  );
}

// ---------------------------------------------------------------------------
// Multi-session container with tab bar
// ---------------------------------------------------------------------------

interface TabState {
  id: string;
  label: string;
  cwd: string;
}

let nextTabId = 1;
function makeTab(cwd = '~'): TabState {
  const id = `term-${nextTabId++}`;
  return { id, label: `Terminal ${nextTabId - 1}`, cwd };
}

export function TerminalContent({ initialCwd = '~' }: { initialCwd?: string } = {}) {
  const [tabs, setTabs] = useState<TabState[]>(() => [makeTab(initialCwd)]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0].id);

  const addTab = useCallback(() => {
    const tab = makeTab();
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id);
      if (next.length === 0) {
        // Always keep at least one tab
        const fresh = makeTab();
        setActiveTabId(fresh.id);
        return [fresh];
      }
      // If closing the active tab, switch to neighbor
      if (id === activeTabId) {
        const idx = prev.findIndex(t => t.id === id);
        const newActive = next[Math.min(idx, next.length - 1)];
        setActiveTabId(newActive.id);
      }
      return next;
    });
  }, [activeTabId]);

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0a]">
      {/* Tab bar — only show when multiple tabs */}
      {tabs.length > 1 && (
        <div className="h-7 shrink-0 flex items-center gap-px px-1 bg-neutral-900/80 border-b border-neutral-700/40 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`group flex items-center gap-1.5 px-2.5 h-6 rounded text-[11px] font-mono transition-colors ${
                tab.id === activeTabId
                  ? 'bg-white/8 text-neutral-200'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/4'
              }`}
            >
              <span className="truncate max-w-[100px]">{tab.label}</span>
              <span
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 hover:text-red-400 transition-all"
              >
                <X size={9} />
              </span>
            </button>
          ))}
          <button
            onClick={addTab}
            className="p-1 rounded text-neutral-500 hover:text-neutral-300 hover:bg-white/6 transition-colors"
            title="New terminal"
          >
            <Plus size={11} />
          </button>
        </div>
      )}

      {/* Terminal sessions — render all but only show active */}
      <div className="flex-1 relative overflow-hidden">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className="absolute inset-0"
            style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
          >
            <TerminalSession id={tab.id} cwd={tab.cwd} />
          </div>
        ))}
      </div>

      {/* New tab button when single tab (no tab bar shown) */}
      {tabs.length === 1 && (
        <button
          onClick={addTab}
          className="absolute top-1 right-1 z-10 p-1 rounded text-neutral-600 hover:text-neutral-300 hover:bg-white/8 transition-colors"
          title="New terminal"
        >
          <Plus size={12} />
        </button>
      )}
    </div>
  );
}
