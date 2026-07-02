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
import { ObjectCodeSurface, ObjectCodeWorkbench } from './controls/ObjectCodeSurface';
import { usePersistentState } from '../hooks/usePersistentState';
import { InstanceProvider } from '../context/InstanceContext';
import {
  AppShellControlsProvider,
  type AppShellControlsContextValue,
  type DrawerControls,
  type DrawerTab,
  type PaletteControls,
  type SidePanelControls,
} from '../context/AppShellControlsContext';
import { usePlatformLayout } from '../platform/usePlatformLayout';
import type { HudsonApp } from '../types/app';
import type { HudsonCodeWorkbenchSize } from '../types/code';
import type { CommandOption } from './overlays/CommandPalette';
import { ChevronDown, ChevronRight, Code2, Terminal as TerminalIcon, Sparkles } from 'lucide-react';
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
export interface AppShellChromeOptions {
  /** Render the top navigation bar. Defaults to true. */
  nav?: boolean;
  /** Render the bottom status bar. Defaults to true. */
  statusBar?: boolean;
  /** Render the left side panel when the app is in panel layout. Defaults to true. */
  leftPanel?: boolean;
  /** Render the right side panel when the app is in panel layout. Defaults to true. */
  rightPanel?: boolean;
  /** Enable the command palette chrome and Cmd/Ctrl+K shortcut. Defaults to true. */
  palette?: boolean;
  /** Enable the terminal/assistant drawer chrome and shortcuts. Defaults to true. */
  terminal?: boolean;
}

const DEFAULT_APP_SHELL_CHROME: Required<AppShellChromeOptions> = {
  nav: true,
  statusBar: true,
  leftPanel: true,
  rightPanel: true,
  palette: true,
  terminal: true,
};

const DEFAULT_PANEL_MIN = 200;
const DEFAULT_PANEL_MAX = 500;

function panelBounds(app: HudsonApp, side: 'left' | 'right') {
  const layout = app.layout;
  const sideBounds = side === 'left' ? layout?.left : layout?.right;
  return {
    min: sideBounds?.min ?? layout?.minPanelWidth ?? DEFAULT_PANEL_MIN,
    max: sideBounds?.max ?? layout?.maxPanelWidth ?? DEFAULT_PANEL_MAX,
  };
}

function clampPanelWidth(app: HudsonApp, side: 'left' | 'right', px: number) {
  const { min, max } = panelBounds(app, side);
  return Math.max(min, Math.min(max, px));
}

interface AppShellProps {
  app: HudsonApp;
  /** Disable the built-in Assistant tab in the bottom drawer. Defaults to true (Assistant on). */
  assistant?: boolean;
  /** Per-feature chrome opt-outs. Each feature defaults to true. */
  chrome?: AppShellChromeOptions;
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
  chrome,
  defaultTheme = 'system',
  defaultTemplate = 'hudson',
  managedTheme = true,
}: AppShellProps) {
  const theme = useOptionalTheme();

  const content = (
    <InstanceProvider instanceId={app.id} appId={app.id}>
      <app.Provider>
        <AppShellInner app={app} assistantEnabled={assistant} chrome={chrome} />
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
function AppShellInner({
  app,
  assistantEnabled,
  chrome: chromeOptions,
}: {
  app: HudsonApp;
  assistantEnabled: boolean;
  chrome?: AppShellChromeOptions;
}) {
  const theme = useOptionalTheme();
  const chrome = useMemo<Required<AppShellChromeOptions>>(
    () => ({ ...DEFAULT_APP_SHELL_CHROME, ...chromeOptions }),
    [chromeOptions],
  );
  // Platform layout
  const { navTotalHeight } = usePlatformLayout();

  // App hooks
  const appCommands = app.hooks.useCommands();
  const appStatus = app.hooks.useStatus();
  const appStatusLeft = app.hooks.useStatusLeft?.() ?? null;
  const appStatusRight = app.hooks.useStatusRight?.() ?? null;
  const appSearch = app.hooks.useSearch?.() ?? null;
  const appNavCenter = app.hooks.useNavCenter?.() ?? null;
  const appNavActions = app.hooks.useNavActions?.() ?? null;
  const layoutMode = app.hooks.useLayoutMode?.() ?? app.mode;
  const activeToolHint = app.hooks.useActiveToolHint?.() ?? null;
  const takeover = app.hooks.useTakeover?.() ?? null;
  const codeSurface = app.hooks.useCodeSurface?.() ?? null;
  const codePlacement = codeSurface?.placement ?? app.code?.placement ?? 'workbench';
  const codeInInspector = codeSurface?.open === true && Boolean(codeSurface.object) && codePlacement === 'inspector';
  const codeWorkbenchOpen = codeSurface?.open === true && Boolean(codeSurface.object) && codePlacement === 'workbench';
  const previousCodeWorkbenchOpenRef = useRef(false);
  const takeoverActive = takeover?.active === true;
  const takeoverDismissible = takeoverActive && takeover?.dismissible === true;
  const takeoverOnDismiss = takeover?.onDismiss;
  const TakeoverSlot = app.slots.Takeover;

  // Panel state
  const [leftCollapsed, setLeftCollapsed] = usePersistentState(`appshell.${app.id}.left`, false);
  const [rightCollapsed, setRightCollapsed] = usePersistentState(`appshell.${app.id}.right`, false);
  const [leftWidth, setLeftWidth] = usePersistentState(
    `appshell.${app.id}.leftW`,
    app.layout?.leftWidth ?? 260,
  );
  const [rightWidth, setRightWidth] = usePersistentState(
    `appshell.${app.id}.rightW`,
    app.layout?.rightWidth ?? 280,
  );
  const [codeWorkbenchSize, setCodeWorkbenchSize] = usePersistentState<HudsonCodeWorkbenchSize>(`appshell.${app.id}.codeWorkbenchSize`, 'half');
  const [codeWorkbenchEditorWidth, setCodeWorkbenchEditorWidth] = usePersistentState(`appshell.${app.id}.codeWorkbenchEditorWidth`, 420);
  const [codeWorkbenchChatWidth, setCodeWorkbenchChatWidth] = usePersistentState(`appshell.${app.id}.codeWorkbenchChatWidth`, 320);
  const [codeSheetWidth, setCodeSheetWidth] = usePersistentState(`appshell.${app.id}.codeSheetWidth`, 720);

  useEffect(() => {
    if (codeWorkbenchOpen && !previousCodeWorkbenchOpenRef.current && !rightCollapsed) {
      setRightCollapsed(true);
    }
    previousCodeWorkbenchOpenRef.current = codeWorkbenchOpen;
  }, [codeWorkbenchOpen, rightCollapsed, setRightCollapsed]);

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
      setter(clampPanelWidth(app, side, startWidth + delta));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [app, leftWidth, rightWidth, setLeftWidth, setRightWidth]);

  // Shell commands
  const shellCommands: CommandOption[] = useMemo(() => {
    if (!chrome.palette) return [];

    const cmds: CommandOption[] = [];
    if (chrome.leftPanel) {
      cmds.push({ id: 'shell:toggle-left', label: 'Toggle Left Panel', shortcut: 'Cmd+[', action: () => setLeftCollapsed(c => !c) });
    }
    if (chrome.rightPanel) {
      cmds.push({ id: 'shell:toggle-right', label: 'Toggle Right Panel', shortcut: 'Cmd+]', action: () => setRightCollapsed(c => !c) });
    }
    if (chrome.terminal) {
      cmds.push({ id: 'shell:toggle-terminal', label: 'Toggle Terminal', shortcut: 'Ctrl+`', action: () => setShowTerminal(t => !t) });
    }
    if (chrome.terminal && assistantEnabled) {
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
    if (codeSurface?.object) {
      cmds.push({
        id: `shell:code-surface:${app.id}`,
        label: codeSurface.open
          ? `Hide ${app.code?.label ?? codeSurface.label ?? 'Code'}`
          : (app.code?.commandLabel ?? app.code?.label ?? codeSurface.label ?? 'View Code'),
        icon: <Code2 size={14} />,
        action: () => codeSurface.setOpen(!codeSurface.open),
      });
    }
    if (theme) {
      cmds.push(
        { id: 'shell:theme:light', label: 'Theme: Light', action: () => theme.setTheme('light') },
        { id: 'shell:theme:dark', label: 'Theme: Dark', action: () => theme.setTheme('dark') },
        { id: 'shell:theme:system', label: 'Theme: System', action: () => theme.setTheme('system') },
        { id: 'shell:template:hudson', label: 'Template: Hudson', action: () => theme.setTemplate('hudson') },
        { id: 'shell:template:editorial', label: 'Template: Editorial', action: () => theme.setTemplate('editorial') },
        { id: 'shell:template:drafting', label: 'Template: Drafting', action: () => theme.setTemplate('drafting') },
      );
    }
    return cmds;
  }, [activeTab, app.code?.commandLabel, app.code?.label, app.id, assistantEnabled, chrome.leftPanel, chrome.palette, chrome.rightPanel, chrome.terminal, codeSurface, setActiveTab, setLeftCollapsed, setRightCollapsed, theme]);

  const allCommands = useMemo(() => [
    ...appCommands,
    ...shellCommands,
  ], [appCommands, shellCommands]);

  // Keyboard shortcuts — suppressed while a takeover is active so the
  // blocking flow isn't bypassed by chrome shortcuts (cmd+k, terminal, etc.)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (takeoverActive) return;
      if (chrome.palette && (e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      if (chrome.leftPanel && (e.metaKey || e.ctrlKey) && e.key === '[') {
        e.preventDefault();
        setLeftCollapsed(c => !c);
      }
      if (chrome.rightPanel && (e.metaKey || e.ctrlKey) && e.key === ']') {
        e.preventDefault();
        setRightCollapsed(c => !c);
      }
      if (chrome.terminal && e.ctrlKey && e.key === '`') {
        e.preventDefault();
        setShowTerminal(t => !t);
      }
      if (chrome.terminal && assistantEnabled && (e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setActiveTab('assistant');
        setShowTerminal(t => !(t && resolvedTab === 'assistant'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setLeftCollapsed, setRightCollapsed, assistantEnabled, resolvedTab, setActiveTab, takeoverActive, chrome.leftPanel, chrome.palette, chrome.rightPanel, chrome.terminal]);

  // Right panel content: Inspector + tools accordion
  const InspectorSlot = app.slots.Inspector;
  const RightPanelSlot = app.slots.RightPanel;
  const hasTools = app.tools && app.tools.length > 0;
  const codeSurfaceHeaderAction = codeSurface?.object ? (
    <button
      type="button"
      onClick={() => codeSurface.setOpen(!codeSurface.open)}
      className={`rounded p-1 transition-colors ${
        codeSurface.open
          ? 'bg-cyan-700/10 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-200'
          : 'text-muted-foreground/80 hover:bg-muted/50 hover:text-foreground'
      }`}
      title={codeSurface.open ? 'Hide code' : (app.code?.label ?? codeSurface.label ?? 'View code')}
      aria-label={codeSurface.open ? 'Hide code' : (app.code?.label ?? codeSurface.label ?? 'View code')}
    >
      <Code2 size={12} />
    </button>
  ) : null;
  const rightHeaderActions = codeSurfaceHeaderAction || app.rightPanel?.headerActions
    ? (
      <div className="flex items-center gap-1">
        {codeSurfaceHeaderAction}
        {app.rightPanel?.headerActions && <app.rightPanel.headerActions />}
      </div>
    )
    : undefined;

  const rightContent = (
    <>
      {codeInInspector && codeSurface?.object && (
        <ObjectCodeSurface
          object={codeSurface.object}
          placement="inspector"
          onClose={() => codeSurface.setOpen(false)}
          className="min-h-[420px]"
        />
      )}
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
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-[10px] font-mono tracking-[0.18em] uppercase transition-colors hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none ${
                    activeToolHint === tool.id ? 'text-accent' : 'text-muted-foreground'
                  }`}
                >
                  {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  <span className="text-muted-foreground/70">{tool.icon}</span>
                  <span className={activeToolHint === tool.id ? '' : ''}>{tool.name}</span>
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
  const rightFooter = chrome.palette
    ? <CommandDock onOpenCommandPalette={() => setShowCommandPalette(true)} />
    : undefined;

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
  const showLeftPanel = chrome.leftPanel && showPanels;
  const showRightPanel = chrome.rightPanel && showPanels;
  // Focus mode: panel-style content rendering (no pan/zoom) but no sidebars
  const frameMode = layoutMode === 'focus' ? 'panel' : layoutMode;
  const terminalCanvasBottomOffset = showTerminal && !isTerminalMaximized ? terminalHeight : 0;
  const showCanvasZoomControls = !showTerminal || !isTerminalMaximized;
  const topInset = chrome.nav ? navTotalHeight : 0;
  const bottomInset = chrome.statusBar ? 28 : 0;
  const leftInset = showLeftPanel && !leftCollapsed ? leftWidth : 0;
  const rightInset = showRightPanel && !rightCollapsed ? rightWidth : 0;

  // Content insets — offset content area so it doesn't render behind fixed chrome
  const contentStyle: React.CSSProperties = frameMode === 'panel' ? {
    position: 'absolute',
    top: topInset,
    bottom: bottomInset,
    left: leftInset,
    right: rightInset,
    overflow: 'auto',
    transition: 'top 200ms ease, bottom 200ms ease, left 200ms ease, right 200ms ease',
  } : {};

  // -------------------------------------------------------------------------
  // Imperative controls — published via AppShellControlsContext so app code
  // can do `useAppShellDrawer().open('terminal')` from inside its Provider.
  // When a feature is chrome-disabled, the matching methods no-op and the
  // `isOpen` flag always reports false.
  // -------------------------------------------------------------------------
  const drawerEnabled = chrome.terminal;
  const paletteEnabled = chrome.palette;

  const drawerControls = useMemo<DrawerControls>(() => ({
    isOpen: drawerEnabled && showTerminal,
    activeTab: drawerTabs.length > 0 ? resolvedTab : null,
    availableTabs: drawerTabs,
    isMaximized: isTerminalMaximized,
    height: terminalHeight,
    open: (tab) => {
      if (!drawerEnabled) return;
      if (tab && drawerTabs.includes(tab)) setActiveTab(tab);
      setShowTerminal(true);
    },
    close: () => setShowTerminal(false),
    toggle: (tab) => {
      if (!drawerEnabled) return;
      setShowTerminal((prev) => {
        if (!prev) {
          if (tab && drawerTabs.includes(tab)) setActiveTab(tab);
          return true;
        }
        if (tab && drawerTabs.includes(tab) && resolvedTab !== tab) {
          setActiveTab(tab);
          return true;
        }
        return false;
      });
    },
    setTab: (tab) => {
      if (drawerTabs.includes(tab)) setActiveTab(tab);
    },
    maximize: () => setIsTerminalMaximized((m) => !m),
    setHeight: (px) => setTerminalHeight(px),
  }), [
    drawerEnabled, showTerminal, drawerTabs, resolvedTab,
    isTerminalMaximized, terminalHeight,
    setActiveTab, setShowTerminal, setIsTerminalMaximized, setTerminalHeight,
  ]);

  const paletteControls = useMemo<PaletteControls>(() => ({
    isOpen: paletteEnabled && showCommandPalette,
    open: () => { if (paletteEnabled) setShowCommandPalette(true); },
    close: () => setShowCommandPalette(false),
    toggle: () => { if (paletteEnabled) setShowCommandPalette((o) => !o); },
  }), [paletteEnabled, showCommandPalette]);

  const leftPanelControls = useMemo<SidePanelControls>(() => ({
    isCollapsed: showLeftPanel ? leftCollapsed : true,
    width: leftWidth,
    toggle: () => setLeftCollapsed((c) => !c),
    setCollapsed: (v) => setLeftCollapsed(v),
    setWidth: (px) => setLeftWidth(clampPanelWidth(app, 'left', px)),
  }), [app, showLeftPanel, leftCollapsed, leftWidth, setLeftCollapsed, setLeftWidth]);

  const rightPanelControls = useMemo<SidePanelControls>(() => ({
    isCollapsed: showRightPanel ? rightCollapsed : true,
    width: rightWidth,
    toggle: () => setRightCollapsed((c) => !c),
    setCollapsed: (v) => setRightCollapsed(v),
    setWidth: (px) => setRightWidth(clampPanelWidth(app, 'right', px)),
  }), [app, showRightPanel, rightCollapsed, rightWidth, setRightCollapsed, setRightWidth]);

  const controlsValue = useMemo<AppShellControlsContextValue>(() => ({
    drawer: drawerControls,
    palette: paletteControls,
    leftPanel: leftPanelControls,
    rightPanel: rightPanelControls,
  }), [drawerControls, paletteControls, leftPanelControls, rightPanelControls]);

  const shell = (
    <>
    <div ref={backgroundRef} aria-hidden={takeoverActive ? true : undefined} style={{ display: 'contents' }}>
    <Frame
      mode={frameMode}
      panOffset={panOffset}
      scale={scale}
      onPan={handlePan}
      onZoom={handleZoom}
      zoomControlsRightOffset={showPanels && !rightCollapsed ? rightWidth : 0}
      zoomControlsBottomOffset={terminalCanvasBottomOffset}
      showZoomControls={showCanvasZoomControls}
      hud={
        <>
          {chrome.nav && (
            <NavigationBar
              title={app.name.toUpperCase()}
              subtitle={app.icon}
              search={appSearch ?? undefined}
              center={appNavCenter}
              actions={
                <>
                  {appNavActions}
                  {codeSurface?.object && app.code?.navAction === true && (
                    <button
                      type="button"
                      onClick={() => codeSurface.setOpen(!codeSurface.open)}
                      className={`p-1.5 rounded border transition-colors ${
                        codeSurface.open
                          ? 'border-cyan-700/25 bg-cyan-700/10 text-cyan-700 dark:border-cyan-300/20 dark:bg-cyan-400/10 dark:text-cyan-200'
                          : 'border-transparent text-foreground/70 hover:bg-muted hover:text-foreground hover:border-border'
                      }`}
                      title={codeSurface.open ? 'Hide code' : (app.code?.label ?? codeSurface.label ?? 'View code')}
                      aria-label={codeSurface.open ? 'Hide code' : (app.code?.label ?? codeSurface.label ?? 'View code')}
                    >
                      <Code2 size={14} />
                    </button>
                  )}
                </>
              }
            />
          )}

          {showLeftPanel && (
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
              style={{ top: topInset, bottom: bottomInset }}
            >
              {app.slots.LeftPanel && <app.slots.LeftPanel />}
            </SidePanel>
          )}

          {showRightPanel && (
            <SidePanel
              side="right"
              title={app.rightPanel?.title ?? 'Inspector'}
              icon={app.rightPanel?.icon}
              isCollapsed={rightCollapsed}
              onToggleCollapse={() => setRightCollapsed(!rightCollapsed)}
              width={rightWidth}
              onResizeStart={handleResizeStart('right')}
              footer={rightFooter}
              headerActions={rightHeaderActions}
              style={{ top: topInset, bottom: bottomInset }}
            >
              {rightContent}
            </SidePanel>
          )}

          {chrome.statusBar && (
            <StatusBar
              status={appStatus}
              left={appStatusLeft}
              right={appStatusRight}
              onToggleTerminal={chrome.terminal ? () => setShowTerminal(t => !t) : undefined}
              isTerminalOpen={chrome.terminal ? showTerminal : false}
            />
          )}

          {/* Terminal — inset between panels */}
          {chrome.terminal && (
            <div
              className="pointer-events-none"
              style={{
                position: 'fixed',
                left: leftInset,
                right: rightInset,
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
          )}

          {codeSurface?.open && codeSurface.object && codePlacement === 'sheet' && (
            <div
              className="pointer-events-auto fixed bottom-7 right-0 top-12 z-[44]"
              aria-label={app.code?.label ?? codeSurface.label ?? 'Object code'}
            >
              <ObjectCodeSurface
                object={codeSurface.object}
                placement="sheet"
                onClose={() => codeSurface.setOpen(false)}
                width={codeSheetWidth}
                onWidthChange={setCodeSheetWidth}
              />
            </div>
          )}

          {codeSurface?.open && codeSurface.object && codePlacement === 'workbench' && (
            <div
              className="pointer-events-none fixed bottom-7 top-12 z-[44]"
              style={{
                left: codeWorkbenchSize === 'full' ? 0 : leftInset,
                right: codeWorkbenchSize === 'full' ? 0 : rightInset,
              }}
              aria-label={app.code?.label ?? codeSurface.label ?? 'Object code'}
            >
              <ObjectCodeWorkbench
                object={codeSurface.object}
                size={codeWorkbenchSize}
                onSizeChange={setCodeWorkbenchSize}
                onClose={() => codeSurface.setOpen(false)}
                chat={codeSurface.chat}
                editorWidth={codeWorkbenchEditorWidth}
                chatWidth={codeWorkbenchChatWidth}
                onEditorWidthChange={setCodeWorkbenchEditorWidth}
                onChatWidthChange={setCodeWorkbenchChatWidth}
              />
            </div>
          )}

          {/* Command palette */}
          {chrome.palette && (
            <CommandPalette
              isOpen={showCommandPalette}
              onClose={() => setShowCommandPalette(false)}
              commands={allCommands}
            />
          )}
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

  const wrapped = (
    <AppShellControlsProvider value={controlsValue}>
      {shell}
    </AppShellControlsProvider>
  );

  if (!theme) {
    return wrapped;
  }

  return (
    <div
      {...(theme.resolvedTheme ? { 'data-hudson-theme': theme.resolvedTheme } : {})}
      data-hudson-template={theme.template}
    >
      {wrapped}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawer tabs — Terminal slot vs Assistant
// (DrawerTab type lives in AppShellControlsContext so the imperative hook
// surface and AppShell agree on what tabs exist.)
// ---------------------------------------------------------------------------

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
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] tracking-[0.18em] uppercase font-mono transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
              isActive
                ? activeClasses
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/70 font-normal'
            }`}
          >
            <Icon size={12} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
