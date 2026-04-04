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
  captureWorkspace,
} from '@hudson/sdk';
import type { HudsonWorkspace, WorkspaceAppConfig, CommandOption, StatusColor, SearchConfig, ContextMenuEntry } from '@hudson/sdk';
import { Volume2, VolumeX, Settings, Crosshair, Maximize2, Minimize2, RotateCcw, ScanSearch, Map, BookOpen, X, TerminalSquare, Layers, PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose, Activity, Sparkles, Camera, Loader2, LayoutGrid } from 'lucide-react';
import { TerminalContent } from '../apps/terminal/TerminalContent';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { SidebarSection } from './SidebarSection';
import { ToolAccordion } from './ToolAccordion';
import { ShellLayoutProvider, useShellLayout } from './ShellLayoutContext';
import type { AppSettingsEntry } from '../apps/hudson-docs/components';
import type { HudsonSettings } from '../apps/hudson-docs/types';
import { useIntentCatalog } from '../hooks/useIntentCatalog';
import { useIntentExecutor } from '../hooks/useIntentExecutor';
import { AppSlotErrorBoundary } from './AppSlotErrorBoundary';
import { WorkspaceErrorBoundary } from './WorkspaceErrorBoundary';
import { HudsonTerminal } from './HudsonTerminal';
import { WorkspaceAI } from './WorkspaceAI';
import { DataBusProvider, usePortBridge, useDataBus } from './DataBusContext';
import { PipeConnectorLayer } from './PipeConnectorLayer';
import { PortActivityLog } from './PortActivityLog';
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
const BOUNDS_FLUSH_MS = 500;

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
  gridOpacity: 60,
  connectorStyle: 'dashed',
  zoomSensitivity: 1.0,
  masterMute: false,
  uiClickSounds: true,
  uiTransitionSounds: true,
  aiMode: 'cli',
  font: { fontSize: 13, fontFamily: 'system-ui' },
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

  // --- Disabled apps (persisted to disk via workspace-state API) ---
  const [disabledAppIdsArr, setDisabledAppIdsArr] = useState<string[]>([]);
  const disabledLoaded = useRef(false);

  // Load disabled apps from disk
  useEffect(() => {
    disabledLoaded.current = false;
    fetch(`/api/workspace-state?id=${workspace.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.disabledApps && Array.isArray(data.disabledApps)) {
          // Only keep IDs that exist in the workspace
          const wsAppIds = new Set(workspace.apps.map(c => c.app.id));
          setDisabledAppIdsArr((data.disabledApps as string[]).filter(id => wsAppIds.has(id)));
        }
        disabledLoaded.current = true;
      })
      .catch(() => { disabledLoaded.current = true; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  // Save disabled apps to disk (debounced)
  const disabledSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!disabledLoaded.current) return;
    if (disabledSaveRef.current) clearTimeout(disabledSaveRef.current);
    disabledSaveRef.current = setTimeout(() => {
      fetch('/api/workspace-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: workspace.id, state: { disabledApps: disabledAppIdsArr } }),
      }).catch(() => {});
    }, 1000);
  }, [disabledAppIdsArr, workspace.id]);

  const disabledAppIds = useMemo(() => new Set(disabledAppIdsArr), [disabledAppIdsArr]);

  // Filter workspace to only enabled apps for Provider nesting + rendering
  const enabledWorkspace = useMemo(() => ({
    ...workspace,
    apps: workspace.apps.filter(c => !disabledAppIds.has(c.app.id)),
  }), [workspace, disabledAppIds]);

  // Save session on workspace switch
  const handleSwitchWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    saveSession(id);
  }, []);

  // Nest ALL app Providers (including disabled) to keep the tree stable.
  // Removing a Provider from the nesting chain causes React to remount
  // everything below it, losing all state (modal open, fetched templates, etc.).
  let tree: ReactNode = (
    <WorkspaceInner
      key={workspace.id}
      workspace={enabledWorkspace}
      fullWorkspace={workspace}
      disabledAppIds={disabledAppIds}
      setDisabledAppIdsArr={setDisabledAppIdsArr}
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
    tree = <app.Provider disabled={disabledAppIds.has(app.id)}>{tree}</app.Provider>;
  }

  // DataBusProvider wraps above all app Providers so port hooks can register
  tree = <DataBusProvider workspace={enabledWorkspace}>{tree}</DataBusProvider>;

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
  fullWorkspace,
  disabledAppIds,
  setDisabledAppIdsArr,
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
  bootPhase,
  bootMode,
  initialShowLauncher,
}: {
  workspace: HudsonWorkspace;
  /** Full workspace including disabled apps (for workspace editor) */
  fullWorkspace: HudsonWorkspace;
  disabledAppIds: Set<string>;
  setDisabledAppIdsArr: (v: string[] | ((prev: string[]) => string[])) => void;
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

  // gridOpacity is computed below after shellSettings is declared

  // --- Hook merging ---
  // Hooks must be called for ALL apps (including disabled) to keep hook order stable.
  // Results for disabled apps are filtered out downstream.
  const allAppHooksRaw: AppHookData[] = fullWorkspace.apps.map(config => useAppHooks(config));
  const allAppHooks = allAppHooksRaw.filter(h => !disabledAppIds.has(h.appId));

  // --- Port bridge (registers output/input hooks with DataBus) ---
  // eslint-disable-next-line react-hooks/rules-of-hooks
  fullWorkspace.apps.forEach(config => usePortBridge(config));

  // --- App-level settings (called unconditionally for each app) ---
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const appSettings = fullWorkspace.apps.map(config => useAppSettingsBridge(config))
    .filter((e): e is AppSettingsEntry => e !== null);

  // --- Service registry (global, not tied to any app) ---
  const serviceRegistry = useServiceRegistry();
  const showSaved = useSaveIndicator();

  // --- Auto-start required services for workspace apps ---
  const autoStartedServicesRef = useRef(false);
  useEffect(() => {
    if (autoStartedServicesRef.current) return;
    autoStartedServicesRef.current = true;

    // Collect required (non-optional) service IDs from all workspace apps
    const requiredServiceIds = new Set<string>();
    for (const config of fullWorkspace.apps) {
      for (const dep of config.app.services ?? []) {
        if (!dep.optional) requiredServiceIds.add(dep.serviceId);
      }
    }
    if (requiredServiceIds.size === 0) return;

    // After a brief delay (let initial health check run), start any that aren't running
    const timer = setTimeout(async () => {
      for (const sid of requiredServiceIds) {
        const rec = serviceRegistry.records[sid];
        if (!rec || rec.status !== 'running') {
          console.log(`[workspace] Auto-starting required service: ${sid}`);
          await serviceRegistry.executeAction(sid, 'start', 'system');
        }
      }
    }, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Focus state (persisted per workspace) ---
  const defaultFocus = workspace.defaultFocusedAppId ?? workspace.apps[0]?.app.id ?? '';
  const [focusedAppId, setFocusedAppIdRaw] = usePersistentState(
    `hudson.ws.${workspace.id}.focus`,
    defaultFocus,
  );
  const focusedIdx = allAppHooks.findIndex(h => h.appId === focusedAppId);
  const focused = allAppHooks[focusedIdx >= 0 ? focusedIdx : 0];

  // --- Z-order tracking (higher index = on top) ---
  const zCounterRef = useRef(0);
  const [zOrderMap, setZOrderMap] = useState<Record<string, number>>(() => {
    // Initialize all apps with sequential z-indices so nothing starts at 0
    const map: Record<string, number> = {};
    for (const config of fullWorkspace.apps) {
      zCounterRef.current += 1;
      map[config.app.id] = zCounterRef.current;
    }
    // Focused app gets the highest initial z-index
    if (focusedAppId) {
      zCounterRef.current += 1;
      map[focusedAppId] = zCounterRef.current;
    }
    return map;
  });

  const setFocusedAppId = useCallback((appId: string) => {
    setFocusedAppIdRaw(appId);
    // Bring to front by assigning the next z-counter value
    zCounterRef.current += 1;
    setZOrderMap(prev => ({ ...prev, [appId]: zCounterRef.current }));
  }, [setFocusedAppIdRaw]);

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

  // --- Activated apps tracking (persisted to disk via /api/workspace-state) ---
  const isFullBoot = bootMode === 'full';
  const allAppIds = useMemo(() => workspace.apps.map(c => c.app.id), [workspace]);
  const defaultVisible = isFullBoot && initialShowLauncher ? [] : allAppIds;
  const [activatedAppIdsArr, setActivatedAppIdsArr] = useState<string[]>(defaultVisible);
  const wsStateReady = useRef(false);
  const savePending = useRef(0);

  // Load from disk on mount / workspace switch
  useEffect(() => {
    wsStateReady.current = false;
    savePending.current++;
    const gen = savePending.current;
    fetch(`/api/workspace-state?id=${workspace.id}`)
      .then(r => r.json())
      .then(data => {
        if (gen !== savePending.current) return; // stale
        if (data.visibleApps && Array.isArray(data.visibleApps)) {
          const validIds = (data.visibleApps as string[]).filter(id => allAppIds.includes(id));
          const missing = allAppIds.filter(id => !validIds.includes(id));
          setActivatedAppIdsArr([...validIds, ...missing]);
        }
        wsStateReady.current = true;
      })
      .catch(() => { wsStateReady.current = true; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  // Save to disk on change (debounced, only after initial load completes)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!wsStateReady.current) return; // Don't save until disk load finishes
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch('/api/workspace-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: workspace.id, state: { visibleApps: activatedAppIdsArr } }),
      }).catch(() => {});
    }, 1000);
  }, [activatedAppIdsArr, workspace.id]);

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

  // --- Disable/enable apps (removes from Provider tree entirely) ---
  const handleToggleAppDisabled = useCallback((appId: string) => {
    const isCurrentlyDisabled = disabledAppIds.has(appId);

    // Update disabled set
    setDisabledAppIdsArr(prev => {
      const set = new Set(prev);
      if (set.has(appId)) {
        set.delete(appId);
      } else {
        set.add(appId);
      }
      return [...set];
    });

    // Separate state update (not nested in another updater)
    if (!isCurrentlyDisabled) {
      // Disabling — remove from visible
      setActivatedAppIds(vis => {
        const next = new Set(vis);
        next.delete(appId);
        return next;
      });
    } else {
      // Re-enabling — add to visible
      setActivatedAppIds(vis => new Set([...vis, appId]));
    }
  }, [disabledAppIds, setDisabledAppIdsArr, setActivatedAppIds]);

  // --- App ordering (for workspace editor display) ---
  const allFullAppIds = useMemo(() => fullWorkspace.apps.map(c => c.app.id), [fullWorkspace]);
  const [appOrder, setAppOrder] = usePersistentState<string[]>(
    `hudson.ws.${workspace.id}.appOrder`,
    allFullAppIds,
  );
  // Ensure order includes all current apps (handles new apps added to workspace)
  const normalizedAppOrder = useMemo(() => {
    const ordered = appOrder.filter(id => allFullAppIds.includes(id));
    const missing = allFullAppIds.filter(id => !ordered.includes(id));
    return [...ordered, ...missing];
  }, [appOrder, allFullAppIds]);

  const handleReorderApps = useCallback((orderedIds: string[]) => {
    setAppOrder(orderedIds);
  }, [setAppOrder]);

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
  const [showWorkspaceManager, setShowWorkspaceManager] = useState(false);
  const [workspaceEditorTab, setWorkspaceEditorTab] = useState<'overview' | 'apps' | 'settings'>('overview');
  const [fullscreenAppId, setFullscreenAppId] = useState<string | null>(null);
  const [fsLeftOpen, setFsLeftOpen] = useState(true);
  const [fsRightOpen, setFsRightOpen] = useState(true);
  const [showTerminal, setShowTerminal] = usePersistentState(`hudson.ws.${workspace.id}.terminal`, DEFAULTS.showTerminal);
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);
  const [terminalHeight, setTerminalHeight] = usePersistentState('hudson.termH', DEFAULTS.terminalHeight);

  // --- URL hash sync (deep-link into focused/fullscreen app) ---
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const p = new URLSearchParams(hash);
    const focus = p.get('focus');
    const fs = p.get('fullscreen');
    const allIds = new Set(workspace.apps.map(c => c.app.id));
    if (focus && allIds.has(focus)) setFocusedAppId(focus);
    if (fs && allIds.has(fs)) { setFullscreenAppId(fs); setFocusedAppId(fs); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — mount only

  useEffect(() => {
    const parts: string[] = [];
    if (focusedAppId) parts.push(`focus=${focusedAppId}`);
    if (fullscreenAppId) parts.push(`fullscreen=${fullscreenAppId}`);
    const hash = parts.length > 0 ? `#${parts.join('&')}` : '';
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash || window.location.pathname);
    }
  }, [focusedAppId, fullscreenAppId]);

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
  const HUDSON_AI_ID = '__hudson-ai__';
  const appsWithTerminal = workspace.apps.filter(c => c.app.slots.Terminal);
  // Default to the focused app's terminal if it has one
  const focusedHasTerminal = appsWithTerminal.some(c => c.app.id === focusedAppId);
  const [activeTerminalAppId, setActiveTerminalAppId] = useState(
    focusedHasTerminal ? focusedAppId : HUDSON_AI_ID,
  );
  const activeTerminalApp = appsWithTerminal.find(c => c.app.id === activeTerminalAppId)?.app
    ?? null;

  // Follow focused app — switch terminal tab when focus changes to an app with a terminal,
  // but only if the user is already on an app-specific terminal tab (not AI or Hudson Terminal).
  const activeTermRef = useRef(activeTerminalAppId);
  activeTermRef.current = activeTerminalAppId;
  useEffect(() => {
    if (activeTermRef.current === HUDSON_AI_ID || activeTermRef.current === HUDSON_TERMINAL_ID) return;
    if (appsWithTerminal.some(c => c.app.id === focusedAppId)) {
      setActiveTerminalAppId(focusedAppId);
    }
  }, [focusedAppId, appsWithTerminal]);

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
  const gridOpacity = phaseAtLeast(bootPhase, 'chrome-in') ? (shellSettings.gridOpacity ?? 60) / 100 : 0;

  useEffect(() => {
    setSoundMuted(shellSettings.masterMute);
  }, [shellSettings.masterMute]);

  // Apply font settings as CSS custom properties on :root
  useEffect(() => {
    const font = shellSettings.font ?? DEFAULT_SHELL_SETTINGS.font;
    document.documentElement.style.setProperty('--hudson-font-size', `${font.fontSize}px`);
    document.documentElement.style.setProperty('--hudson-font-family', font.fontFamily);
  }, [shellSettings.font]);

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

  // --- Resize (ref-driven during drag, state flush on mouseup) ---
  const handleResizeStart = useCallback(
    (side: 'left' | 'right') => (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = side === 'left' ? leftWidth : rightWidth;
      const setter = side === 'left' ? setLeftWidth : setRightWidth;
      const direction = side === 'left' ? 1 : -1;
      const attr = side === 'left' ? 'manifest' : 'inspector';
      const panelEl = document.querySelector(`[data-frame-panel="${attr}"]`) as HTMLElement | null;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = (ev.clientX - startX) * direction;
        const newWidth = Math.max(200, Math.min(500, startWidth + delta));
        if (panelEl) panelEl.style.width = `${newWidth}px`;
      };
      const onMouseUp = (ev: MouseEvent) => {
        const delta = (ev.clientX - startX) * direction;
        setter(Math.max(200, Math.min(500, startWidth + delta)));
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

  // --- Auto-layout: tile visible windows in a clean grid, then fit ---
  const handleAutoLayout = useCallback(() => {
    tileWindowBounds(activatedAppIds);
    setWindowResetKey(k => k + 1);
    // Delayed fit-all after windows remount with new positions
    setTimeout(() => handleFitAll(), 100);
    playSound('blipUp');
  }, [activatedAppIds, tileWindowBounds, handleFitAll, playSound]);

  // --- Fullscreen app mode ---
  const enterFullscreen = useCallback((appId: string) => {
    setFullscreenAppId(appId);
    setFocusedAppId(appId);
  }, [setFocusedAppId]);

  const exitFullscreen = useCallback(() => {
    setFullscreenAppId(null);
  }, []);

  // --- Open settings helper (now opens workspace editor on settings tab) ---
  const openSettings = useCallback((tab: 'overview' | 'apps' | 'settings' = 'settings') => {
    setWorkspaceEditorTab(tab);
    setShowWorkspaceManager(true);
  }, []);

  // --- Open workspace manager ---
  const openWorkspaceManager = useCallback(() => {
    setWorkspaceEditorTab('overview');
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
        action: () => openSettings('settings'),
      },
      {
        id: 'shell:workspace-editor',
        label: 'Workspace Editor',
        shortcut: 'Cmd+Shift+,',
        icon: <Settings size={14} />,
        action: () => openWorkspaceManager(),
      },
      {
        id: 'shell:fullscreen-app',
        label: fullscreenAppId ? 'Exit Focus Mode' : 'Focus App',
        shortcut: 'Cmd+Shift+F',
        icon: fullscreenAppId ? <Minimize2 size={14} /> : <Maximize2 size={14} />,
        action: () => {
          if (fullscreenAppId) {
            exitFullscreen();
          } else {
            enterFullscreen(focusedAppId);
          }
        },
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
        id: 'shell:auto-layout',
        label: 'Auto Layout Windows',
        icon: <LayoutGrid size={14} />,
        action: handleAutoLayout,
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
        setWorkspaceEditorTab('overview');
        setShowWorkspaceManager(s => !s);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setWorkspaceEditorTab('settings');
        setShowWorkspaceManager(s => !s);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        if (fullscreenAppId) {
          setFullscreenAppId(null);
        } else {
          setFullscreenAppId(focusedAppId);
        }
        return;
      }
      if (e.key === 'Escape') {
        if (fullscreenAppId) {
          e.preventDefault();
          setFullscreenAppId(null);
          return;
        }
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusedAppId, fullscreenAppId]);

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
          onAutoLayout={handleAutoLayout}
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
      const deps = app.services;
      const serviceDeps = deps?.map(dep => ({
        serviceId: dep.serviceId,
        status: (serviceRegistry.records[dep.serviceId]?.status ?? 'unknown') as ServiceStatus,
      }));
      return (
        <SidebarSection
          key={app.id}
          appName={app.name}
          appIcon={app.leftPanel?.icon ?? app.rightPanel?.icon}
          isFocused={app.id === focusedAppId}
          onFocus={() => setFocusedAppId(app.id)}
          defaultExpanded={app.id === focusedAppId}
          isVisible={activatedAppIds.has(app.id)}
          onToggleVisibility={() => handleToggleAppVisibility(app.id)}
          serviceDeps={serviceDeps}
          onOpenManager={openWorkspaceManager}
        >
          {app.slots.LeftPanel && (
            <AppSlotErrorBoundary appName={app.name} slotName="LeftPanel">
              <app.slots.LeftPanel />
            </AppSlotErrorBoundary>
          )}
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
  const rightHeaderActions = focusedApp?.rightPanel?.headerActions
    ? <focusedApp.rightPanel.headerActions />
    : undefined;

  // --- Workspace AI tool call handler ---
  const { pushPipe, pushDirect, pipes } = useDataBus();
  const handleWorkspaceToolCall = useCallback(async (name: string, args: Record<string, unknown>) => {
    switch (name) {
      case 'push_pipe': {
        const pipeName = args.pipeName as string;
        const pipe = pipes.find(p => p.name === pipeName);
        if (pipe) await pushPipe(pipe.id);
        break;
      }
      case 'fetch_image': {
        const url = args.url as string;
        if (url) {
          try {
            const res = await fetch(`/api/fetch-image?url=${encodeURIComponent(url)}`);
            const data = await res.json();
            if (data.dataUrl) {
              console.log('[WorkspaceAI] fetched image:', data.sourceUrl, data.size, 'bytes');
            }
          } catch (e) { console.error('[WorkspaceAI] fetch error:', e); }
        }
        break;
      }
      // Logo-specific tools are dispatched via a custom event that LogoProvider can listen to
      case 'set_logo_param':
      case 'set_logo_custom_param':
      case 'set_logo_variant':
      case 'create_template':
        window.dispatchEvent(new CustomEvent('hudson:workspace-tool', { detail: { name, args } }));
        break;
      case 'create_pipe': {
        try {
          await fetch('/api/pipes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pipe: {
                name: args.name,
                source: { appId: args.sourceAppId, portId: args.sourcePortId },
                sink: { appId: args.sinkAppId, portId: args.sinkPortId },
                enabled: true,
              },
            }),
          });
        } catch (e) { console.error('[WorkspaceAI] create pipe error:', e); }
        break;
      }
      case 'generate_image': {
        const prompt = args.prompt as string;
        if (!prompt) break;
        try {
          const res = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, aspectRatio: args.aspectRatio }),
          });
          const data = await res.json();
          if (data.image?.dataUrl) {
            console.log('[WorkspaceAI] image generated');
            // Dispatch event so WorkspaceAI can display the result
            window.dispatchEvent(new CustomEvent('hudson:generated-image', {
              detail: { dataUrl: data.image.dataUrl, prompt },
            }));
          } else if (data.error) {
            console.error('[WorkspaceAI] generate error:', data.error);
            window.dispatchEvent(new CustomEvent('hudson:generated-image', {
              detail: { error: data.error, prompt },
            }));
          }
        } catch (e) { console.error('[WorkspaceAI] generate error:', e); }
        break;
      }
    }
  }, [pushPipe, pipes]);

  // --- Terminal screenshot button ---
  const [termSnapping, setTermSnapping] = useState(false);
  const handleTermScreenshot = useCallback(async () => {
    if (termSnapping) return;
    setTermSnapping(true);
    try {
      const blob = await captureWorkspace();
      if (!blob) return;
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const file = new File([blob], `snap-${ts}.jpg`, { type: 'image/jpeg' });
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/relay/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, data: base64 }),
      });
      const { path } = (await res.json()) as { path: string };
      if (path) navigator.clipboard.writeText(path);
    } finally {
      setTermSnapping(false);
    }
  }, [termSnapping]);

  const terminalHeaderActions = (
    <button
      type="button"
      onClick={handleTermScreenshot}
      disabled={termSnapping}
      className="p-1 rounded text-neutral-500 hover:text-cyan-400 disabled:opacity-30 transition-colors"
      title="Capture screenshot — copies file path to clipboard"
    >
      {termSnapping ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
    </button>
  );

  // --- Terminal content ---
  const hudsonTerminalNode = <HudsonTerminal workspace={workspace} catalog={catalog} />;
  const workspaceAINode = <WorkspaceAI workspace={workspace} onToolCall={handleWorkspaceToolCall} />;

  const terminalContent = (() => {
    // No app terminals — show AI + Terminal tabs
    if (appsWithTerminal.length === 0) {
      return (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="shrink-0 flex items-center border-b border-neutral-700/50 min-w-0">
            <button
              onClick={() => setActiveTerminalAppId(HUDSON_AI_ID)}
              className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                activeTerminalAppId === HUDSON_AI_ID
                  ? 'text-cyan-400 border-b border-cyan-400 bg-cyan-500/5'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.02]'
              }`}
            >
              <Sparkles size={10} />
              AI
            </button>
            <button
              onClick={() => setActiveTerminalAppId(HUDSON_TERMINAL_ID)}
              className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${
                activeTerminalAppId === HUDSON_TERMINAL_ID
                  ? 'text-cyan-400 border-b border-cyan-400 bg-cyan-500/5'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.02]'
              }`}
            >
              Terminal
            </button>
          </div>
          <div className="flex-1 overflow-hidden min-w-0">
            {activeTerminalAppId === HUDSON_AI_ID ? workspaceAINode : hudsonTerminalNode}
          </div>
        </div>
      );
    }

    // Has app terminals — AI first, then Hudson, then app terminals
    const activeApps = sortedTerminalApps.filter(c => activatedAppIds.has(c.app.id));
    const inactiveApps = sortedTerminalApps.filter(c => !activatedAppIds.has(c.app.id));

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="shrink-0 flex items-center border-b border-neutral-700/50 min-w-0">
          {/* AI tab — primary */}
          <button
            onClick={() => setActiveTerminalAppId(HUDSON_AI_ID)}
            className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
              activeTerminalAppId === HUDSON_AI_ID
                ? 'text-cyan-400 border-b border-cyan-400 bg-cyan-500/5'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.02]'
            }`}
          >
            <Sparkles size={10} />
            AI
          </button>
          {/* Hudson terminal tab */}
          <button
            onClick={() => setActiveTerminalAppId(HUDSON_TERMINAL_ID)}
            className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${
              activeTerminalAppId === HUDSON_TERMINAL_ID
                ? 'text-cyan-400 border-b border-cyan-400 bg-cyan-500/5'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.02]'
            }`}
          >
            Terminal
          </button>
          {/* Separator between system and app tabs */}
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
          {activeTerminalAppId === HUDSON_AI_ID ? (
            workspaceAINode
          ) : activeTerminalAppId === HUDSON_TERMINAL_ID ? (
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
          zOrderMap={zOrderMap}
          appHooksMap={Object.fromEntries(allAppHooks.map(h => [h.appId, h]))}
          onEnterFullscreen={enterFullscreen}
          windowBoundsMap={windowBoundsMap}
        />
      )}
    </div>
  );

  // --- Reset layout: re-tile all windows and force remount ---
  const handleResetLayout = useCallback(() => {
    tileWindowBounds(activatedAppIds);
    setWindowResetKey(k => k + 1);
    // Delayed fit-all after windows remount
    setTimeout(() => handleFitAll(), 300);
  }, [activatedAppIds, tileWindowBounds, handleFitAll]);

  // --- Workspace Manager context value ---
  const wmData = useMemo(() => ({
    workspace: fullWorkspace,
    workspaces,
    activatedAppIds,
    disabledAppIds,
    appOrder: normalizedAppOrder,
    focusedAppId,
    onToggleAppVisibility: handleToggleAppVisibility,
    onToggleAppDisabled: handleToggleAppDisabled,
    onReorderApps: handleReorderApps,
    onFocusApp: setFocusedAppId,
    serviceRegistry,
    appSettings,
    windowBoundsMap,
    onResetLayout: handleResetLayout,
    onFitAll: handleFitAll,
    shellSettings,
    onUpdateShellSettings: updateShellSettings,
    onResetShellSettings: resetShellSettings,
  }), [fullWorkspace, workspaces, activatedAppIds, disabledAppIds, normalizedAppOrder, focusedAppId, handleToggleAppVisibility, handleToggleAppDisabled, handleReorderApps, serviceRegistry, appSettings, windowBoundsMap, handleResetLayout, handleFitAll, shellSettings, updateShellSettings, resetShellSettings]);

  // --- Fullscreen app config ---
  const fullscreenConfig = fullscreenAppId
    ? fullWorkspace.apps.find(c => c.app.id === fullscreenAppId)
    : null;

  return (
    <ServiceRegistryProvider value={serviceRegistry}>
    <WorkspaceManagerProvider value={wmData}>
    <ShellLayoutProvider value={shellLayout}>
      {/* Fullscreen app mode — escapes the canvas entirely */}
      {fullscreenConfig ? (
        <div className="h-screen flex flex-col" style={{ background: 'rgb(10, 10, 10)' }}>
          {/* Header bar */}
          <div className="h-10 shrink-0 flex items-center px-3 gap-2 border-b border-neutral-700/50"
            style={{ background: 'rgba(14, 14, 14, 0.97)', backdropFilter: 'blur(20px)' }}>
            {/* Left: back button + panel toggle */}
            <button
              onClick={exitFullscreen}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Back to canvas (Esc)"
            >
              <Minimize2 size={11} />
              Canvas
            </button>
            {fullscreenConfig.app.slots.LeftPanel && (
              <button
                onClick={() => setFsLeftOpen(v => !v)}
                className="p-1 rounded text-neutral-500 hover:text-white hover:bg-white/[0.06] transition-colors"
                title={fsLeftOpen ? 'Hide left panel' : 'Show left panel'}
              >
                {fsLeftOpen ? <PanelLeftClose size={13} /> : <PanelLeftOpen size={13} />}
              </button>
            )}
            <div className="h-4 w-px bg-neutral-700/40" />

            {/* Center: app name + template */}
            <div className="flex-1 flex items-center justify-center gap-2 min-w-0 overflow-hidden">
              {fullscreenConfig.app.leftPanel?.icon && <span className="text-neutral-500 shrink-0">{fullscreenConfig.app.leftPanel.icon}</span>}
              <span className="text-[12px] font-mono font-bold text-white tracking-wider shrink-0">{fullscreenConfig.app.name}</span>
              {(() => {
                const h = allAppHooksRaw.find(h => h.appId === fullscreenAppId);
                return h ? (
                  <span className={`text-[9px] font-mono uppercase tracking-wider text-${h.status.color}-500 truncate`}>
                    {h.status.label}
                  </span>
                ) : null;
              })()}
            </div>

            <div className="h-4 w-px bg-neutral-700/40" />
            {/* Right: panel toggle + settings */}
            <button
              onClick={() => openSettings()}
              className="p-1 rounded text-neutral-500 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Settings (⌘,)"
            >
              <Settings size={12} />
            </button>
            {(fullscreenConfig.app.slots.Inspector || fullscreenConfig.app.tools?.length) && (
              <button
                onClick={() => setFsRightOpen(v => !v)}
                className="p-1 rounded text-neutral-500 hover:text-white hover:bg-white/[0.06] transition-colors"
                title={fsRightOpen ? 'Hide inspector' : 'Show inspector'}
              >
                {fsRightOpen ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}
              </button>
            )}
          </div>

          {/* Body: left panel + content + right panel */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Left panel */}
            {fullscreenConfig.app.slots.LeftPanel && fsLeftOpen && (
              <div className="w-[240px] shrink-0 border-r border-neutral-700/40 overflow-y-auto frame-scrollbar bg-neutral-950/80">
                <AppSlotErrorBoundary appName={fullscreenConfig.app.name} slotName="LeftPanel">
                  <fullscreenConfig.app.slots.LeftPanel />
                </AppSlotErrorBoundary>
              </div>
            )}

            {/* Main content */}
            <div className="flex-1 overflow-hidden relative min-w-0">
              <AppSlotErrorBoundary appName={fullscreenConfig.app.name} slotName="Content">
                <fullscreenConfig.app.slots.Content />
              </AppSlotErrorBoundary>
            </div>

            {/* Right panel: Inspector + tools */}
            {(fullscreenConfig.app.slots.Inspector || fullscreenConfig.app.tools?.length) && fsRightOpen && (
              <div className="w-[260px] shrink-0 border-l border-neutral-700/40 overflow-y-auto frame-scrollbar bg-neutral-950/80">
                {fullscreenConfig.app.slots.Inspector && (
                  <AppSlotErrorBoundary appName={fullscreenConfig.app.name} slotName="Inspector">
                    <fullscreenConfig.app.slots.Inspector />
                  </AppSlotErrorBoundary>
                )}
                {fullscreenConfig.app.tools && fullscreenConfig.app.tools.length > 0 && (
                  <ToolAccordion
                    tools={fullscreenConfig.app.tools}
                    expandedToolId={expandedToolId}
                    onToggle={handleToggleTool}
                  />
                )}
              </div>
            )}
          </div>

          {/* Status bar */}
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
              </div>
            }
          />

          {/* Terminal drawer */}
          <div
            className="pointer-events-none"
            style={{
              position: 'fixed',
              left: fsLeftOpen && fullscreenConfig.app.slots.LeftPanel ? 240 : 0,
              right: fsRightOpen && (fullscreenConfig.app.slots.Inspector || fullscreenConfig.app.tools?.length) ? 260 : 0,
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
              headerActions={terminalHeaderActions}
            >
              {terminalContent}
            </TerminalDrawer>
          </div>
        </div>
      ) : (
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
                center={isSingleApp ? focused.navCenter : undefined}
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
                headerActions={rightHeaderActions}
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

            {/* Workspace Editor (unified settings + workspace manager) */}
            <WorkspaceManagerPanel
              isOpen={showWorkspaceManager}
              onClose={() => setShowWorkspaceManager(false)}
              defaultTab={workspaceEditorTab}
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
      )}
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
  zOrderMap,
  appHooksMap,
  onEnterFullscreen,
  windowBoundsMap,
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
  zOrderMap: Record<string, number>;
  appHooksMap: Record<string, AppHookData>;
  onEnterFullscreen: (appId: string) => void;
  windowBoundsMap: Record<string, { x: number; y: number; w: number; h: number }>;
}) {
  // Separate native vs windowed apps — filter by activated when launcher is open
  const nativeApps = workspace.apps.filter(c => (c.canvasMode ?? 'native') === 'native');
  const windowedApps = workspace.apps.filter(c => c.canvasMode === 'windowed');

  // Filter to only show activated (visible) apps
  const visibleNative = nativeApps.filter(c => activatedAppIds.has(c.app.id));
  const visibleWindowed = windowedApps.filter(c => activatedAppIds.has(c.app.id));

  // Pipes from DataBus
  const { pipes } = useDataBus();

  return (
    <>
      {/* Pipe connection arrows between apps */}
      <PipeConnectorLayer pipes={pipes} windowBoundsMap={windowBoundsMap} />
      {/* Native apps render directly on canvas */}
      <AnimatePresence>
        {visibleNative.map(config => (
          <motion.div
            key={config.app.id}
            data-native-app={config.app.name}
            onClick={() => onFocusApp(config.app.id)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ zIndex: zOrderMap[config.app.id] ?? 1, position: 'relative' }}
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
              navCenter={appHooksMap[config.app.id]?.navCenter ?? null}
              onEnterFullscreen={() => onEnterFullscreen(config.app.id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Dynamic windows (spawned terminals, etc.) */}
      <AnimatePresence>
        {dynamicWindows.map(dw => (
          <motion.div
            key={dw.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ zIndex: zOrderMap[dw.id] ?? 1, position: 'relative' }}
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
  navCenter,
  onEnterFullscreen,
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
  navCenter: ReactNode | null;
  onEnterFullscreen: () => void;
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

  // Port activity slide-down (auto-available for apps with ports)
  const hasPorts = !!(config.app.ports?.outputs?.length || config.app.ports?.inputs?.length);
  const [showPortLog, setShowPortLog] = useState(false);

  const contextMenuItems: ContextMenuEntry[] = useMemo(() => [
    {
      id: `${config.app.id}:focus-mode`,
      label: 'Focus Mode',
      shortcut: '⌘⇧F',
      icon: <Maximize2 size={12} />,
      action: onEnterFullscreen,
    },
    {
      id: `${config.app.id}:bring-to-front`,
      label: 'Bring to Front',
      icon: <Layers size={12} />,
      action: onFocus,
    },
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
    ...(hasPorts ? [{
      id: `${config.app.id}:port-activity`,
      label: showPortLog ? 'Hide Port Activity' : 'Show Port Activity',
      icon: <Activity size={12} />,
      action: () => setShowPortLog(v => !v),
    }] : []),
    { type: 'separator' },
    {
      id: `${config.app.id}:close`,
      label: 'Close',
      shortcut: '⌘W',
      icon: <X size={12} />,
      action: onClose,
    },
  ], [config.app.id, isMaximized, setBounds, handleToggleMaximize, handleResetWindow, onResetView, onClose, onFocus, onEnterFullscreen]);

  return (
    <>
      <AppWindow
        title={config.app.name}
        titleCenter={navCenter}
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

      {/* Port activity — slides down below the window, positioned absolutely */}
      {hasPorts && (
        <div
          className="absolute pointer-events-auto rounded-b-lg border border-t-0 border-white/[0.06] bg-neutral-950/90 backdrop-blur-xl overflow-hidden"
          style={{
            left: bounds.x,
            top: bounds.y + bounds.h,
            width: bounds.w,
          }}
        >
          <PortActivityLog appId={config.app.id} />
        </div>
      )}
    </>
  );
}
