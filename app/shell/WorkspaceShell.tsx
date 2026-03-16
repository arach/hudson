'use client';

import { useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BootSplash, phaseAtLeast } from './BootSplash';
import type { BootPhase } from './BootSplash';
import { AppLauncher, loadSession, saveSession } from './HomeScreen';
import {
  Frame,
  Minimap,
  NavigationBar,
  SidePanel,
  StatusBar,
  CommandPalette,
  CommandDock,
  TerminalDrawer,
  AppWindow,
} from '@hudson/sdk/shell';
import {
  usePersistentState,
  useDebouncedPersistentState,
  useSaveIndicator,
  usePlatformLayout,
  sounds,
  setMuted as setSoundMuted,
  useAppSettings,
} from '@hudson/sdk';
import type { HudsonWorkspace, WorkspaceAppConfig, CommandOption, StatusColor, SearchConfig, ContextMenuEntry } from '@hudson/sdk';
import { Volume2, VolumeX, Settings, Crosshair, Maximize2, Minimize2, RotateCcw, ScanSearch, Map, BookOpen, X, TerminalSquare } from 'lucide-react';
import { TerminalContent } from '../apps/terminal/TerminalContent';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { SidebarSection } from './SidebarSection';
import { ToolAccordion } from './ToolAccordion';
import { ShellLayoutProvider, useShellLayout } from './ShellLayoutContext';
import { SettingsPanel } from '../apps/hudson-docs/components';
import type { AppSettingsEntry } from '../apps/hudson-docs/components';
import type { HudsonSettings } from '../apps/hudson-docs/types';
import { useIntentCatalog } from '../hooks/useIntentCatalog';
import { useIntentExecutor } from '../hooks/useIntentExecutor';
import { AppSlotErrorBoundary } from './AppSlotErrorBoundary';
import { WorkspaceErrorBoundary } from './WorkspaceErrorBoundary';
import { HudsonTerminal } from './HudsonTerminal';
import { DataBusProvider, usePortBridge } from './DataBusContext';
import { useServiceRegistry } from '../services/useServiceRegistry';
import { ServiceRegistryProvider } from '../services/ServiceRegistryContext';
import { ServiceBanner } from './ServiceBanner';
import { WorkspaceManagerProvider, WorkspaceManagerPanel } from './workspace-manager';
import type { ServiceStatus } from '@hudson/sdk';

// ---------------------------------------------------------------------------
// Shell configuration — all tuneable defaults and timing constants
// ---------------------------------------------------------------------------

/** How often high-frequency state (pan/zoom) flushes to localStorage (ms). */
const PERSIST_DEBOUNCE_MS = 5_000;

/** Debounce for flushing window bounds to state for minimap rendering (ms). */
const BOUNDS_FLUSH_MS = 60;

/** Delay before fit-all fires after launcher dismiss (ms). */
const FIT_ALL_DELAY_MS = 600;

/** Default sidebar and terminal dimensions. */
const DEFAULTS = {
  leftWidth: 260,
  rightWidth: 280,
  terminalHeight: 480,
  leftCollapsed: true,
  rightCollapsed: true,
  minimapCollapsed: false,
  showTerminal: false,
  showGuides: false,
  pan: { x: 0, y: 0 } as { x: number; y: number },
  zoom: 1 as number,
};

/** Window sizes used by the smart-tiler on first launch. */
const TILE = {
  singleW: 960,
  singleH: 680,
  multiW: 800,
  multiH: 600,
  gap: 40,
} as const;

const DEFAULT_SHELL_SETTINGS: HudsonSettings = {
  glowIntensity: 30,
  connectorStyle: 'dashed',
  zoomSensitivity: 1.0,
  masterMute: false,
  uiClickSounds: true,
  uiTransitionSounds: true,
  aiMode: 'cli',
};

// ---------------------------------------------------------------------------
// Service status indicator (rendered in StatusBar right slot)
// ---------------------------------------------------------------------------
function ServiceStatusIndicator({ registry, onOpenSettings }: {
  registry: ReturnType<typeof useServiceRegistry>;
  onOpenSettings: () => void;
}) {
  const { catalog, records } = registry;
  const total = catalog.length;
  const running = catalog.filter(s => records[s.id]?.status === 'running').length;
  const hasError = catalog.some(s => records[s.id]?.status === 'error');
  const color = hasError ? 'text-red-500' : running === total ? 'text-emerald-500' : 'text-neutral-400';
  const dotColor = hasError ? 'bg-red-500' : running === total ? 'bg-emerald-500' : 'bg-neutral-500';

  return (
    <button
      onClick={onOpenSettings}
      className={`flex items-center gap-1.5 ${color} hover:opacity-80 transition-opacity`}
      title="Open Services settings"
    >
      <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span className="uppercase text-[10px] font-semibold tracking-wider">
        Services {running}/{total}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Window bounds hook
// ---------------------------------------------------------------------------
function useWindowBounds(
  workspaceId: string,
  appId: string,
  defaults: { x: number; y: number; w: number; h: number },
) {
  return usePersistentState(`hudson.ws.${workspaceId}.win.${appId}`, defaults);
}

// ---------------------------------------------------------------------------
// WorkspaceShell — outer wrapper that nests all app Providers
// ---------------------------------------------------------------------------
interface WorkspaceShellProps {
  workspaces: HudsonWorkspace[];
  defaultWorkspaceId: string;
  bootMode?: 'full' | 'condensed' | 'none';
}

export function WorkspaceShell({ workspaces, defaultWorkspaceId, bootMode = 'none' }: WorkspaceShellProps) {
  // --- Session restore (hydration-safe: read localStorage in useEffect) ---
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(defaultWorkspaceId);
  const [hasSession, setHasSession] = useState(false);
  const [bootPhase, setBootPhase] = useState<BootPhase>(bootMode === 'none' ? 'done' : 'brand');
  const [booted, setBooted] = useState(bootMode === 'none');

  // Read session from localStorage after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    const session = loadSession();
    if (session && workspaces.some(w => w.id === session.activeWorkspaceId)) {
      setActiveWorkspaceId(session.activeWorkspaceId);
      setHasSession(true);
    }
  }, [workspaces]);

  const workspace = workspaces.find(w => w.id === activeWorkspaceId) ?? workspaces[0];

  // Save session on workspace switch
  const handleSwitchWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    saveSession(id);
  }, []);

  // Nest all app Providers recursively
  let tree: ReactNode = (
    <WorkspaceInner
      key={workspace.id}
      workspace={workspace}
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspaceId}
      onSwitchWorkspace={handleSwitchWorkspace}
      bootPhase={bootPhase}
      bootMode={bootMode}
      initialShowLauncher={bootMode !== 'none' && !hasSession}
    />
  );

  for (let i = workspace.apps.length - 1; i >= 0; i--) {
    const { app } = workspace.apps[i];
    tree = <app.Provider>{tree}</app.Provider>;
  }

  // DataBusProvider wraps above all app Providers so port hooks can register
  tree = <DataBusProvider workspace={workspace}>{tree}</DataBusProvider>;

  return (
    <>
      {/* Workspace content — always rendered */}
      <WorkspaceErrorBoundary workspaceName={workspace.name}>
        <div key={workspace.id}>{tree}</div>
      </WorkspaceErrorBoundary>

      {/* Boot splash overlay */}
      <AnimatePresence>
        {!booted && bootMode !== 'none' && (
          <BootSplash
            mode={bootMode}
            onPhaseChange={setBootPhase}
            onBooted={() => setBooted(true)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------
// Merged hook data from a single app
// ---------------------------------------------------------------------------
interface AppHookData {
  appId: string;
  appName: string;
  commands: CommandOption[];
  status: { label: string; color: StatusColor };
  search: SearchConfig | null;
  navCenter: ReactNode | null;
  navActions: ReactNode | null;
  layoutMode: 'canvas' | 'panel';
  activeToolHint: string | null;
}

// ---------------------------------------------------------------------------
// Bridge — calls hooks for one app (must be inside that app's Provider)
// ---------------------------------------------------------------------------
function useAppHooks(config: WorkspaceAppConfig): AppHookData {
  const { app } = config;
  return {
    appId: app.id,
    appName: app.name,
    commands: app.hooks.useCommands(),
    status: app.hooks.useStatus(),
    search: app.hooks.useSearch?.() ?? null,
    navCenter: app.hooks.useNavCenter?.() ?? null,
    navActions: app.hooks.useNavActions?.() ?? null,
    layoutMode: app.hooks.useLayoutMode?.() ?? app.mode,
    activeToolHint: app.hooks.useActiveToolHint?.() ?? null,
  };
}

// Empty settings config used as stable default for apps without settings
const EMPTY_SETTINGS = { sections: [] };

/** Calls useAppSettings for one app (must be called unconditionally). */
function useAppSettingsBridge(config: WorkspaceAppConfig): AppSettingsEntry | null {
  const { app } = config;
  const settingsConfig = app.settings ?? EMPTY_SETTINGS;
  const [values, update] = useAppSettings(app.id, settingsConfig);
  if (!app.settings) return null;
  return { appId: app.id, appName: app.name, config: app.settings, values, onUpdate: update };
}

// ---------------------------------------------------------------------------
// WorkspaceInner — renders inside all Providers, can call all app hooks
// ---------------------------------------------------------------------------
function WorkspaceInner({
  workspace,
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
  bootPhase,
  bootMode,
  initialShowLauncher,
}: {
  workspace: HudsonWorkspace;
  workspaces: HudsonWorkspace[];
  activeWorkspaceId: string;
  onSwitchWorkspace: (id: string) => void;
  bootPhase: BootPhase;
  bootMode: 'full' | 'condensed' | 'none';
  initialShowLauncher: boolean;
}) {
  // Derived visibility flags from boot phase
  const chromeVisible = phaseAtLeast(bootPhase, 'chrome-in');
  const panelsVisible = phaseAtLeast(bootPhase, 'panels-in');
  const isSingleApp = workspace.apps.length === 1;
  const isMultiApp = !isSingleApp;

  // --- Grid opacity: invisible during boot, fade in with chrome ---
  const gridOpacity = phaseAtLeast(bootPhase, 'chrome-in') ? 1 : 0;

  // --- Hook merging ---
  // Safe: workspace.apps is static per workspace, component keyed by workspace.id
  const allAppHooks: AppHookData[] = workspace.apps.map(config => useAppHooks(config));

  // --- Port bridge (registers output/input hooks with DataBus) ---
  // eslint-disable-next-line react-hooks/rules-of-hooks
  workspace.apps.forEach(config => usePortBridge(config));

  // --- App-level settings (called unconditionally for each app) ---
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const appSettings = workspace.apps.map(config => useAppSettingsBridge(config))
    .filter((e): e is AppSettingsEntry => e !== null);

  // --- Service registry (global, not tied to any app) ---
  const serviceRegistry = useServiceRegistry();
  const showSaved = useSaveIndicator();

  // --- Focus state (persisted per workspace) ---
  const defaultFocus = workspace.defaultFocusedAppId ?? workspace.apps[0]?.app.id ?? '';
  const [focusedAppId, setFocusedAppId] = usePersistentState(
    `hudson.ws.${workspace.id}.focus`,
    defaultFocus,
  );
  const focusedIdx = allAppHooks.findIndex(h => h.appId === focusedAppId);
  const focused = allAppHooks[focusedIdx >= 0 ? focusedIdx : 0];

  // --- Tool expansion state (right sidebar accordion) ---
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);

  // Reset expanded tool when focused app changes
  const prevFocusedAppIdRef = useRef(focusedAppId);
  useEffect(() => {
    if (prevFocusedAppIdRef.current !== focusedAppId) {
      setExpandedToolId(null);
      prevFocusedAppIdRef.current = focusedAppId;
    }
  }, [focusedAppId]);

  // Auto-expand tool based on app's activeToolHint
  useEffect(() => {
    if (focused.activeToolHint) {
      setExpandedToolId(focused.activeToolHint);
    }
  }, [focused.activeToolHint]);

  const handleToggleTool = useCallback((toolId: string) => {
    setExpandedToolId(prev => prev === toolId ? null : toolId);
  }, []);

  // --- Activated apps tracking (persisted per workspace) ---
  const isFullBoot = bootMode === 'full';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allAppIds = useMemo(() => workspace.apps.map(c => c.app.id), [workspace.id]);
  const [activatedAppIdsArr, setActivatedAppIdsArr] = usePersistentState<string[]>(
    `hudson.ws.${workspace.id}.visible`,
    isFullBoot && initialShowLauncher ? [] : allAppIds,
  );
  // Derive Set for fast lookups, filtered to only include current workspace's apps
  const activatedAppIds = useMemo(
    () => new Set(activatedAppIdsArr.filter(id => allAppIds.includes(id))),
    [activatedAppIdsArr, allAppIds],
  );
  const setActivatedAppIds = useCallback(
    (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setActivatedAppIdsArr(prev => {
        const prevSet = new Set(prev.filter(id => allAppIds.includes(id)));
        const next = typeof updater === 'function' ? updater(prevSet) : updater;
        return [...next];
      });
    },
    [setActivatedAppIdsArr, allAppIds],
  );

  // --- App launcher state ---
  const [showLauncher, setShowLauncher] = useState(initialShowLauncher);
  // Gate launcher visibility on boot completion (full mode)
  const [launcherReady, setLauncherReady] = useState(bootMode !== 'full');

  // Set launcherReady when boot splash is dismissed (full mode)
  useEffect(() => {
    if (bootMode === 'full' && phaseAtLeast(bootPhase, 'done')) {
      setLauncherReady(true);
    }
  }, [bootMode, bootPhase]);

  const handleActivateApp = useCallback((appId: string) => {
    setActivatedAppIds(prev => new Set([...prev, appId]));
    setFocusedAppId(appId);
  }, []);

  const handleToggleAppVisibility = useCallback((appId: string) => {
    setActivatedAppIds(prev => {
      const next = new Set(prev);
      if (next.has(appId)) {
        // Don't allow hiding the last visible app
        if (next.size <= 1) return prev;
        next.delete(appId);
      } else {
        next.add(appId);
      }
      return next;
    });
  }, []);

  // --- Window reset key (bumped to force WindowedApp remount) ---
  const [windowResetKey, setWindowResetKey] = useState(0);

  // --- Dynamic windows (e.g. spawned terminals, not tied to static workspace apps) ---
  const [dynamicWindows, setDynamicWindows] = useState<DynamicWindowEntry[]>([]);
  const dynamicCountRef = useRef(0);
  const [showTerminalSpawn, setShowTerminalSpawn] = useState(false);

  const spawnTerminal = useCallback((cwd = '~') => {
    dynamicCountRef.current++;
    const n = dynamicCountRef.current;
    const offset = (n - 1) * 30;
    const shortCwd = cwd.replace(/^\/Users\/[^/]+/, '~');
    const win: DynamicWindowEntry = {
      id: `dyn-terminal-${n}`,
      title: `Terminal ${n} — ${shortCwd}`,
      render: () => <TerminalContent initialCwd={cwd} />,
      bounds: { x: -350 + offset, y: -250 + offset, w: 700, h: 500 },
    };
    setDynamicWindows(prev => [...prev, win]);
    setFocusedAppId(win.id);
  }, []);

  const closeDynamicWindow = useCallback((id: string) => {
    setDynamicWindows(prev => prev.filter(w => w.id !== id));
  }, []);

  // --- Smart tiling: compute clean window positions on first launch ---
  const tileWindowBounds = useCallback((ids: Set<string>) => {
    const windowed = workspace.apps.filter(
      c => ids.has(c.app.id) && c.canvasMode === 'windowed',
    );
    const n = windowed.length;
    if (n === 0) return;

    const { gap } = TILE;

    if (n === 1) {
      const { singleW: w, singleH: h } = TILE;
      const key = `hudson.ws.${workspace.id}.win.${windowed[0].app.id}`;
      try { localStorage.setItem(key, JSON.stringify({ x: -w / 2, y: -h / 2, w, h })); } catch {}
    } else if (n === 2) {
      const { multiW: w, multiH: h } = TILE;
      const totalW = w * 2 + gap;
      windowed.forEach((config, i) => {
        const key = `hudson.ws.${workspace.id}.win.${config.app.id}`;
        const x = -totalW / 2 + i * (w + gap);
        const y = -h / 2;
        try { localStorage.setItem(key, JSON.stringify({ x, y, w, h })); } catch {}
      });
    } else {
      // Grid layout for 3+
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      const { multiW: w, multiH: h } = TILE;
      const totalW = cols * w + (cols - 1) * gap;
      const totalH = rows * h + (rows - 1) * gap;
      windowed.forEach((config, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const key = `hudson.ws.${workspace.id}.win.${config.app.id}`;
        const x = -totalW / 2 + col * (w + gap);
        const y = -totalH / 2 + row * (h + gap);
        try { localStorage.setItem(key, JSON.stringify({ x, y, w, h })); } catch {}
      });
    }
  }, [workspace]);

  const handleDismissLauncher = useCallback(() => {
    const finalIds = activatedAppIds.size === 0
      ? new Set(workspace.apps.map(c => c.app.id))
      : activatedAppIds;

    setActivatedAppIds(finalIds);

    // Compute smart tiled positions and force window remount
    tileWindowBounds(finalIds);
    setWindowResetKey(k => k + 1);

    setShowLauncher(false);
    saveSession(activeWorkspaceId);
  }, [workspace.apps, activeWorkspaceId, activatedAppIds, tileWindowBounds]);

  // Auto fit-all on first load after launcher dismiss
  const pendingFitAllRef = useRef(false);
  const prevShowLauncherRef = useRef(showLauncher);
  useEffect(() => {
    // Detect launcher going from visible → hidden
    if (prevShowLauncherRef.current && !showLauncher) {
      pendingFitAllRef.current = true;
    }
    prevShowLauncherRef.current = showLauncher;
  }, [showLauncher]);

  // --- Mode resolution ---
  const layoutMode = isSingleApp ? focused.layoutMode : workspace.mode;
  const isCanvasMode = layoutMode === 'canvas';

  // --- Shell state (same as AppShell) ---
  const [leftCollapsed, setLeftCollapsed] = usePersistentState('hudson.left', DEFAULTS.leftCollapsed);
  const [rightCollapsed, setRightCollapsed] = usePersistentState('hudson.right', DEFAULTS.rightCollapsed);
  const [leftWidth, setLeftWidth] = usePersistentState('hudson.leftW', DEFAULTS.leftWidth);
  const [rightWidth, setRightWidth] = usePersistentState('hudson.rightW', DEFAULTS.rightWidth);

  const [panOffset, setPanOffset] = useDebouncedPersistentState(`hudson.ws.${workspace.id}.pan`, DEFAULTS.pan, PERSIST_DEBOUNCE_MS);
  const [scale, setScale] = useDebouncedPersistentState(`hudson.ws.${workspace.id}.zoom`, DEFAULTS.zoom, PERSIST_DEBOUNCE_MS);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWorkspaceManager, setShowWorkspaceManager] = useState(false);
  const [showTerminal, setShowTerminal] = usePersistentState(`hudson.ws.${workspace.id}.terminal`, DEFAULTS.showTerminal);
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);
  const [terminalHeight, setTerminalHeight] = usePersistentState('hudson.termH', DEFAULTS.terminalHeight);

  const [minimapCollapsed, setMinimapCollapsed] = usePersistentState('hudson.minimap', DEFAULTS.minimapCollapsed);
  const [showGuides, setShowGuides] = usePersistentState(`hudson.ws.${workspace.id}.guides`, DEFAULTS.showGuides);

  // --- Window bounds tracking (for fit-all + minimap indicators) ---
  // Ref holds the live truth — updated synchronously, zero re-renders.
  // handleFitAll reads from the ref (it's event-driven, doesn't need reactivity).
  // Minimap indicators read from state, updated via a debounced flush so
  // dragging/resizing a window doesn't re-render the entire shell each frame.
  type Bounds = { x: number; y: number; w: number; h: number };
  const windowBoundsRef = useRef<Record<string, Bounds>>({});
  const [windowBoundsMap, setWindowBoundsMap] = useState<Record<string, Bounds>>({});
  const boundsFlushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reportWindowBounds = useCallback((appId: string, bounds: Bounds) => {
    const old = windowBoundsRef.current[appId];
    if (old && old.x === bounds.x && old.y === bounds.y &&
        old.w === bounds.w && old.h === bounds.h) return;
    windowBoundsRef.current = { ...windowBoundsRef.current, [appId]: bounds };

    // Debounced flush to state for minimap rendering
    if (boundsFlushTimer.current) clearTimeout(boundsFlushTimer.current);
    boundsFlushTimer.current = setTimeout(() => {
      setWindowBoundsMap({ ...windowBoundsRef.current });
    }, BOUNDS_FLUSH_MS);
  }, []);

  // --- Terminal tab state (Hudson global + per-app) ---
  const HUDSON_TERMINAL_ID = '__hudson__';
  const appsWithTerminal = workspace.apps.filter(c => c.app.slots.Terminal);
  const [activeTerminalAppId, setActiveTerminalAppId] = useState(HUDSON_TERMINAL_ID);
  const activeTerminalApp = appsWithTerminal.find(c => c.app.id === activeTerminalAppId)?.app
    ?? null;

  // Auto-switch terminal tab when the focused app changes — but only if user is on an app tab
  useEffect(() => {
    if (activeTerminalAppId !== HUDSON_TERMINAL_ID && appsWithTerminal.some(c => c.app.id === focusedAppId)) {
      setActiveTerminalAppId(focusedAppId);
    }
  }, [focusedAppId, activeTerminalAppId, appsWithTerminal]);

  // Sort terminal tabs: active (visible) apps first, inactive at the end
  const sortedTerminalApps = useMemo(() => {
    const active = appsWithTerminal.filter(c => activatedAppIds.has(c.app.id));
    const inactive = appsWithTerminal.filter(c => !activatedAppIds.has(c.app.id));
    return [...active, ...inactive];
  }, [appsWithTerminal, activatedAppIds]);

  // --- Settings ---
  const [shellSettings, setShellSettings] = usePersistentState<HudsonSettings>(
    'hudson.settings',
    DEFAULT_SHELL_SETTINGS,
  );
  const muted = shellSettings.masterMute;

  useEffect(() => {
    setSoundMuted(shellSettings.masterMute);
  }, [shellSettings.masterMute]);

  const updateShellSettings = useCallback(
    (patch: Partial<HudsonSettings>) => {
      setShellSettings(prev => ({ ...prev, ...patch }));
    },
    [setShellSettings],
  );

  const resetShellSettings = useCallback(() => {
    setShellSettings(DEFAULT_SHELL_SETTINGS);
  }, [setShellSettings]);

  // --- Sound helper ---
  const playSound = useCallback(
    (name: string) => {
      if (shellSettings.masterMute) return;
      const isTransition = name === 'slideIn' || name === 'slideOut' || name === 'whoosh' || name === 'boot';
      if (isTransition && !shellSettings.uiTransitionSounds) return;
      if (!isTransition && !shellSettings.uiClickSounds) return;
      (sounds as Record<string, () => void>)[name]?.();
    },
    [shellSettings.masterMute, shellSettings.uiClickSounds, shellSettings.uiTransitionSounds],
  );

  // --- Pan/zoom ---
  const handlePan = useCallback((delta: { x: number; y: number }) => {
    setPanOffset(prev => ({ x: prev.x + delta.x, y: prev.y + delta.y }));
  }, []);

  const handleZoom = useCallback((newScale: number, panAdjust?: { x: number; y: number }) => {
    setScale(newScale);
    if (panAdjust) {
      setPanOffset(prev => ({ x: prev.x + panAdjust.x, y: prev.y + panAdjust.y }));
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    const next = !shellSettings.masterMute;
    updateShellSettings({ masterMute: next });
    if (!next) sounds.click();
  }, [shellSettings.masterMute, updateShellSettings]);

  const handleMinimapNavigate = useCallback((pos: { x: number; y: number }) => {
    setPanOffset(pos);
  }, []);

  const handleFitAll = useCallback(() => {
    // Read live bounds from ref — no dependency on state, always fresh
    const allBounds = Object.values(windowBoundsRef.current);
    if (allBounds.length === 0) {
      setPanOffset({ x: 0, y: 0 });
      setScale(1);
      playSound('blipUp');
      return;
    }
    const minX = Math.min(...allBounds.map(b => b.x));
    const maxX = Math.max(...allBounds.map(b => b.x + b.w));
    const minY = Math.min(...allBounds.map(b => b.y));
    const maxY = Math.max(...allBounds.map(b => b.y + b.h));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const padding = 120;
    const bboxW = maxX - minX;
    const bboxH = maxY - minY;
    const fitScaleX = bboxW > 0 ? (viewport.width - padding) / bboxW : 1;
    const fitScaleY = bboxH > 0 ? (viewport.height - padding) / bboxH : 1;
    const fitScale = Math.max(0.2, Math.min(fitScaleX, fitScaleY, 1));

    setPanOffset({ x: -centerX, y: -centerY });
    setScale(fitScale);
    playSound('blipUp');
  }, [viewport, playSound]);

  // Fire delayed fit-all after launcher dismiss (gives apps time to render + report bounds)
  useEffect(() => {
    if (!pendingFitAllRef.current) return;
    pendingFitAllRef.current = false;
    const timer = setTimeout(handleFitAll, FIT_ALL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [showLauncher, handleFitAll]);

  // --- Resize ---
  const handleResizeStart = useCallback(
    (side: 'left' | 'right') => (e: React.MouseEvent) => {
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
    },
    [leftWidth, rightWidth, setLeftWidth, setRightWidth],
  );

  // --- Reset all windows to defaults ---
  const handleResetAllWindows = useCallback(() => {
    for (const config of workspace.apps) {
      const key = `hudson.ws.${workspace.id}.win.${config.app.id}`;
      try { localStorage.removeItem(key); } catch {}
    }
    setPanOffset({ x: 0, y: 0 });
    setScale(1);
    // Bump key to force WindowedApp remount → re-reads defaults from localStorage
    setWindowResetKey(k => k + 1);
    playSound('blipUp');
  }, [workspace, playSound]);

  // --- Open settings helper ---
  const openSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  // --- Open workspace manager ---
  const openWorkspaceManager = useCallback(() => {
    setShowWorkspaceManager(true);
  }, []);

  // --- Shell commands ---
  const shellCommands: CommandOption[] = useMemo(
    () => [
      {
        id: 'shell:settings',
        label: 'Settings',
        shortcut: 'Cmd+,',
        icon: <Settings size={14} />,
        action: () => openSettings(),
      },
      {
        id: 'shell:workspace-manager',
        label: 'Workspace Manager',
        shortcut: 'Cmd+Shift+,',
        icon: <Settings size={14} />,
        action: () => openWorkspaceManager(),
      },
      {
        id: 'shell:toggle-left',
        label: 'Toggle Left Panel',
        shortcut: 'Cmd+[',
        action: () => { setLeftCollapsed(c => !c); playSound('thock'); },
      },
      {
        id: 'shell:toggle-right',
        label: 'Toggle Right Panel',
        shortcut: 'Cmd+]',
        action: () => { setRightCollapsed(c => !c); playSound('thock'); },
      },
      {
        id: 'shell:toggle-terminal',
        label: 'Toggle Terminal',
        shortcut: 'Ctrl+`',
        action: () => { setShowTerminal(t => !t); playSound('slideIn'); },
      },
      {
        id: 'shell:toggle-guides',
        label: showGuides ? 'Hide Crosshair Guides' : 'Show Crosshair Guides',
        shortcut: 'Cmd+\\',
        action: () => setShowGuides(g => !g),
      },
      {
        id: 'shell:toggle-minimap',
        label: minimapCollapsed ? 'Show Minimap' : 'Hide Minimap',
        action: () => { setMinimapCollapsed(c => !c); playSound('thock'); },
      },
      {
        id: 'shell:reset-view',
        label: 'Reset View',
        shortcut: 'Cmd+0',
        action: () => { setPanOffset({ x: 0, y: 0 }); setScale(1); playSound('blipUp'); },
      },
      {
        id: 'shell:reset-all-windows',
        label: 'Reset All Windows',
        icon: <RotateCcw size={14} />,
        action: handleResetAllWindows,
      },
      {
        id: 'shell:toggle-mute',
        label: muted ? 'Unmute Sounds' : 'Mute Sounds',
        shortcut: 'Cmd+M',
        action: handleToggleMute,
      },
      {
        id: 'shell:docs',
        label: 'Open Documentation',
        icon: <BookOpen size={14} />,
        action: () => window.open('/docs', '_blank'),
      },
      // Workspace switch commands
      ...workspaces
        .filter(ws => ws.id !== activeWorkspaceId)
        .map(ws => ({
          id: `switch-ws:${ws.id}`,
          label: `Switch to ${ws.name}`,
          action: () => onSwitchWorkspace(ws.id),
        })),
    ],
    [
      showGuides,
      minimapCollapsed,
      muted,
      handleToggleMute,
      handleResetAllWindows,
      workspaces,
      activeWorkspaceId,
      onSwitchWorkspace,
      playSound,
      setLeftCollapsed,
      setRightCollapsed,
      setMinimapCollapsed,
      setShowTerminal,
      openSettings,
      openWorkspaceManager,
    ],
  );

  // --- Service commands for Cmd+K palette ---
  const serviceCommands = useMemo((): CommandOption[] => {
    const cmds: CommandOption[] = [];
    for (const svc of serviceRegistry.catalog) {
      const status = serviceRegistry.records[svc.id]?.status;
      if (status !== 'running') {
        cmds.push({ id: `svc:start:${svc.id}`, label: `Start ${svc.name}`, action: () => serviceRegistry.executeAction(svc.id, 'start') });
      }
      if (status === 'running') {
        cmds.push({ id: `svc:stop:${svc.id}`, label: `Stop ${svc.name}`, action: () => serviceRegistry.executeAction(svc.id, 'stop') });
      }
      cmds.push({ id: `svc:check:${svc.id}`, label: `Check ${svc.name}`, action: () => serviceRegistry.executeAction(svc.id, 'check') });
    }
    return cmds;
  }, [serviceRegistry.catalog, serviceRegistry.records, serviceRegistry.executeAction]);

  // --- Merge all commands ---
  const allCommands = useMemo(() => {
    const merged: CommandOption[] = [...shellCommands, ...serviceCommands];
    for (const hookData of allAppHooks) {
      merged.push(...hookData.commands);
    }
    return merged;
  }, [shellCommands, serviceCommands, allAppHooks]);

  // --- Intent catalog + executor (plumbing for voice/LLM layer) ---
  const catalog = useIntentCatalog(workspace);
  useIntentExecutor(allCommands, catalog);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === ',') {
        e.preventDefault();
        setShowWorkspaceManager(s => !s);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setShowSettings(s => !s);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // --- Canvas context menu ---
  const canvasContextMenuItems: ContextMenuEntry[] = useMemo(() => [
    {
      id: 'canvas:new-terminal',
      label: 'New Terminal...',
      icon: <TerminalSquare size={12} />,
      action: () => setShowTerminalSpawn(true),
    },
    { type: 'separator' },
    {
      id: 'canvas:reset-view',
      label: 'Reset View',
      shortcut: '⌘0',
      icon: <RotateCcw size={12} />,
      action: () => { setPanOffset({ x: 0, y: 0 }); setScale(1); playSound('blipUp'); },
    },
    {
      id: 'canvas:fit-all',
      label: 'Fit All in View',
      icon: <Maximize2 size={12} />,
      action: handleFitAll,
    },
    {
      id: 'canvas:reset-all-windows',
      label: 'Reset All Windows',
      icon: <RotateCcw size={12} />,
      action: handleResetAllWindows,
    },
    { type: 'separator' },
    {
      id: 'canvas:toggle-guides',
      label: showGuides ? 'Hide Guides' : 'Show Guides',
      shortcut: '⌘\\',
      icon: <Crosshair size={12} />,
      action: () => setShowGuides(g => !g),
    },
    {
      id: 'canvas:toggle-minimap',
      label: minimapCollapsed ? 'Show Minimap' : 'Hide Minimap',
      icon: <Map size={12} />,
      action: () => { setMinimapCollapsed(c => !c); playSound('thock'); },
    },
  ], [showGuides, minimapCollapsed, handleFitAll, handleResetAllWindows, playSound, setMinimapCollapsed, spawnTerminal]);

  // --- Shell layout context ---
  const shellLayout = useMemo(
    () => ({
      leftWidth: leftCollapsed ? 0 : leftWidth,
      rightWidth: rightCollapsed ? 0 : rightWidth,
      leftCollapsed,
      rightCollapsed,
      isTerminalOpen: showTerminal,
      terminalHeight,
      isTerminalMaximized,
    }),
    [leftWidth, rightWidth, leftCollapsed, rightCollapsed, showTerminal, terminalHeight, isTerminalMaximized],
  );

  // --- Left panel footer ---
  const singleApp = isSingleApp ? workspace.apps[0].app : null;
  const leftFooter = (
    <>
      {isSingleApp && singleApp?.slots.LeftFooter && (
        <AppSlotErrorBoundary appName={singleApp.name} slotName="LeftFooter">
          <singleApp.slots.LeftFooter />
        </AppSlotErrorBoundary>
      )}
      {isCanvasMode && (
        <Minimap
          pan={panOffset}
          zoom={scale}
          viewportSize={viewport}
          isCollapsed={minimapCollapsed}
          onToggleCollapse={() => { setMinimapCollapsed(c => !c); playSound('thock'); }}
          onNavigate={handleMinimapNavigate}
          onFitAll={handleFitAll}
        >
          {Object.entries(windowBoundsMap).map(([appId, b]) => (
            <div
              key={appId}
              className={`absolute rounded-[0.5px] pointer-events-none ${
                appId === focusedAppId
                  ? 'border border-emerald-400/60 bg-emerald-400/10'
                  : 'border border-neutral-400/40 bg-neutral-400/10'
              }`}
              style={{
                left: `${((b.x + 2000) / 4000) * 100}%`,
                top:  `${((b.y + 2000) / 4000) * 100}%`,
                width:  `${(b.w / 4000) * 100}%`,
                height: `${(b.h / 4000) * 100}%`,
              }}
            />
          ))}
        </Minimap>
      )}
    </>
  );

  // --- Right panel footer ---
  const rightFooter = (
    <CommandDock onOpenCommandPalette={() => { setShowCommandPalette(true); playSound('pop'); }} />
  );

  // --- Left/Right sidebar content ---
  const leftPanelContent = isSingleApp ? (
    singleApp?.slots.LeftPanel && (
      <AppSlotErrorBoundary appName={singleApp.name} slotName="LeftPanel">
        <singleApp.slots.LeftPanel />
      </AppSlotErrorBoundary>
    )
  ) : (
    workspace.apps.map(config => {
      const { app } = config;
      if (!app.slots.LeftPanel) return null;
      const deps = app.services;
      const serviceDeps = deps?.map(dep => ({
        serviceId: dep.serviceId,
        status: (serviceRegistry.records[dep.serviceId]?.status ?? 'unknown') as ServiceStatus,
      }));
      return (
        <SidebarSection
          key={app.id}
          appName={app.name}
          appIcon={app.leftPanel?.icon}
          isFocused={app.id === focusedAppId}
          onFocus={() => setFocusedAppId(app.id)}
          defaultExpanded={app.id === focusedAppId}
          isVisible={activatedAppIds.has(app.id)}
          onToggleVisibility={() => handleToggleAppVisibility(app.id)}
          serviceDeps={serviceDeps}
          onOpenManager={openWorkspaceManager}
        >
          <AppSlotErrorBoundary appName={app.name} slotName="LeftPanel">
            <app.slots.LeftPanel />
          </AppSlotErrorBoundary>
        </SidebarSection>
      );
    })
  );

  // --- Right panel content: Inspector + Tools split ---
  const focusedApp = isSingleApp ? singleApp : workspace.apps.find(c => c.app.id === focusedAppId)?.app ?? null;
  const hasInspectorOrTools = focusedApp && (focusedApp.slots.Inspector || focusedApp.tools?.length);

  const rightPanelContent = hasInspectorOrTools ? (
    <>
      {focusedApp.slots.Inspector && (
        <AppSlotErrorBoundary appName={focusedApp.name} slotName="Inspector">
          <focusedApp.slots.Inspector />
        </AppSlotErrorBoundary>
      )}
      {focusedApp.tools && focusedApp.tools.length > 0 && (
        <ToolAccordion
          tools={focusedApp.tools}
          expandedToolId={expandedToolId}
          onToggle={handleToggleTool}
        />
      )}
    </>
  ) : (
    // Backward compat: fall back to RightPanel slot
    focusedApp?.slots.RightPanel ? (
      <AppSlotErrorBoundary appName={focusedApp.name} slotName="RightPanel">
        <focusedApp.slots.RightPanel />
      </AppSlotErrorBoundary>
    ) : null
  );

  // --- Panel titles ---
  const leftPanelTitle = isSingleApp
    ? (singleApp?.leftPanel?.title ?? 'Navigation')
    : 'Navigation';
  const rightPanelTitle = isSingleApp
    ? (singleApp?.rightPanel?.title ?? 'Inspector')
    : 'Inspector';
  const leftPanelIcon = isSingleApp ? singleApp?.leftPanel?.icon : undefined;
  const rightPanelIcon = isSingleApp ? singleApp?.rightPanel?.icon : undefined;
  const leftHeaderActions = isSingleApp && singleApp?.leftPanel?.headerActions
    ? <singleApp.leftPanel.headerActions />
    : undefined;

  // --- Terminal content ---
  const hudsonTerminalNode = <HudsonTerminal workspace={workspace} catalog={catalog} />;

  const terminalContent = (() => {
    // No app terminals — render Hudson terminal directly, no tab bar
    if (appsWithTerminal.length === 0) {
      return hudsonTerminalNode;
    }

    // Has app terminals — always show tab bar with Hudson first
    const activeApps = sortedTerminalApps.filter(c => activatedAppIds.has(c.app.id));
    const inactiveApps = sortedTerminalApps.filter(c => !activatedAppIds.has(c.app.id));

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="shrink-0 flex items-center border-b border-neutral-700/50 min-w-0">
          {/* Hudson global tab */}
          <button
            onClick={() => setActiveTerminalAppId(HUDSON_TERMINAL_ID)}
            className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${
              activeTerminalAppId === HUDSON_TERMINAL_ID
                ? 'text-cyan-400 border-b border-cyan-400 bg-cyan-500/5'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.02]'
            }`}
          >
            Hudson
          </button>
          {/* Separator between Hudson and app tabs */}
          <div className="h-3 w-px bg-neutral-700/50 mx-1" />
          {/* Active app tabs */}
          {activeApps.map(config => (
            <button
              key={config.app.id}
              onClick={() => setActiveTerminalAppId(config.app.id)}
              className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${
                config.app.id === activeTerminalAppId
                  ? 'text-emerald-400 border-b border-emerald-400 bg-emerald-500/5'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.02]'
              }`}
            >
              {config.app.name}
            </button>
          ))}
          {/* Inactive app tabs */}
          {inactiveApps.length > 0 && activeApps.length > 0 && (
            <div className="h-3 w-px bg-neutral-700/50 mx-1" />
          )}
          {inactiveApps.map(config => (
            <button
              key={config.app.id}
              onClick={() => setActiveTerminalAppId(config.app.id)}
              className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors opacity-30 ${
                config.app.id === activeTerminalAppId
                  ? 'text-emerald-400 border-b border-emerald-400 bg-emerald-500/5 opacity-100'
                  : 'text-neutral-500 hover:text-neutral-400 hover:opacity-60'
              }`}
            >
              {config.app.name}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-hidden min-w-0">
          {activeTerminalAppId === HUDSON_TERMINAL_ID ? (
            hudsonTerminalNode
          ) : activeTerminalApp?.slots.Terminal ? (
            <AppSlotErrorBoundary appName={activeTerminalApp.name} slotName="Terminal">
              <activeTerminalApp.slots.Terminal />
            </AppSlotErrorBoundary>
          ) : null}
        </div>
      </div>
    );
  })();

  // --- World content (always rendered — launcher overlays on top) ---
  const SingleContent = singleApp?.slots.Content ?? null;
  const singleAppConfig = isSingleApp ? workspace.apps[0] : null;
  const worldContent = (
    <div data-hudson-world>
      {isSingleApp && SingleContent && singleAppConfig ? (
        <ServiceBanner appConfig={singleAppConfig} onOpenServices={openWorkspaceManager}>
          <AppSlotErrorBoundary appName={singleApp!.name} slotName="Content">
            <SingleContent />
          </AppSlotErrorBoundary>
        </ServiceBanner>
      ) : (
        <MultiAppCanvas
          workspace={workspace}
          focusedAppId={focusedAppId}
          onFocusApp={setFocusedAppId}
          onCloseApp={handleToggleAppVisibility}
          worldScale={scale}
          onResetView={() => { setPanOffset({ x: 0, y: 0 }); setScale(1); playSound('blipUp'); }}
          windowResetKey={windowResetKey}
          onReportBounds={reportWindowBounds}
          activatedAppIds={activatedAppIds}
          showLauncher={showLauncher}
          onOpenServices={openWorkspaceManager}
          dynamicWindows={dynamicWindows}
          onCloseDynamicWindow={closeDynamicWindow}
        />
      )}
    </div>
  );

  // --- Workspace Manager context value ---
  const wmData = useMemo(() => ({
    workspace,
    activatedAppIds,
    focusedAppId,
    onToggleAppVisibility: handleToggleAppVisibility,
    onFocusApp: setFocusedAppId,
    serviceRegistry,
    appSettings,
  }), [workspace, activatedAppIds, focusedAppId, handleToggleAppVisibility, serviceRegistry, appSettings]);

  return (
    <ServiceRegistryProvider value={serviceRegistry}>
    <WorkspaceManagerProvider value={wmData}>
    <ShellLayoutProvider value={shellLayout}>
      <Frame
        mode={isCanvasMode ? 'canvas' : 'panel'}
        panOffset={panOffset}
        scale={scale}
        onPan={handlePan}
        onZoom={handleZoom}
        onViewportChange={setViewport}
        zoomSensitivity={shellSettings.zoomSensitivity}
        zoomControlsRightOffset={rightCollapsed ? 0 : rightWidth}
        {...(isCanvasMode ? {
          canvasProps: { showGuides, onGuidesChange: setShowGuides, gridOpacity },
          canvasContextMenuItems,
        } : {})}
        hud={
          <>
            <motion.div
              initial={bootMode === 'none' ? false : { y: -48, opacity: 0 }}
              animate={chromeVisible ? { y: 0, opacity: 1 } : { y: -48, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
            >
              <NavigationBar
                title="HUDSON"
                subtitle={
                  <WorkspaceSwitcher
                    workspaces={workspaces}
                    activeId={activeWorkspaceId}
                    onSwitch={onSwitchWorkspace}
                  />
                }
                search={focused.search ?? undefined}
                center={focused.navCenter}
                actions={
                  <>
                    {focused.navActions}
                    <a
                      href="/docs"
                      target="_blank"
                      className="p-1.5 rounded hover:bg-white/10 transition-colors text-neutral-400 hover:text-white"
                      title="Documentation"
                    >
                      <BookOpen size={14} />
                    </a>
                    <button
                      onClick={handleToggleMute}
                      className="p-1.5 rounded hover:bg-white/10 transition-colors text-neutral-400 hover:text-white"
                      title={muted ? 'Unmute' : 'Mute'}
                    >
                      {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    </button>
                  </>
                }
              />
            </motion.div>

            <motion.div
              initial={bootMode === 'none' ? false : { x: -leftWidth, opacity: 0 }}
              animate={panelsVisible ? { x: 0, opacity: 1 } : { x: -leftWidth, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
            >
              <SidePanel
                side="left"
                title={leftPanelTitle}
                icon={leftPanelIcon}
                isCollapsed={leftCollapsed}
                onToggleCollapse={() => { setLeftCollapsed(!leftCollapsed); playSound('thock'); }}
                width={leftWidth}
                onResizeStart={handleResizeStart('left')}
                footer={leftFooter}
                headerActions={leftHeaderActions}
              >
                {leftPanelContent}
              </SidePanel>
            </motion.div>

            <motion.div
              initial={bootMode === 'none' ? false : { x: rightWidth, opacity: 0 }}
              animate={panelsVisible ? { x: 0, opacity: 1 } : { x: rightWidth, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
            >
              <SidePanel
                side="right"
                title={rightPanelTitle}
                icon={rightPanelIcon}
                isCollapsed={rightCollapsed}
                onToggleCollapse={() => { setRightCollapsed(!rightCollapsed); playSound('thock'); }}
                width={rightWidth}
                onResizeStart={handleResizeStart('right')}
                footer={rightFooter}
              >
                {rightPanelContent}
              </SidePanel>
            </motion.div>

            <motion.div
              initial={bootMode === 'none' ? false : { y: 28, opacity: 0 }}
              animate={chromeVisible ? { y: 0, opacity: 1 } : { y: 28, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
            >
              <StatusBar
                status={(() => {
                  const { catalog, records } = serviceRegistry;
                  const hasError = catalog.some(s => records[s.id]?.status === 'error');
                  const allRunning = catalog.length > 0 && catalog.every(s => records[s.id]?.status === 'running');
                  if (hasError) return { label: 'ERROR', color: 'red' as const };
                  if (allRunning) return { label: 'NOMINAL', color: 'emerald' as const };
                  if (catalog.length === 0) return { label: 'READY', color: 'emerald' as const };
                  return { label: 'DEGRADED', color: 'amber' as const };
                })()}
                viewport={{
                  pan: panOffset,
                  zoom: scale,
                  canvasSize: { w: viewport.width, h: viewport.height },
                }}
                onToggleTerminal={() => { setShowTerminal(t => !t); playSound('slideIn'); }}
                isTerminalOpen={showTerminal}
                left={
                  <div className="flex items-center gap-4">
                    <ServiceStatusIndicator registry={serviceRegistry} onOpenSettings={openWorkspaceManager} />
                    <div className="h-3 w-px bg-neutral-700" />
                    <button
                      onClick={() => openSettings()}
                      className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-200 transition-colors"
                      title="Settings (⌘,)"
                    >
                      <Settings size={10} />
                      <span className="uppercase text-[10px] font-semibold tracking-wider">Settings</span>
                    </button>
                    {showSaved && (
                      <>
                        <div className="h-3 w-px bg-neutral-700" />
                        <span className="text-[10px] font-semibold tracking-wider uppercase text-emerald-500 animate-pulse">
                          Saved
                        </span>
                      </>
                    )}
                  </div>
                }
              />
            </motion.div>

            {/* Terminal — inset between panels */}
            <div
              className="pointer-events-none"
              style={{
                position: 'fixed',
                left: leftCollapsed ? 0 : leftWidth,
                right: rightCollapsed ? 0 : rightWidth,
                bottom: 0,
                top: 0,
                zIndex: 45,
                transition: 'left 200ms ease, right 200ms ease',
                transform: 'translateZ(0)',
              }}
            >
              <TerminalDrawer
                isOpen={showTerminal}
                onClose={() => { setShowTerminal(false); playSound('slideOut'); }}
                onToggleMaximize={() => setIsTerminalMaximized(m => !m)}
                isMaximized={isTerminalMaximized}
                height={terminalHeight}
                onHeightChange={setTerminalHeight}
              >
                {terminalContent}
              </TerminalDrawer>
            </div>

            {/* Settings panel */}
            <SettingsPanel
              isOpen={showSettings}
              onClose={() => setShowSettings(false)}
              settings={shellSettings}
              onUpdate={updateShellSettings}
              onReset={resetShellSettings}
            />

            {/* Workspace Manager */}
            <WorkspaceManagerPanel
              isOpen={showWorkspaceManager}
              onClose={() => setShowWorkspaceManager(false)}
            />

            {/* Command palette */}
            <CommandPalette
              isOpen={showCommandPalette}
              onClose={() => setShowCommandPalette(false)}
              commands={allCommands}
            />

            {/* Terminal spawn dialog */}
            {showTerminalSpawn && (
              <TerminalSpawnDialog
                onSpawn={(cwd) => { spawnTerminal(cwd); setShowTerminalSpawn(false); }}
                onClose={() => setShowTerminalSpawn(false)}
              />
            )}

            {/* App launcher overlay (rendered in HUD layer to escape canvas transform) */}
            {showLauncher && launcherReady && (
              <div className="fixed inset-0 z-[5] pointer-events-auto">
                <AppLauncher
                  workspace={workspace}
                  activatedAppIds={activatedAppIds}
                  onActivateApp={handleActivateApp}
                  onDismiss={handleDismissLauncher}
                />
              </div>
            )}
          </>
        }
      >
        {worldContent}
      </Frame>
    </ShellLayoutProvider>
    </WorkspaceManagerProvider>
    </ServiceRegistryProvider>
  );
}

// ---------------------------------------------------------------------------
// MultiAppCanvas — renders native + windowed apps together
// ---------------------------------------------------------------------------
interface DynamicWindowEntry {
  id: string;
  title: string;
  render: () => ReactNode;
  bounds: { x: number; y: number; w: number; h: number };
}

function MultiAppCanvas({
  workspace,
  focusedAppId,
  onFocusApp,
  onCloseApp,
  worldScale,
  onResetView,
  windowResetKey,
  onReportBounds,
  activatedAppIds,
  showLauncher,
  onOpenServices,
  dynamicWindows,
  onCloseDynamicWindow,
}: {
  workspace: HudsonWorkspace;
  focusedAppId: string;
  onFocusApp: (id: string) => void;
  onCloseApp: (id: string) => void;
  worldScale: number;
  onResetView: () => void;
  windowResetKey: number;
  onReportBounds: (appId: string, bounds: { x: number; y: number; w: number; h: number }) => void;
  activatedAppIds: Set<string>;
  showLauncher: boolean;
  onOpenServices: () => void;
  dynamicWindows: DynamicWindowEntry[];
  onCloseDynamicWindow: (id: string) => void;
}) {
  // Separate native vs windowed apps — filter by activated when launcher is open
  const nativeApps = workspace.apps.filter(c => (c.canvasMode ?? 'native') === 'native');
  const windowedApps = workspace.apps.filter(c => c.canvasMode === 'windowed');

  // Filter to only show activated (visible) apps
  const visibleNative = nativeApps.filter(c => activatedAppIds.has(c.app.id));
  const visibleWindowed = windowedApps.filter(c => activatedAppIds.has(c.app.id));

  return (
    <>
      {/* Native apps render directly on canvas */}
      <AnimatePresence>
        {visibleNative.map(config => (
          <motion.div
            key={config.app.id}
            data-native-app={config.app.name}
            onClick={() => onFocusApp(config.app.id)}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
          >
            <ServiceBanner appConfig={config} onOpenServices={onOpenServices}>
              <AppSlotErrorBoundary appName={config.app.name} slotName="Content">
                <config.app.slots.Content />
              </AppSlotErrorBoundary>
            </ServiceBanner>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Windowed apps render inside AppWindow */}
      <AnimatePresence>
        {visibleWindowed.map(config => (
          <motion.div
            key={`${config.app.id}-${windowResetKey}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
          >
            <WindowedApp
              config={config}
              workspaceId={workspace.id}
              isFocused={config.app.id === focusedAppId}
              onFocus={() => onFocusApp(config.app.id)}
              onClose={() => onCloseApp(config.app.id)}
              worldScale={worldScale}
              onResetView={onResetView}
              onReportBounds={onReportBounds}
              onOpenServices={onOpenServices}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Dynamic windows (spawned terminals, etc.) */}
      <AnimatePresence>
        {dynamicWindows.map(dw => (
          <motion.div
            key={dw.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
          >
            <DynamicWindowedApp
              win={dw}
              isFocused={dw.id === focusedAppId}
              onFocus={() => onFocusApp(dw.id)}
              onClose={() => onCloseDynamicWindow(dw.id)}
              worldScale={worldScale}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------
// DynamicWindowedApp — standalone window not tied to an app Provider
// ---------------------------------------------------------------------------
function DynamicWindowedApp({
  win,
  isFocused,
  onFocus,
  onClose,
  worldScale,
}: {
  win: DynamicWindowEntry;
  isFocused: boolean;
  onFocus: () => void;
  onClose: () => void;
  worldScale: number;
}) {
  const [bounds, setBounds] = useState(win.bounds);

  return (
    <AppWindow
      title={win.title}
      bounds={bounds}
      onBoundsChange={setBounds}
      isFocused={isFocused}
      onFocus={onFocus}
      onClose={onClose}
      worldScale={worldScale}
    >
      {win.render()}
    </AppWindow>
  );
}

// ---------------------------------------------------------------------------
// TerminalSpawnDialog — lightweight popover to set CWD before spawning
// ---------------------------------------------------------------------------
function TerminalSpawnDialog({ onSpawn, onClose }: { onSpawn: (cwd: string) => void; onClose: () => void }) {
  const [cwd, setCwd] = useState('~');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSpawn(cwd.trim() || '~');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="rounded-lg border border-neutral-700/60 shadow-[0_0_40px_rgba(0,0,0,0.6)] overflow-hidden w-[380px]"
        style={{ background: 'rgba(18, 18, 18, 0.97)', backdropFilter: 'blur(20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <TerminalSquare size={14} className="text-neutral-400" />
              <span className="text-[12px] font-mono text-neutral-200 tracking-wider">New Terminal</span>
            </div>
            <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-1.5 block">
              Working Directory
            </label>
            <input
              ref={inputRef}
              type="text"
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              placeholder="~/dev/my-project"
              className="w-full bg-neutral-800/80 border border-neutral-700/50 rounded px-3 py-2 text-[12px] font-mono text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-emerald-500/40 transition-colors"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-neutral-700/30">
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] px-3 py-1.5 rounded border border-neutral-700 text-neutral-400 hover:text-neutral-300 hover:bg-white/5 transition-colors font-mono"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="text-[11px] px-4 py-1.5 rounded border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors font-mono"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WindowedApp — single app in an AppWindow with persisted bounds
// ---------------------------------------------------------------------------
function WindowedApp({
  config,
  workspaceId,
  isFocused,
  onFocus,
  onClose,
  worldScale,
  onResetView,
  onReportBounds,
  onOpenServices,
}: {
  config: WorkspaceAppConfig;
  workspaceId: string;
  isFocused: boolean;
  onFocus: () => void;
  onClose: () => void;
  worldScale: number;
  onResetView: () => void;
  onReportBounds: (appId: string, bounds: { x: number; y: number; w: number; h: number }) => void;
  onOpenServices: () => void;
}) {
  const defaults = config.defaultWindowBounds ?? { x: 100, y: 100, w: 800, h: 600 };
  const [bounds, setBounds] = useWindowBounds(workspaceId, config.app.id, defaults);
  const layout = useShellLayout();
  const { navTotalHeight } = usePlatformLayout();

  // Report bounds upstream for minimap + fit-all
  useEffect(() => {
    onReportBounds(config.app.id, bounds);
  }, [bounds, config.app.id, onReportBounds]);

  // Lifted maximize state so context menu + title bar button stay in sync
  const [isMaximized, setIsMaximized] = useState(false);
  const [preMaxBounds, setPreMaxBounds] = useState<typeof defaults | null>(null);

  const handleToggleMaximize = useCallback(() => {
    if (isMaximized && preMaxBounds) {
      setBounds(preMaxBounds);
      setIsMaximized(false);
      setPreMaxBounds(null);
    } else {
      // Reset the canvas view so the expanded window lands centered on screen
      onResetView();
      setBounds(prev => {
        setPreMaxBounds(prev);
        // Account for shell chrome: nav bar, status bar, sidebars, terminal
        const STATUS_H = 28;
        const termH = layout.isTerminalOpen ? layout.terminalHeight : 0;
        const chromeLeft = layout.leftWidth;
        const chromeRight = layout.rightWidth;
        const chromeTop = navTotalHeight;
        const chromeBottom = STATUS_H + termH;

        // Available viewport minus chrome, with a small inset so canvas peeks through
        const pad = 8;
        const availW = window.innerWidth - chromeLeft - chromeRight - pad * 2;
        const availH = window.innerHeight - chromeTop - chromeBottom - pad * 2;

        // After onResetView(), world origin (0,0) sits at viewport center.
        // Convert the top-left of the available area from screen to world coords.
        const worldX = chromeLeft + pad - window.innerWidth / 2;
        const worldY = chromeTop + pad - window.innerHeight / 2;

        return { x: worldX, y: worldY, w: availW, h: availH };
      });
      setIsMaximized(true);
    }
  }, [isMaximized, preMaxBounds, setBounds, onResetView, layout]);

  const handleResetWindow = useCallback(() => {
    setBounds(defaults);
    setIsMaximized(false);
    setPreMaxBounds(null);
  }, [defaults, setBounds]);

  const contextMenuItems: ContextMenuEntry[] = useMemo(() => [
    {
      id: `${config.app.id}:bring-to-center`,
      label: 'Bring to Center',
      icon: <Crosshair size={12} />,
      action: () => {
        setBounds(prev => ({
          ...prev,
          x: -(prev.w / 2),
          y: -(prev.h / 2),
        }));
      },
    },
    {
      id: `${config.app.id}:maximize`,
      label: isMaximized ? 'Restore' : 'Maximize',
      icon: isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />,
      action: handleToggleMaximize,
    },
    {
      id: `${config.app.id}:reset-window`,
      label: 'Reset Window',
      icon: <RotateCcw size={12} />,
      action: handleResetWindow,
    },
    { type: 'separator' },
    {
      id: `${config.app.id}:reset-view`,
      label: 'Reset View',
      shortcut: '⌘0',
      icon: <RotateCcw size={12} />,
      action: onResetView,
    },
    {
      id: `${config.app.id}:inspect`,
      label: 'Inspect',
      icon: <ScanSearch size={12} />,
      disabled: true,
      action: () => {},
    },
    { type: 'separator' },
    {
      id: `${config.app.id}:close`,
      label: 'Close',
      shortcut: '⌘W',
      icon: <X size={12} />,
      action: onClose,
    },
  ], [config.app.id, isMaximized, setBounds, handleToggleMaximize, handleResetWindow, onResetView, onClose]);

  return (
    <AppWindow
      title={config.app.name}
      bounds={bounds}
      onBoundsChange={setBounds}
      isFocused={isFocused}
      onFocus={onFocus}
      onClose={onClose}
      worldScale={worldScale}
      isMaximized={isMaximized}
      onToggleMaximize={handleToggleMaximize}
      contextMenuItems={contextMenuItems}
    >
      <ServiceBanner appConfig={config} onOpenServices={onOpenServices}>
        <AppSlotErrorBoundary appName={config.app.name} slotName="Content">
          <config.app.slots.Content />
        </AppSlotErrorBoundary>
      </ServiceBanner>
    </AppWindow>
  );
}
