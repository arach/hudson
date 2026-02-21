'use client';

import { useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
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
  usePersistentState,
  sounds,
  setMuted as setSoundMuted,
} from 'frame-ui';
import type { HudsonWorkspace, WorkspaceAppConfig, CommandOption, StatusColor, SearchConfig } from 'frame-ui';
import { Volume2, VolumeX, Settings } from 'lucide-react';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { SidebarSection } from './SidebarSection';
import { ShellLayoutProvider } from './ShellLayoutContext';
import { SettingsPanel } from '../apps/hudson-docs/components';
import type { HudsonSettings } from '../apps/hudson-docs/types';

// ---------------------------------------------------------------------------
// Default settings
// ---------------------------------------------------------------------------
const DEFAULT_SHELL_SETTINGS: HudsonSettings = {
  glowIntensity: 30,
  connectorStyle: 'dashed',
  zoomSensitivity: 1.0,
  masterMute: false,
  uiClickSounds: true,
  uiTransitionSounds: true,
};

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
}

export function WorkspaceShell({ workspaces, defaultWorkspaceId }: WorkspaceShellProps) {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(defaultWorkspaceId);
  const workspace = workspaces.find(w => w.id === activeWorkspaceId) ?? workspaces[0];

  // Nest all app Providers recursively
  let tree: ReactNode = (
    <WorkspaceInner
      key={workspace.id}
      workspace={workspace}
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspaceId}
      onSwitchWorkspace={setActiveWorkspaceId}
    />
  );

  for (let i = workspace.apps.length - 1; i >= 0; i--) {
    const { app } = workspace.apps[i];
    tree = <app.Provider>{tree}</app.Provider>;
  }

  // Key on workspace.id to force clean remount on switch
  return <div key={workspace.id}>{tree}</div>;
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
  frameMode: 'canvas' | 'panel';
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
    frameMode: app.hooks.useFrameMode?.() ?? app.mode,
  };
}

// ---------------------------------------------------------------------------
// WorkspaceInner — renders inside all Providers, can call all app hooks
// ---------------------------------------------------------------------------
function WorkspaceInner({
  workspace,
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
}: {
  workspace: HudsonWorkspace;
  workspaces: HudsonWorkspace[];
  activeWorkspaceId: string;
  onSwitchWorkspace: (id: string) => void;
}) {
  const isSingleApp = workspace.apps.length === 1;
  const isMultiApp = !isSingleApp;

  // --- Hook merging ---
  // Safe: workspace.apps is static per workspace, component keyed by workspace.id
  const allAppHooks: AppHookData[] = workspace.apps.map(config => useAppHooks(config));

  // --- Focus state ---
  const [focusedAppId, setFocusedAppId] = useState(
    workspace.defaultFocusedAppId ?? workspace.apps[0]?.app.id ?? '',
  );
  const focusedIdx = allAppHooks.findIndex(h => h.appId === focusedAppId);
  const focused = allAppHooks[focusedIdx >= 0 ? focusedIdx : 0];

  // --- Mode resolution ---
  const frameMode = isSingleApp ? focused.frameMode : workspace.mode;
  const isCanvasMode = frameMode === 'canvas';

  // --- Shell state (same as AppShell) ---
  const [leftCollapsed, setLeftCollapsed] = usePersistentState('hudson.left', false);
  const [rightCollapsed, setRightCollapsed] = usePersistentState('hudson.right', false);
  const [leftWidth, setLeftWidth] = usePersistentState('hudson.leftW', 260);
  const [rightWidth, setRightWidth] = usePersistentState('hudson.rightW', 280);

  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);
  const [terminalHeight, setTerminalHeight] = usePersistentState('hudson.termH', 320);

  const [minimapCollapsed, setMinimapCollapsed] = usePersistentState('hudson.minimap', false);
  const [showGuides, setShowGuides] = useState(false);

  // --- Terminal tab state (multi-app only) ---
  const appsWithTerminal = workspace.apps.filter(c => c.app.slots.Terminal);
  const hasMultipleTerminals = appsWithTerminal.length > 1;
  const [activeTerminalAppId, setActiveTerminalAppId] = useState(
    appsWithTerminal[0]?.app.id ?? '',
  );
  const activeTerminalApp = appsWithTerminal.find(c => c.app.id === activeTerminalAppId)?.app
    ?? appsWithTerminal[0]?.app;

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
    setPanOffset({ x: 0, y: 0 });
    setScale(1);
    playSound('blipUp');
  }, [playSound]);

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

  // --- Shell commands ---
  const shellCommands: CommandOption[] = useMemo(
    () => [
      {
        id: 'shell:settings',
        label: 'Settings',
        shortcut: 'Cmd+,',
        icon: <Settings size={14} />,
        action: () => setShowSettings(true),
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
        id: 'shell:toggle-mute',
        label: muted ? 'Unmute Sounds' : 'Mute Sounds',
        shortcut: 'Cmd+M',
        action: handleToggleMute,
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
      workspaces,
      activeWorkspaceId,
      onSwitchWorkspace,
      playSound,
      setLeftCollapsed,
      setRightCollapsed,
      setMinimapCollapsed,
      setShowTerminal,
      setShowSettings,
    ],
  );

  // --- Merge all commands ---
  const allCommands = useMemo(() => {
    const merged: CommandOption[] = [...shellCommands];
    for (const hookData of allAppHooks) {
      merged.push(...hookData.commands);
    }
    return merged;
  }, [shellCommands, allAppHooks]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
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
      {isSingleApp && singleApp?.slots.LeftFooter && <singleApp.slots.LeftFooter />}
      <CommandDock onOpenCommandPalette={() => { setShowCommandPalette(true); playSound('pop'); }} />
      {isCanvasMode && (
        <Minimap
          pan={panOffset}
          zoom={scale}
          viewportSize={viewport}
          isCollapsed={minimapCollapsed}
          onToggleCollapse={() => { setMinimapCollapsed(c => !c); playSound('thock'); }}
          onNavigate={handleMinimapNavigate}
          onFitAll={handleFitAll}
        />
      )}
    </>
  );

  // --- Left/Right sidebar content ---
  const leftPanelContent = isSingleApp ? (
    singleApp?.slots.LeftPanel && <singleApp.slots.LeftPanel />
  ) : (
    workspace.apps.map(config => {
      const { app } = config;
      if (!app.slots.LeftPanel) return null;
      return (
        <SidebarSection
          key={app.id}
          appName={app.name}
          appIcon={app.leftPanel?.icon}
          isFocused={app.id === focusedAppId}
          onFocus={() => setFocusedAppId(app.id)}
          defaultExpanded={app.id === focusedAppId}
        >
          <app.slots.LeftPanel />
        </SidebarSection>
      );
    })
  );

  const rightPanelContent = isSingleApp ? (
    singleApp?.slots.RightPanel && <singleApp.slots.RightPanel />
  ) : (
    workspace.apps.map(config => {
      const { app } = config;
      if (!app.slots.RightPanel) return null;
      return (
        <SidebarSection
          key={app.id}
          appName={app.name}
          appIcon={app.rightPanel?.icon}
          isFocused={app.id === focusedAppId}
          onFocus={() => setFocusedAppId(app.id)}
          defaultExpanded={app.id === focusedAppId}
        >
          <app.slots.RightPanel />
        </SidebarSection>
      );
    })
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
  const terminalContent = (() => {
    if (appsWithTerminal.length === 0) {
      // Default keyboard shortcuts display
      return (
        <div className="p-4 font-mono text-[12px] space-y-3 overflow-y-auto frame-scrollbar">
          <div className="text-neutral-300 uppercase tracking-widest text-[10px] mb-2">Keyboard Shortcuts</div>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            {[
              ['Space + Drag', 'Pan canvas'],
              ['Cmd + Scroll', 'Zoom in / out'],
              ['Cmd + 0', 'Reset view'],
              ['Cmd + K', 'Command palette'],
              ['Cmd + [', 'Toggle left panel'],
              ['Cmd + ]', 'Toggle right panel'],
              ['Cmd + \\', 'Toggle crosshair guides'],
              ['Ctrl + `', 'Toggle terminal'],
              ['Cmd + M', 'Toggle mute'],
            ].map(([key, desc]) => (
              <div key={key} className="contents">
                <div className="text-emerald-400 whitespace-nowrap">{key}</div>
                <div className="text-neutral-300">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (!hasMultipleTerminals) {
      // Single terminal — render directly
      const TermSlot = appsWithTerminal[0].app.slots.Terminal!;
      return <TermSlot />;
    }

    // Multiple terminals — tab bar
    return (
      <div className="flex flex-col h-full">
        <div className="shrink-0 flex border-b border-neutral-700/50">
          {appsWithTerminal.map(config => (
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
        </div>
        <div className="flex-1 overflow-hidden">
          {activeTerminalApp?.slots.Terminal && <activeTerminalApp.slots.Terminal />}
        </div>
      </div>
    );
  })();

  // --- World content ---
  const SingleContent = singleApp?.slots.Content ?? null;
  const worldContent = (
    <div data-hudson-world>
      {isSingleApp && SingleContent ? (
        <SingleContent />
      ) : (
        <MultiAppCanvas
          workspace={workspace}
          focusedAppId={focusedAppId}
          onFocusApp={setFocusedAppId}
          worldScale={scale}
        />
      )}
    </div>
  );

  return (
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
        {...(isCanvasMode ? { canvasProps: { showGuides, onGuidesChange: setShowGuides } } : {})}
        hud={
          <>
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

            <SidePanel
              side="right"
              title={rightPanelTitle}
              icon={rightPanelIcon}
              isCollapsed={rightCollapsed}
              onToggleCollapse={() => { setRightCollapsed(!rightCollapsed); playSound('thock'); }}
              width={rightWidth}
              onResizeStart={handleResizeStart('right')}
            >
              {rightPanelContent}
            </SidePanel>

            <StatusBar
              status={focused.status}
              viewport={{
                pan: panOffset,
                zoom: scale,
                canvasSize: { w: viewport.width, h: viewport.height },
              }}
              onToggleTerminal={() => { setShowTerminal(t => !t); playSound('slideIn'); }}
              isTerminalOpen={showTerminal}
            />

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

            {/* Command palette */}
            <CommandPalette
              isOpen={showCommandPalette}
              onClose={() => setShowCommandPalette(false)}
              commands={allCommands}
            />
          </>
        }
      >
        {worldContent}
      </Frame>
    </ShellLayoutProvider>
  );
}

// ---------------------------------------------------------------------------
// MultiAppCanvas — renders native + windowed apps together
// ---------------------------------------------------------------------------
function MultiAppCanvas({
  workspace,
  focusedAppId,
  onFocusApp,
  worldScale,
}: {
  workspace: HudsonWorkspace;
  focusedAppId: string;
  onFocusApp: (id: string) => void;
  worldScale: number;
}) {
  // Separate native vs windowed apps
  const nativeApps = workspace.apps.filter(c => (c.canvasMode ?? 'native') === 'native');
  const windowedApps = workspace.apps.filter(c => c.canvasMode === 'windowed');

  return (
    <>
      {/* Native apps render directly on canvas */}
      {nativeApps.map(config => (
        <div key={config.app.id} data-native-app={config.app.name} onClick={() => onFocusApp(config.app.id)}>
          <config.app.slots.Content />
        </div>
      ))}

      {/* Windowed apps render inside AppWindow */}
      {windowedApps.map(config => (
        <WindowedApp
          key={config.app.id}
          config={config}
          workspaceId={workspace.id}
          isFocused={config.app.id === focusedAppId}
          onFocus={() => onFocusApp(config.app.id)}
          worldScale={worldScale}
        />
      ))}
    </>
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
  worldScale,
}: {
  config: WorkspaceAppConfig;
  workspaceId: string;
  isFocused: boolean;
  onFocus: () => void;
  worldScale: number;
}) {
  const defaults = config.defaultWindowBounds ?? { x: 100, y: 100, w: 800, h: 600 };
  const [bounds, setBounds] = useWindowBounds(workspaceId, config.app.id, defaults);

  return (
    <AppWindow
      title={config.app.name}
      bounds={bounds}
      onBoundsChange={setBounds}
      isFocused={isFocused}
      onFocus={onFocus}
      worldScale={worldScale}
    >
      <config.app.slots.Content />
    </AppWindow>
  );
}
