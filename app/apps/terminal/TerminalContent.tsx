'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTerminalRelay, TerminalRelay, usePlatform } from 'hudsonkit';
import { Plus, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Single session — one relay + one TerminalRelay component
// ---------------------------------------------------------------------------

type TerminalBackend = 'pty' | 'tmux';

function TerminalSession({
  id,
  cwd,
  backend = 'pty',
  tmuxSession,
}: {
  id: string;
  cwd: string;
  backend?: TerminalBackend;
  tmuxSession?: string;
}) {
  const { serviceApiUrl } = usePlatform();

  const relay = useTerminalRelay({
    url: 'ws://localhost:3600',
    agent: 'shell',
    cwd,
    sessionKey: `shell-terminal-${id}`,
    backend,
    ...(backend === 'tmux'
      ? { tmuxSession: tmuxSession ?? `hudson-${id}` }
      : {}),
  });

  const configItems = useMemo(() => [
    { label: 'Relay', value: 'ws://localhost:3600' },
    { label: 'Backend', value: backend },
    { label: 'CWD', value: cwd },
    ...(backend === 'tmux' ? [{ label: 'tmux session', value: tmuxSession ?? `hudson-${id}` }] : []),
  ], [backend, cwd, id, tmuxSession]);

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
  backend: TerminalBackend;
  tmuxSession?: string;
}

let nextTabId = 1;
function makeTab(
  cwd = '~',
  backend: TerminalBackend = 'pty',
  tmuxSession?: string,
): TabState {
  const id = `term-${nextTabId++}`;
  return { id, label: `Terminal ${nextTabId - 1}`, cwd, backend, tmuxSession };
}

export interface TerminalContentProps {
  initialCwd?: string;
  /** PTY (default) vs tmux. Tmux sessions persist across reloads. */
  backend?: TerminalBackend;
  /** Override the auto-generated tmux session name. Only used when backend='tmux'. */
  tmuxSession?: string;
}

export function TerminalContent({
  initialCwd = '~',
  backend = 'pty',
  tmuxSession,
}: TerminalContentProps = {}) {
  const [tabs, setTabs] = useState<TabState[]>(() => [
    makeTab(initialCwd, backend, tmuxSession),
  ]);
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
    <div className="w-full h-full flex flex-col bg-background text-foreground">
      {/* Tab bar — only show when multiple tabs */}
      {tabs.length > 1 && (
        <div className="h-7 shrink-0 flex items-center gap-px px-1 bg-card/80 border-b border-border/60 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`group flex items-center gap-1.5 px-2.5 h-6 rounded text-[11px] font-mono transition-colors ${
                tab.id === activeTabId
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
              }`}
            >
              <span className="truncate max-w-[100px]">{tab.label}</span>
              <span
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
              >
                <X size={9} />
              </span>
            </button>
          ))}
          <button
            onClick={addTab}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
            <TerminalSession
              id={tab.id}
              cwd={tab.cwd}
              backend={tab.backend}
              tmuxSession={tab.tmuxSession}
            />
          </div>
        ))}
      </div>

      {/* New tab button when single tab (no tab bar shown) */}
      {tabs.length === 1 && (
        <button
          onClick={addTab}
          className="absolute top-1 right-1 z-10 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="New terminal"
        >
          <Plus size={12} />
        </button>
      )}
    </div>
  );
}
