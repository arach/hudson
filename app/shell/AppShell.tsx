'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Frame,
  Minimap,
  NavigationBar,
  SidePanel,
  StatusBar,
  CommandPalette,
  CommandDock,
  TerminalDrawer,
  usePersistentState,
  sounds,
  setMuted as setSoundMuted,
} from 'frame-ui';
import type { HudsonApp, CommandOption } from 'frame-ui';
import {
  Volume2,
  VolumeX,
  Settings,
} from 'lucide-react';
import { AppSwitcher } from './AppSwitcher';
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
// AppShell — outer wrapper that creates Provider, then delegates to Inner
// ---------------------------------------------------------------------------
interface AppShellProps {
  apps: HudsonApp[];
  defaultAppId: string;
}

export function AppShell({ apps, defaultAppId }: AppShellProps) {
  const [activeAppId, setActiveAppId] = useState(defaultAppId);
  const activeApp = apps.find(a => a.id === activeAppId) ?? apps[0];

  return (
    <activeApp.Provider>
      <AppShellInner
        app={activeApp}
        apps={apps}
        activeAppId={activeAppId}
        onSwitchApp={setActiveAppId}
      />
    </activeApp.Provider>
  );
}

// ---------------------------------------------------------------------------
// AppShellInner — renders inside Provider, can call app hooks directly
// ---------------------------------------------------------------------------
function AppShellInner({ app, apps, activeAppId, onSwitchApp }: {
  app: HudsonApp;
  apps: HudsonApp[];
  activeAppId: string;
  onSwitchApp: (id: string) => void;
}) {
  // Call app hooks directly — we're inside Provider
  const appCommands = app.hooks.useCommands();
  const appStatus = app.hooks.useStatus();
  const appSearch = app.hooks.useSearch?.() ?? null;
  const appNavCenter = app.hooks.useNavCenter?.() ?? null;
  const appNavActions = app.hooks.useNavActions?.() ?? null;
  const frameMode = app.hooks.useFrameMode?.() ?? app.mode;
  const isCanvasMode = frameMode === 'canvas';

  // Shell state
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

  // Settings (shared with docs app via same localStorage key)
  const [shellSettings, setShellSettings] = usePersistentState<HudsonSettings>('hudson.settings', DEFAULT_SHELL_SETTINGS);
  const muted = shellSettings.masterMute;

  useEffect(() => { setSoundMuted(shellSettings.masterMute); }, [shellSettings.masterMute]);

  const updateShellSettings = useCallback((patch: Partial<HudsonSettings>) => {
    setShellSettings(prev => ({ ...prev, ...patch }));
  }, [setShellSettings]);

  const resetShellSettings = useCallback(() => {
    setShellSettings(DEFAULT_SHELL_SETTINGS);
  }, [setShellSettings]);

  // Sound helper
  const playSound = useCallback((name: string) => {
    if (shellSettings.masterMute) return;
    const isTransition = name === 'slideIn' || name === 'slideOut' || name === 'whoosh' || name === 'boot';
    if (isTransition && !shellSettings.uiTransitionSounds) return;
    if (!isTransition && !shellSettings.uiClickSounds) return;
    (sounds as Record<string, () => void>)[name]?.();
  }, [shellSettings.masterMute, shellSettings.uiClickSounds, shellSettings.uiTransitionSounds]);

  // Pan/zoom
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

  // Resize
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
  const shellCommands: CommandOption[] = useMemo(() => [
    { id: 'shell:settings', label: 'Settings', shortcut: 'Cmd+,', icon: <Settings size={14} />, action: () => { setShowSettings(true); } },
    { id: 'shell:toggle-left', label: 'Toggle Left Panel', shortcut: 'Cmd+[', action: () => { setLeftCollapsed(c => !c); playSound('thock'); } },
    { id: 'shell:toggle-right', label: 'Toggle Right Panel', shortcut: 'Cmd+]', action: () => { setRightCollapsed(c => !c); playSound('thock'); } },
    { id: 'shell:toggle-terminal', label: 'Toggle Terminal', shortcut: 'Ctrl+`', action: () => { setShowTerminal(t => !t); playSound('slideIn'); } },
    { id: 'shell:toggle-guides', label: showGuides ? 'Hide Crosshair Guides' : 'Show Crosshair Guides', shortcut: 'Cmd+\\', action: () => { setShowGuides(g => !g); } },
    { id: 'shell:toggle-minimap', label: minimapCollapsed ? 'Show Minimap' : 'Hide Minimap', action: () => { setMinimapCollapsed(c => !c); playSound('thock'); } },
    { id: 'shell:reset-view', label: 'Reset View', shortcut: 'Cmd+0', action: () => { setPanOffset({ x: 0, y: 0 }); setScale(1); playSound('blipUp'); } },
    { id: 'shell:toggle-mute', label: muted ? 'Unmute Sounds' : 'Mute Sounds', shortcut: 'Cmd+M', action: handleToggleMute },
    ...apps.filter(a => a.id !== activeAppId).map(a => ({
      id: `switch:${a.id}`,
      label: `Switch to ${a.name}`,
      action: () => onSwitchApp(a.id),
    })),
  ], [showGuides, minimapCollapsed, muted, handleToggleMute, apps, activeAppId, onSwitchApp, playSound, setLeftCollapsed, setRightCollapsed, setMinimapCollapsed, setShowTerminal, setShowSettings]);

  // Merge shell + app commands
  const allCommands = useMemo(() => [
    ...appCommands,
    ...shellCommands,
  ], [appCommands, shellCommands]);

  // Keyboard shortcuts
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

  // Shell layout context value for apps
  const shellLayout = useMemo(() => ({
    leftWidth: leftCollapsed ? 0 : leftWidth,
    rightWidth: rightCollapsed ? 0 : rightWidth,
    leftCollapsed,
    rightCollapsed,
    isTerminalOpen: showTerminal,
    terminalHeight,
    isTerminalMaximized,
  }), [leftWidth, rightWidth, leftCollapsed, rightCollapsed, showTerminal, terminalHeight, isTerminalMaximized]);

  // Left panel footer: LeftFooter slot + CommandDock + Minimap (shell chrome)
  const leftFooter = (
    <>
      {app.slots.LeftFooter && <app.slots.LeftFooter />}
      <CommandDock
        onOpenCommandPalette={() => { setShowCommandPalette(true); playSound('pop'); }}
      />
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
            subtitle={<AppSwitcher apps={apps} activeId={activeAppId} onSwitch={onSwitchApp} />}
            search={appSearch ?? undefined}
            center={appNavCenter}
            actions={
              <>
                {appNavActions}
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
            title={app.leftPanel?.title ?? 'Navigation'}
            icon={app.leftPanel?.icon}
            isCollapsed={leftCollapsed}
            onToggleCollapse={() => { setLeftCollapsed(!leftCollapsed); playSound('thock'); }}
            width={leftWidth}
            onResizeStart={handleResizeStart('left')}
            footer={leftFooter}
            headerActions={app.leftPanel?.headerActions && <app.leftPanel.headerActions />}
          >
            {app.slots.LeftPanel && <app.slots.LeftPanel />}
          </SidePanel>

          <SidePanel
            side="right"
            title={app.rightPanel?.title ?? 'Inspector'}
            icon={app.rightPanel?.icon}
            isCollapsed={rightCollapsed}
            onToggleCollapse={() => { setRightCollapsed(!rightCollapsed); playSound('thock'); }}
            width={rightWidth}
            onResizeStart={handleResizeStart('right')}
          >
            {app.slots.RightPanel && <app.slots.RightPanel />}
          </SidePanel>

          <StatusBar
            status={appStatus}
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
              {app.slots.Terminal ? (
                <app.slots.Terminal />
              ) : (
                <div className="p-4 font-mono text-[12px] space-y-3 overflow-y-auto frame-scrollbar">
                  <div className="text-neutral-300 uppercase tracking-widest text-[10px] mb-2">Keyboard Shortcuts</div>
                  <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                    {[
                      ['Space + Drag', 'Pan canvas'],
                      ['Cmd + Scroll', 'Zoom in / out'],
                      ['Cmd + 0', 'Reset view'],
                      ['Cmd + 1 / 2 / 3', 'Canvas / List / Tiles view'],
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
              )}
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
      <div data-hudson-world>
        <app.slots.Content />
      </div>
    </Frame>
    </ShellLayoutProvider>
  );
}
