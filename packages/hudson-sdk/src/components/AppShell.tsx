'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Frame from './chrome/Frame';
import NavigationBar from './chrome/NavigationBar';
import SidePanel from './chrome/SidePanel';
import StatusBar from './chrome/StatusBar';
import CommandDock from './chrome/CommandDock';
import CommandPalette from './overlays/CommandPalette';
import TerminalDrawer from './overlays/TerminalDrawer';
import { Assistant } from './Assistant';
import { usePersistentState } from '../hooks/usePersistentState';
import { InstanceProvider } from '../context/InstanceContext';
import { usePlatformLayout } from '../platform/usePlatformLayout';
import type { HudsonApp } from '../types/app';
import type { CommandOption } from './overlays/CommandPalette';
import { ChevronDown, ChevronRight, Terminal as TerminalIcon, Sparkles } from 'lucide-react';
import {
  HudsonThemeScript,
  ThemeProvider,
  type HudsonTemplate,
  type HudsonTheme,
  useOptionalTheme,
} from '../theme';

// ---------------------------------------------------------------------------
// AppShell — the default Hudson shell: renders a single HudsonApp with full
// chrome (nav bar, side panels, status bar, command palette, terminal drawer).
// Use WorkspaceShell instead when you need multi-app canvas mode.
// ---------------------------------------------------------------------------
interface AppShellProps {
  app: HudsonApp;
  /** Disable the built-in Assistant tab in the bottom drawer. Defaults to true (Assistant on). */
  assistant?: boolean;
  /** Default theme; user can still switch at runtime. Defaults to 'system'. */
  defaultTheme?: HudsonTheme;
  /** Default template. Defaults to 'hudson'. */
  defaultTemplate?: HudsonTemplate;
  /** When false, AppShell assumes a parent ThemeProvider already exists. */
  managedTheme?: boolean;
}

export function AppShell({
  app,
  assistant = true,
  defaultTheme = 'system',
  defaultTemplate = 'hudson',
  managedTheme = true,
}: AppShellProps) {
  const theme = useOptionalTheme();

  const content = (
    <InstanceProvider instanceId={app.id} appId={app.id}>
      <app.Provider>
        <AppShellInner app={app} assistantEnabled={assistant} />
      </app.Provider>
    </InstanceProvider>
  );

  if (!managedTheme || theme) {
    return content;
  }

  return (
    <>
      <HudsonThemeScript
        defaultTheme={defaultTheme}
        defaultTemplate={defaultTemplate}
      />
      <ThemeProvider
        defaultTheme={defaultTheme}
        defaultTemplate={defaultTemplate}
      >
        {content}
      </ThemeProvider>
    </>
  );
}

// ---------------------------------------------------------------------------
// AppShellInner — rendered inside Provider so app hooks can be called
// ---------------------------------------------------------------------------
function AppShellInner({ app, assistantEnabled }: { app: HudsonApp; assistantEnabled: boolean }) {
  const theme = useOptionalTheme();
  // Platform layout
  const { navTotalHeight } = usePlatformLayout();

  // App hooks
  const appCommands = app.hooks.useCommands();
  const appStatus = app.hooks.useStatus();
  const appSearch = app.hooks.useSearch?.() ?? null;
  const appNavCenter = app.hooks.useNavCenter?.() ?? null;
  const appNavActions = app.hooks.useNavActions?.() ?? null;
  const layoutMode = app.hooks.useLayoutMode?.() ?? app.mode;
  const activeToolHint = app.hooks.useActiveToolHint?.() ?? null;
  const takeover = app.hooks.useTakeover?.() ?? null;
  const takeoverActive = takeover?.active === true;
  const takeoverDismissible = takeoverActive && takeover?.dismissible === true;
  const takeoverOnDismiss = takeover?.onDismiss;
  const TakeoverSlot = app.slots.Takeover;

  // Panel state
  const [leftCollapsed, setLeftCollapsed] = usePersistentState(`appshell.${app.id}.left`, false);
  const [rightCollapsed, setRightCollapsed] = usePersistentState(`appshell.${app.id}.right`, false);
  const [leftWidth, setLeftWidth] = usePersistentState(`appshell.${app.id}.leftW`, 260);
  const [rightWidth, setRightWidth] = usePersistentState(`appshell.${app.id}.rightW`, 280);

  // Canvas pan/zoom state
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  const handlePan = useCallback((delta: { x: number; y: number }) => {
    setPanOffset(prev => ({ x: prev.x + delta.x, y: prev.y + delta.y }));
  }, []);

  const handleZoom = useCallback((newScale: number) => {
    setScale(newScale);
  }, []);

  // Terminal
  const [showTerminal, setShowTerminal] = useState(false);
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);
  const [terminalHeight, setTerminalHeight] = usePersistentState(`appshell.${app.id}.termH`, 320);

  // Drawer tabs — Terminal slot (if app provides one) and Assistant (if enabled)
  const hasTerminalSlot = !!app.slots.Terminal;
  const drawerTabs = useMemo<DrawerTab[]>(() => {
    const tabs: DrawerTab[] = [];
    if (hasTerminalSlot) tabs.push('terminal');
    if (assistantEnabled) tabs.push('assistant');
    return tabs;
  }, [hasTerminalSlot, assistantEnabled]);
  const defaultTab: DrawerTab = drawerTabs[0] ?? 'terminal';
  const [activeTab, setActiveTab] = usePersistentState<DrawerTab>(
    `appshell.${app.id}.drawerTab`,
    defaultTab,
  );
  // Guard against stored value referencing a tab that's no longer available
  const resolvedTab: DrawerTab = drawerTabs.includes(activeTab) ? activeTab : defaultTab;

  // Command palette
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Tools accordion (open sections)
  const [openTools, setOpenTools] = useState<Set<string>>(new Set());

  const toggleTool = useCallback((id: string) => {
    setOpenTools(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Resize handlers
  const handleResizeStart = useCallback((side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = side === 'left' ? leftWidth : rightWidth;
    const setter = side === 'left' ? setLeftWidth : setRightWidth;
    const direction = side === 'left' ? 1 : -1;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = (ev.clientX - startX) * direction;
      setter(Math.max(200, Math.min(500, startWidth + delta)));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [leftWidth, rightWidth, setLeftWidth, setRightWidth]);

  // Shell commands
  const shellCommands: CommandOption[] = useMemo(() => {
    const cmds: CommandOption[] = [
      { id: 'shell:toggle-left', label: 'Toggle Left Panel', shortcut: 'Cmd+[', action: () => setLeftCollapsed(c => !c) },
      { id: 'shell:toggle-right', label: 'Toggle Right Panel', shortcut: 'Cmd+]', action: () => setRightCollapsed(c => !c) },
      { id: 'shell:toggle-terminal', label: 'Toggle Terminal', shortcut: 'Ctrl+`', action: () => setShowTerminal(t => !t) },
    ];
    if (assistantEnabled) {
      cmds.push({
        id: 'shell:toggle-assistant',
        label: 'Toggle Assistant',
        shortcut: 'Cmd+J',
        action: () => {
          setActiveTab('assistant');
          setShowTerminal(t => !t || activeTab !== 'assistant');
        },
      });
    }
    if (theme) {
      cmds.push(
        { id: 'shell:theme:light', label: 'Theme: Light', action: () => theme.setTheme('light') },
        { id: 'shell:theme:dark', label: 'Theme: Dark', action: () => theme.setTheme('dark') },
        { id: 'shell:theme:system', label: 'Theme: System', action: () => theme.setTheme('system') },
        { id: 'shell:template:hudson', label: 'Template: Hudson', action: () => theme.setTemplate('hudson') },
        { id: 'shell:template:editorial', label: 'Template: Editorial', action: () => theme.setTemplate('editorial') },
      );
    }
    return cmds;
  }, [activeTab, assistantEnabled, setActiveTab, setLeftCollapsed, setRightCollapsed, theme]);

  const allCommands = useMemo(() => [
    ...appCommands,
    ...shellCommands,
  ], [appCommands, shellCommands]);

  // Keyboard shortcuts — suppressed while a takeover is active so the
  // blocking flow isn't bypassed by chrome shortcuts (cmd+k, terminal, etc.)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (takeoverActive) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '[') {
        e.preventDefault();
        setLeftCollapsed(c => !c);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ']') {
        e.preventDefault();
        setRightCollapsed(c => !c);
      }
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        setShowTerminal(t => !t);
      }
      if (assistantEnabled && (e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setActiveTab('assistant');
        setShowTerminal(t => !(t && resolvedTab === 'assistant'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setLeftCollapsed, setRightCollapsed, assistantEnabled, resolvedTab, setActiveTab, takeoverActive]);

  // Right panel content: Inspector + tools accordion
  const InspectorSlot = app.slots.Inspector;
  const RightPanelSlot = app.slots.RightPanel;
  const hasTools = app.tools && app.tools.length > 0;

  const rightContent = (
    <>
      {InspectorSlot && <InspectorSlot />}
      {!InspectorSlot && RightPanelSlot && <RightPanelSlot />}
      {hasTools && (
        <div className="border-t border-border/60">
          {app.tools!.map(tool => {
            const isOpen = openTools.has(tool.id);
            return (
              <div key={tool.id}>
                <button
                  onClick={() => toggleTool(tool.id)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-mono tracking-wider uppercase transition-colors hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none ${
                    activeToolHint === tool.id ? 'text-accent' : 'text-foreground'
                  }`}
                >
                  {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  <span className="text-muted-foreground">{tool.icon}</span>
                  <span className="font-bold">{tool.name}</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-3">
                    <tool.Component />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  // Left panel footer: LeftFooter slot only
  const leftFooter = app.slots.LeftFooter ? <app.slots.LeftFooter /> : undefined;

  // Right panel footer: CommandDock
  const rightFooter = (
    <CommandDock onOpenCommandPalette={() => setShowCommandPalette(true)} />
  );

  // Takeover refs + effects — background goes `inert` while active so focus
  // and pointer events can't reach chrome. Initial focus is moved into the
  // overlay; Escape dismisses when dismissible. Focus stays trapped naturally
  // because everything outside is inert.
  const backgroundRef = useRef<HTMLDivElement>(null);
  const takeoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = backgroundRef.current;
    if (!el) return;
    if (takeoverActive) {
      el.setAttribute('inert', '');
    } else {
      el.removeAttribute('inert');
    }
  }, [takeoverActive]);

  useEffect(() => {
    if (!takeoverActive) return;
    const el = takeoverRef.current;
    if (el) {
      const firstFocusable = el.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (firstFocusable ?? el).focus();
    }
    if (!takeoverDismissible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        takeoverOnDismiss?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [takeoverActive, takeoverDismissible, takeoverOnDismiss]);

  // Whether side panels should be visible — canvas/focus modes hide them
  const showPanels = layoutMode === 'panel';
  // Focus mode: panel-style content rendering (no pan/zoom) but no sidebars
  const frameMode = layoutMode === 'focus' ? 'panel' : layoutMode;

  // Content insets — offset content area so it doesn't render behind fixed chrome
  const contentStyle: React.CSSProperties = frameMode === 'panel' ? {
    position: 'absolute',
    top: navTotalHeight,
    bottom: 28, // status bar
    left: showPanels && !leftCollapsed ? leftWidth : 0,
    right: showPanels && !rightCollapsed ? rightWidth : 0,
    overflow: 'auto',
    transition: 'left 200ms ease, right 200ms ease',
  } : {};

  const shell = (
    <>
    <div ref={backgroundRef} aria-hidden={takeoverActive ? true : undefined} style={{ display: 'contents' }}>
    <Frame
      mode={frameMode}
      panOffset={panOffset}
      scale={scale}
      onPan={handlePan}
      onZoom={handleZoom}
      hud={
        <>
          <NavigationBar
            title={app.name.toUpperCase()}
            subtitle={app.icon}
            search={appSearch ?? undefined}
            center={appNavCenter}
            actions={appNavActions}
          />

          {showPanels && (
            <SidePanel
              side="left"
              title={app.leftPanel?.title ?? 'Navigation'}
              icon={app.leftPanel?.icon}
              isCollapsed={leftCollapsed}
              onToggleCollapse={() => setLeftCollapsed(!leftCollapsed)}
              width={leftWidth}
              onResizeStart={handleResizeStart('left')}
              footer={leftFooter}
              headerActions={app.leftPanel?.headerActions && <app.leftPanel.headerActions />}
            >
              {app.slots.LeftPanel && <app.slots.LeftPanel />}
            </SidePanel>
          )}

          {showPanels && (
            <SidePanel
              side="right"
              title={app.rightPanel?.title ?? 'Inspector'}
              icon={app.rightPanel?.icon}
              isCollapsed={rightCollapsed}
              onToggleCollapse={() => setRightCollapsed(!rightCollapsed)}
              width={rightWidth}
              onResizeStart={handleResizeStart('right')}
              footer={rightFooter}
              headerActions={app.rightPanel?.headerActions && <app.rightPanel.headerActions />}
            >
              {rightContent}
            </SidePanel>
          )}

          <StatusBar
            status={appStatus}
            onToggleTerminal={() => setShowTerminal(t => !t)}
            isTerminalOpen={showTerminal}
          />

          {/* Terminal — inset between panels */}
          <div
            className="pointer-events-none"
            style={{
              position: 'fixed',
              left: showPanels && !leftCollapsed ? leftWidth : 0,
              right: showPanels && !rightCollapsed ? rightWidth : 0,
              bottom: 0,
              top: 0,
              zIndex: 45,
              transition: 'left 200ms ease, right 200ms ease',
              transform: 'translateZ(0)',
            }}
          >
            <TerminalDrawer
              isOpen={showTerminal}
              onClose={() => setShowTerminal(false)}
              onToggleMaximize={() => setIsTerminalMaximized(m => !m)}
              isMaximized={isTerminalMaximized}
              height={terminalHeight}
              onHeightChange={setTerminalHeight}
              title={
                <DrawerTabs
                  tabs={drawerTabs}
                  active={resolvedTab}
                  onSelect={setActiveTab}
                />
              }
            >
              {resolvedTab === 'terminal' && (
                app.slots.Terminal ? (
                  <app.slots.Terminal />
                ) : (
                  <div className="p-4 font-mono text-[12px] text-muted-foreground">
                    No terminal content
                  </div>
                )
              )}
              {resolvedTab === 'assistant' && (
                <Assistant app={app} commands={appCommands} />
              )}
            </TerminalDrawer>
          </div>

          {/* Command palette */}
          <CommandPalette
            isOpen={showCommandPalette}
            onClose={() => setShowCommandPalette(false)}
            commands={allCommands}
          />
        </>
      }
    >
      <div style={contentStyle} className="frame-scrollbar select-text">
        <app.slots.Content />
      </div>
    </Frame>
    </div>
    {takeoverActive && TakeoverSlot ? (
      <div
        ref={takeoverRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        style={{ position: 'fixed', inset: 0, zIndex: 80, outline: 'none' }}
      >
        <TakeoverSlot />
      </div>
    ) : null}
    </>
  );

  if (!theme) {
    return shell;
  }

  return (
    <div
      data-hudson-theme={theme.resolvedTheme}
      data-hudson-template={theme.template}
    >
      {shell}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawer tabs — Terminal slot vs Assistant
// ---------------------------------------------------------------------------
type DrawerTab = 'terminal' | 'assistant';

function DrawerTabs({
  tabs,
  active,
  onSelect,
}: {
  tabs: DrawerTab[];
  active: DrawerTab;
  onSelect: (tab: DrawerTab) => void;
}) {
  if (tabs.length === 0) return null;
  return (
    <div className="flex items-center gap-0.5">
      {tabs.map(tab => {
        const isActive = tab === active;
        const Icon = tab === 'terminal' ? TerminalIcon : Sparkles;
        const label = tab === 'terminal' ? 'TERMINAL' : 'ASSISTANT';
        const activeClasses = tab === 'terminal' ? 'text-accent bg-accent/10' : 'text-info bg-info/10';
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onSelect(tab)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold tracking-widest font-mono transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
              isActive
                ? activeClasses
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
            }`}
          >
            <Icon size={13} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
