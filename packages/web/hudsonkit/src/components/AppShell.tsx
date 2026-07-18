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
import { AppSlotErrorBoundary } from '../workspace/shell/AppSlotErrorBoundary';
import { WorkspaceHostRoutesProvider, type HudsonHostRoutes } from '../workspace/hostRoutes';
import {
  AppShellControlsProvider,
  type AppShellControlsContextValue,
  type DrawerControls,
  type DrawerTab,
  type PaletteControls,
  type SidePanelControls,
  type SidePanelPinControls,
} from '../context/AppShellControlsContext';
import { usePlatformLayout } from '../platform/usePlatformLayout';
import type { AppShellLayoutConfig, AppShellResponsivePanelMax, HudsonApp } from '../types/app';
import type { HudsonCodeWorkbenchSize } from '../types/code';
import type { CommandOption } from './overlays/CommandPalette';
import { ChevronDown, ChevronRight, Code2, Pin, PinOff, Terminal as TerminalIcon, Sparkles } from 'lucide-react';
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
/** How AppShell's side panels claim horizontal space in panel layout. */
export type AppShellPanelMode = 'push' | 'overlay' | 'auto';

/**
 * Opt-in side-panel space behavior, passed as `chrome.panelBehavior`.
 * Omitting it (or passing `{}`) keeps the classic push layout unchanged.
 */
export interface AppShellPanelBehavior {
  /**
   * - 'push' (default) — open panels inset the content area, exactly as before.
   * - 'overlay' — open panels always float above the content area.
   * - 'auto' — panels push until the center content would drop below
   *   `centerMinWidth`, then float over the content instead. The right panel
   *   floats first; the left panel only floats when it alone would still
   *   squeeze the center below the threshold.
   */
  mode?: AppShellPanelMode;
  /**
   * Minimum center-content width (px) 'auto' mode protects before switching
   * panels from pushing to floating. Defaults to 560.
   */
  centerMinWidth?: number;
  /**
   * Render a Pin/PinOff toggle in the right panel header that lets the user
   * keep the inspector floating over content instead of pushing it. The
   * preference persists per app (`appshell.{app.id}.rightOverlay`) and is
   * exposed via `useAppShellSidePanels().right.pin`. Also adds a
   * Cmd/Ctrl+Shift+] shortcut and a "Toggle Inspector Overlay" palette
   * command. Ignored in 'overlay' mode, where panels always float.
   * Defaults to false.
   */
  inspectorPin?: boolean;
  /**
   * Keep one side panel open at a time. Opening the right panel yields the
   * left panel; closing it restores the left panel when it was previously open.
   * Defaults to false.
   */
  exclusive?: boolean;
}

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
  /**
   * Side-panel space behavior: push (default), overlay, or auto, plus the
   * inspector pin toggle. Defaults to the classic push layout.
   */
  panelBehavior?: AppShellPanelBehavior;
}

const DEFAULT_APP_SHELL_CHROME: Required<AppShellChromeOptions> = {
  nav: true,
  statusBar: true,
  leftPanel: true,
  rightPanel: true,
  palette: true,
  terminal: true,
  panelBehavior: {},
};

/**
 * Host-app bindings for the single-app shell — AppShell's counterpart to
 * `WorkspaceShellEnvironment`. The shell is host-agnostic; features that need
 * a server (the Assistant's Chat mode, speech, voice input, …) resolve their
 * endpoints from `routes` instead of hardcoding paths.
 *
 * Deliberately a subset of `WorkspaceShellEnvironment`: AppShell has no
 * dynamically-spawned terminal windows (`renderTerminal`) and no workspace
 * settings surface (`useHudsonAISettingsEntry`), so only `routes` applies.
 */
export interface AppShellEnvironment {
  /**
   * Host-owned relative routes for optional server-backed shell features.
   * Same shape as WorkspaceShell's `environment.routes` — e.g. `aiChat`
   * powers the built-in Assistant's Chat mode via `useHudsonAI`.
   */
  routes?: HudsonHostRoutes;
}

const DEFAULT_PANEL_MIN = 200;
const DEFAULT_PANEL_MAX = 500;

// Auto panel mode — center-content width protected before panels float.
const DEFAULT_CENTER_MIN_WIDTH = 560;

// Responsive panel max (app.layout.responsivePanelMax) — cap panels at 45% of
// the viewport, floored at 500px so small screens still get a usable panel,
// hard-capped at 900px on very wide viewports.
const DEFAULT_RESPONSIVE_PANEL_RATIO = 0.45;
const DEFAULT_RESPONSIVE_PANEL_FLOOR = 500;
const DEFAULT_RESPONSIVE_PANEL_CEILING = 900;

/** Viewport-driven max-width cap. Undefined unless the app opts in via
 *  `layout.responsivePanelMax`. */
function responsivePanelCap(
  layout: AppShellLayoutConfig | undefined,
  viewportWidth: number,
): number | undefined {
  const config = layout?.responsivePanelMax;
  if (!config) return undefined;
  const { ratio, min, max }: AppShellResponsivePanelMax = config === true ? {} : config;
  return Math.min(
    max ?? DEFAULT_RESPONSIVE_PANEL_CEILING,
    Math.max(
      min ?? DEFAULT_RESPONSIVE_PANEL_FLOOR,
      Math.floor(viewportWidth * (ratio ?? DEFAULT_RESPONSIVE_PANEL_RATIO)),
    ),
  );
}

function panelBounds(app: HudsonApp, side: 'left' | 'right', responsiveCap?: number) {
  const layout = app.layout;
  const sideBounds = side === 'left' ? layout?.left : layout?.right;
  // An explicit app max (side max or the layout-wide fallback) always wins
  // over the responsive viewport cap; the cap only replaces the built-in
  // default when the app hasn't declared one.
  const explicitMax = sideBounds?.max ?? layout?.maxPanelWidth;
  return {
    min: sideBounds?.min ?? layout?.minPanelWidth ?? DEFAULT_PANEL_MIN,
    max: explicitMax ?? responsiveCap ?? DEFAULT_PANEL_MAX,
  };
}

function clampPanelWidth(app: HudsonApp, side: 'left' | 'right', px: number, responsiveCap?: number) {
  const { min, max } = panelBounds(app, side, responsiveCap);
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
  /**
   * Host environment bindings (server route map for the Assistant's Chat
   * mode, speech, voice, …). When `environment.routes` is provided, AppShell
   * mounts the host-routes context itself — no external
   * `WorkspaceHostRoutesProvider` wrapper needed — and it wins for this
   * subtree over any outer provider. When omitted, an outer provider (if
   * any) keeps working unchanged; with neither, host-backed features stay
   * unconfigured, exactly as before.
   */
  environment?: AppShellEnvironment;
}

export function AppShell({
  app,
  assistant = true,
  chrome,
  defaultTheme = 'system',
  defaultTemplate = 'hudson',
  managedTheme = true,
  environment,
}: AppShellProps) {
  const theme = useOptionalTheme();

  let content = (
    <InstanceProvider instanceId={app.id} appId={app.id}>
      <app.Provider>
        <AppShellInner app={app} assistantEnabled={assistant} chrome={chrome} />
      </app.Provider>
    </InstanceProvider>
  );

  // Host routes mount above the app Provider, mirroring WorkspaceShell (which
  // provides them above all app Providers so apps can read them from their own
  // Provider scope). Only rendered when the consumer actually passed routes:
  // the context defaults to {}, so an unconditional provider would clobber an
  // outer WorkspaceHostRoutesProvider supplied by the host.
  if (environment?.routes) {
    content = (
      <WorkspaceHostRoutesProvider routes={environment.routes}>
        {content}
      </WorkspaceHostRoutesProvider>
    );
  }

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
  // Panel behavior — push (default, byte-identical to the classic layout),
  // overlay (panels always float), or auto (float only when pushing would
  // squeeze the center content below centerMinWidth).
  const panelBehavior = chrome.panelBehavior ?? {};
  const panelMode: AppShellPanelMode = panelBehavior.mode ?? 'push';
  const centerMinWidth = panelBehavior.centerMinWidth ?? DEFAULT_CENTER_MIN_WIDTH;
  const exclusivePanels = panelBehavior.exclusive === true;
  // The pin toggle is meaningless in overlay mode (everything floats there).
  const inspectorPinEnabled = panelBehavior.inspectorPin === true && panelMode !== 'overlay';
  // Platform layout
  const { navTotalHeight } = usePlatformLayout();

  // App hooks
  const appCommands = app.hooks.useCommands();
  const appStatus = app.hooks.useStatus();
  const appStatusLeft = app.hooks.useStatusLeft?.() ?? null;
  const appStatusRight = app.hooks.useStatusRight?.() ?? null;
  const appViewport = app.hooks.useViewport?.() ?? null;
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
  const [leftCollapsed, setLeftCollapsed] = usePersistentState(
    `appshell.${app.id}.left`,
    app.layout?.left?.collapsed ?? false,
  );
  const [rightCollapsed, setRightCollapsed] = usePersistentState(
    `appshell.${app.id}.right`,
    app.layout?.right?.collapsed ?? false,
  );
  const [leftWidth, setLeftWidth] = usePersistentState(
    `appshell.${app.id}.leftW`,
    app.layout?.leftWidth ?? 260,
  );
  const [rightWidth, setRightWidth] = usePersistentState(
    `appshell.${app.id}.rightW`,
    app.layout?.rightWidth ?? 280,
  );
  // Inspector pin/float preference (true = float over content). Only read and
  // written when the pin toggle is enabled, so default shells persist exactly
  // the same key set as before. Key matches OpenScout's forked shell so
  // consumers migrating back to AppShell keep their users' preference.
  const [rightOverlayPref, setRightOverlayPref] = usePersistentState(
    `appshell.${app.id}.rightOverlay`,
    false,
    { enabled: inspectorPinEnabled },
  );

  // Viewport width — only tracked when a feature needs it (auto panel mode or
  // the responsive panel-width cap). The default path registers no listener.
  const responsiveMaxEnabled = Boolean(app.layout?.responsivePanelMax);
  const trackViewport = responsiveMaxEnabled || panelMode === 'auto';
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  );
  useEffect(() => {
    if (!trackViewport) return;
    const update = () => setViewportWidth(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [trackViewport]);

  // Responsive max-width cap (undefined unless the app opts in).
  const responsiveCap = responsivePanelCap(app.layout, viewportWidth);

  // Keep stored widths inside the responsive cap as the viewport changes.
  // Gated on the opt-in — default shells never rewrite persisted widths.
  useEffect(() => {
    if (responsiveCap === undefined) return;
    setLeftWidth((w) => clampPanelWidth(app, 'left', w, responsiveCap));
    setRightWidth((w) => clampPanelWidth(app, 'right', w, responsiveCap));
  }, [app, responsiveCap, setLeftWidth, setRightWidth]);

  const leftWasOpenBeforeRightRef = useRef<boolean | null>(null);

  const openRightPanel = useCallback(() => {
    if (!rightCollapsed) return;
    if (exclusivePanels) {
      leftWasOpenBeforeRightRef.current = !leftCollapsed;
      if (!leftCollapsed) setLeftCollapsed(true);
    }
    setRightCollapsed(false);
  }, [exclusivePanels, leftCollapsed, rightCollapsed, setLeftCollapsed, setRightCollapsed]);

  const closeRightPanel = useCallback(() => {
    if (rightCollapsed) return;
    setRightCollapsed(true);
    if (exclusivePanels) {
      const restoreLeft = leftWasOpenBeforeRightRef.current ?? !(app.layout?.left?.collapsed ?? false);
      if (restoreLeft) setLeftCollapsed(false);
      leftWasOpenBeforeRightRef.current = null;
    }
  }, [app.layout?.left?.collapsed, exclusivePanels, rightCollapsed, setLeftCollapsed, setRightCollapsed]);

  const toggleRightPanel = useCallback(() => {
    if (rightCollapsed) openRightPanel();
    else closeRightPanel();
  }, [closeRightPanel, openRightPanel, rightCollapsed]);

  const openLeftPanel = useCallback(() => {
    if (!leftCollapsed) return;
    if (exclusivePanels && !rightCollapsed) {
      setRightCollapsed(true);
      leftWasOpenBeforeRightRef.current = null;
    }
    setLeftCollapsed(false);
  }, [exclusivePanels, leftCollapsed, rightCollapsed, setLeftCollapsed, setRightCollapsed]);

  const closeLeftPanel = useCallback(() => {
    if (!leftCollapsed) setLeftCollapsed(true);
  }, [leftCollapsed, setLeftCollapsed]);

  const toggleLeftPanel = useCallback(() => {
    if (leftCollapsed) openLeftPanel();
    else closeLeftPanel();
  }, [closeLeftPanel, leftCollapsed, openLeftPanel]);

  const setLeftPanelCollapsed = useCallback((collapsed: boolean) => {
    if (collapsed) closeLeftPanel();
    else openLeftPanel();
  }, [closeLeftPanel, openLeftPanel]);

  const setRightPanelCollapsed = useCallback((collapsed: boolean) => {
    if (collapsed) closeRightPanel();
    else openRightPanel();
  }, [closeRightPanel, openRightPanel]);

  const [codeWorkbenchSize, setCodeWorkbenchSize] = usePersistentState<HudsonCodeWorkbenchSize>(`appshell.${app.id}.codeWorkbenchSize`, 'half');
  const [codeWorkbenchEditorWidth, setCodeWorkbenchEditorWidth] = usePersistentState(`appshell.${app.id}.codeWorkbenchEditorWidth`, 420);
  const [codeWorkbenchChatWidth, setCodeWorkbenchChatWidth] = usePersistentState(`appshell.${app.id}.codeWorkbenchChatWidth`, 320);
  const [codeSheetWidth, setCodeSheetWidth] = usePersistentState(`appshell.${app.id}.codeSheetWidth`, 720);

  useEffect(() => {
    if (codeWorkbenchOpen && !previousCodeWorkbenchOpenRef.current && !rightCollapsed) {
      closeRightPanel();
    }
    previousCodeWorkbenchOpenRef.current = codeWorkbenchOpen;
  }, [closeRightPanel, codeWorkbenchOpen, rightCollapsed]);

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
      setter(clampPanelWidth(app, side, startWidth + delta, responsiveCap));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [app, leftWidth, rightWidth, responsiveCap, setLeftWidth, setRightWidth]);

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

  // Push math — what each open panel would claim if it pushed content aside.
  // A float-preferred inspector is out of the push math entirely.
  const leftPanelOpen = showLeftPanel && !leftCollapsed;
  const rightPanelOpen = showRightPanel && !rightCollapsed;
  const rightFloatPreferred = inspectorPinEnabled && rightOverlayPref;
  const leftPushInset = leftPanelOpen ? leftWidth : 0;
  const rightPushInset = rightPanelOpen && !rightFloatPreferred ? rightWidth : 0;
  // Auto mode: when pushed panels would squeeze the center content below
  // centerMinWidth, they float over the content instead. The right panel
  // floats first; the left panel only floats when it alone would still
  // starve the center.
  const autoOverlayActive =
    panelMode === 'auto' &&
    viewportWidth - leftPushInset - rightPushInset < centerMinWidth &&
    (leftPushInset > 0 || rightPushInset > 0);
  const autoOverlayRight = autoOverlayActive && rightPushInset > 0;
  const autoOverlayLeft =
    autoOverlayActive && leftPushInset > 0 && viewportWidth - leftPushInset < centerMinWidth;
  const leftFloating = leftPanelOpen && (panelMode === 'overlay' || autoOverlayLeft);
  const rightFloating =
    rightPanelOpen && (panelMode === 'overlay' || rightFloatPreferred || autoOverlayRight);
  // Content insets — floating panels claim no horizontal space. On the
  // default push path these reduce to exactly the pre-panelBehavior values.
  const leftInset = leftFloating ? 0 : leftPushInset;
  const rightInset = rightFloating ? 0 : rightPushInset;

  // Shell commands
  const shellCommands: CommandOption[] = useMemo(() => {
    if (!chrome.palette) return [];

    const cmds: CommandOption[] = [];
    if (chrome.leftPanel) {
      cmds.push({ id: 'shell:toggle-left', label: 'Toggle Left Panel', shortcut: 'Cmd+[', action: toggleLeftPanel });
    }
    if (chrome.rightPanel) {
      cmds.push({ id: 'shell:toggle-right', label: 'Toggle Right Panel', shortcut: 'Cmd+]', action: toggleRightPanel });
    }
    if (chrome.rightPanel && inspectorPinEnabled) {
      cmds.push({ id: 'shell:toggle-right-overlay', label: 'Toggle Inspector Overlay', shortcut: 'Cmd+Shift+]', action: () => setRightOverlayPref(o => !o) });
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
  }, [activeTab, app.code?.commandLabel, app.code?.label, app.id, assistantEnabled, chrome.leftPanel, chrome.palette, chrome.rightPanel, chrome.terminal, codeSurface, inspectorPinEnabled, setActiveTab, setRightOverlayPref, theme, toggleLeftPanel, toggleRightPanel]);

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
        toggleLeftPanel();
      }
      if (chrome.rightPanel && (e.metaKey || e.ctrlKey) && e.key === ']') {
        e.preventDefault();
        // Cmd+Shift+] flips the inspector pin/float preference when the pin
        // toggle is enabled; otherwise Shift is ignored (classic behavior).
        if (inspectorPinEnabled && e.shiftKey) {
          setRightOverlayPref(o => !o);
        } else {
          toggleRightPanel();
        }
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
  }, [setRightOverlayPref, assistantEnabled, inspectorPinEnabled, resolvedTab, setActiveTab, takeoverActive, chrome.leftPanel, chrome.palette, chrome.rightPanel, chrome.terminal, toggleLeftPanel, toggleRightPanel]);

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
  // Inspector pin/float toggle — opt-in via chrome.panelBehavior.inspectorPin.
  const inspectorPinTitle = rightOverlayPref
    ? 'Pin inspector (push content)'
    : autoOverlayRight
      ? 'Keep inspector floating when there is room'
      : 'Float inspector (overlay content)';
  const inspectorPinButton = inspectorPinEnabled ? (
    <button
      type="button"
      // When auto-overlay already floats an unpinned inspector, the toggle
      // "keeps it floating" (sets the preference) rather than pinning it.
      onClick={() => setRightOverlayPref(o => (autoOverlayRight && !o ? true : !o))}
      className="p-1 hover:bg-accent/10 rounded transition-colors text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      title={inspectorPinTitle}
      aria-label={inspectorPinTitle}
    >
      {rightFloating ? <PinOff size={12} /> : <Pin size={12} />}
    </button>
  ) : null;

  const rightHeaderActions = inspectorPinButton || codeSurfaceHeaderAction || app.rightPanel?.headerActions
    ? (
      <div className="flex items-center gap-1">
        {inspectorPinButton}
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
      {InspectorSlot && (
        <AppSlotErrorBoundary appName={app.name} slotName="Inspector">
          <InspectorSlot />
        </AppSlotErrorBoundary>
      )}
      {!InspectorSlot && RightPanelSlot && (
        <AppSlotErrorBoundary appName={app.name} slotName="RightPanel">
          <RightPanelSlot />
        </AppSlotErrorBoundary>
      )}
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
  const leftFooter = app.slots.LeftFooter ? (
    <AppSlotErrorBoundary appName={app.name} slotName="LeftFooter">
      <app.slots.LeftFooter />
    </AppSlotErrorBoundary>
  ) : undefined;

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
    isFloating: leftFloating,
    toggle: toggleLeftPanel,
    setCollapsed: setLeftPanelCollapsed,
    setWidth: (px) => setLeftWidth(clampPanelWidth(app, 'left', px, responsiveCap)),
  }), [app, showLeftPanel, leftCollapsed, leftWidth, leftFloating, responsiveCap, setLeftPanelCollapsed, setLeftWidth, toggleLeftPanel]);

  // Pin/float preference handle — only published when the toggle is enabled,
  // so `right.pin` doubles as the feature-detection flag for app code.
  const rightPanelPin = useMemo<SidePanelPinControls | undefined>(
    () =>
      inspectorPinEnabled
        ? {
            isPinned: !rightOverlayPref,
            toggle: () => setRightOverlayPref((o) => !o),
            setPinned: (v) => setRightOverlayPref(!v),
          }
        : undefined,
    [inspectorPinEnabled, rightOverlayPref, setRightOverlayPref],
  );

  const rightPanelControls = useMemo<SidePanelControls>(() => ({
    isCollapsed: showRightPanel ? rightCollapsed : true,
    width: rightWidth,
    isFloating: rightFloating,
    toggle: toggleRightPanel,
    setCollapsed: setRightPanelCollapsed,
    setWidth: (px) => setRightWidth(clampPanelWidth(app, 'right', px, responsiveCap)),
    ...(rightPanelPin ? { pin: rightPanelPin } : {}),
  }), [app, showRightPanel, rightCollapsed, rightWidth, rightFloating, rightPanelPin, responsiveCap, setRightPanelCollapsed, setRightWidth, toggleRightPanel]);

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
      zoomControlsRightOffset={showPanels && !rightCollapsed && !rightFloating ? rightWidth : 0}
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
              onToggleCollapse={toggleLeftPanel}
              width={leftWidth}
              onResizeStart={handleResizeStart('left')}
              floating={leftFloating}
              footer={leftFooter}
              headerActions={app.leftPanel?.headerActions && <app.leftPanel.headerActions />}
              style={{ top: topInset, bottom: bottomInset }}
            >
              {app.slots.LeftPanel && (
                <AppSlotErrorBoundary appName={app.name} slotName="LeftPanel">
                  <app.slots.LeftPanel />
                </AppSlotErrorBoundary>
              )}
            </SidePanel>
          )}

          {showRightPanel && (
            <SidePanel
              side="right"
              title={app.rightPanel?.title ?? 'Inspector'}
              icon={app.rightPanel?.icon}
              isCollapsed={rightCollapsed}
              onToggleCollapse={toggleRightPanel}
              width={rightWidth}
              onResizeStart={handleResizeStart('right')}
              floating={rightFloating}
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
              viewport={
                appViewport
                  ? {
                      pan: appViewport.pan,
                      zoom: appViewport.zoom,
                      canvasSize: appViewport.canvasSize,
                    }
                  : undefined
              }
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
        <AppSlotErrorBoundary appName={app.name} slotName="Content">
          <app.slots.Content />
        </AppSlotErrorBoundary>
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
