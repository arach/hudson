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
  toggleMute,
  isMuted,
} from 'frame-ui';
import type { CommandOption } from 'frame-ui';
import {
  Layers,
  Settings,
  FileText,
  Box,
  Volume2,
  VolumeX,
  Palette,
  Grid3X3,
  LayoutDashboard,
  Compass,
  ScanSearch,
  FrameIcon,
  PanelLeft,
  PanelBottom,
  PanelTop,
  Search,
  TerminalSquare,
  Move,
  Map,
  X,
  type LucideIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Component catalog with rich documentation
// ---------------------------------------------------------------------------
interface ComponentEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  desc: string;
  overview: string;
  props: { name: string; type: string; desc: string }[];
  usage: string;
  notes?: string[];
  // Position offset from center for tiling (in world px)
  position: { x: number; y: number };
}

const COMPONENTS: ComponentEntry[] = [
  {
    id: 'frame', label: 'Frame', icon: FrameIcon,
    desc: 'Layout container with 3-layer architecture',
    overview: 'The root shell that orchestrates three rendering layers: Canvas (background pan/zoom grid), World Content (scaled children), and HUD Chrome (fixed viewport overlays). Supports both canvas mode with full pan/zoom and a static panel mode for layout-only apps.',
    props: [
      { name: 'mode', type: "'canvas' | 'panel'", desc: 'Canvas enables pan/zoom; panel renders scrollable content' },
      { name: 'panOffset', type: '{ x, y }', desc: 'Current pan position in world coordinates' },
      { name: 'scale', type: 'number', desc: 'Zoom level (0.2–3.0)' },
      { name: 'hud', type: 'ReactNode', desc: 'Chrome UI rendered in the fixed viewport layer' },
      { name: 'canvasProps', type: 'CanvasConfig', desc: 'Forward crosshair guide settings to Canvas' },
      { name: 'children', type: 'ReactNode', desc: 'World-space content that scales with pan/zoom' },
    ],
    usage: '<Frame mode="canvas" panOffset={pan} scale={zoom} hud={<>...</>}>\n  {worldContent}\n</Frame>',
    notes: ['Pan/zoom props are optional — defaults to origin at 1x', 'Wheel zoom targets cursor position'],
    position: { x: -380, y: -320 },
  },
  {
    id: 'navigation-bar', label: 'NavigationBar', icon: PanelTop,
    desc: 'Top bar with branding, search, actions',
    overview: 'Fixed top chrome bar with left-aligned branding (title + subtitle), optional center slot, and right-aligned actions area with an integrated search field. The search field supports filtering with a clear button.',
    props: [
      { name: 'title', type: 'string', desc: 'App name displayed in bold tracking' },
      { name: 'subtitle', type: 'ReactNode', desc: 'Version or context label' },
      { name: 'search', type: '{ value, onChange, placeholder }', desc: 'Integrated filter/search field' },
      { name: 'actions', type: 'ReactNode', desc: 'Buttons rendered before the search field' },
      { name: 'center', type: 'ReactNode', desc: 'Optional center content slot' },
    ],
    usage: '<NavigationBar\n  title="MYAPP"\n  subtitle="v1.0"\n  search={{ value, onChange }}\n  actions={<MuteButton />}\n/>',
    position: { x: 380, y: -320 },
  },
  {
    id: 'side-panel', label: 'SidePanel', icon: PanelLeft,
    desc: 'Collapsible left/right panels with resize',
    overview: 'Docked side panel with a header (icon + title + collapse button), scrollable content area, and a pinned footer slot. Supports drag-to-resize via an edge handle. Returns null when collapsed.',
    props: [
      { name: 'side', type: "'left' | 'right'", desc: 'Which edge to dock to' },
      { name: 'title', type: 'string', desc: 'Header label' },
      { name: 'icon', type: 'ReactNode', desc: 'Icon rendered before the title' },
      { name: 'footer', type: 'ReactNode', desc: 'Pinned content below the scroll area (e.g. Minimap)' },
      { name: 'width', type: 'number', desc: 'Panel width in px (200–500)' },
      { name: 'onResizeStart', type: '(e) => void', desc: 'Drag handle mousedown handler' },
    ],
    usage: '<SidePanel side="left" title="Nav" icon={<Compass />}\n  footer={<Minimap />}>\n  {navItems}\n</SidePanel>',
    notes: ['Footer stays visible during scroll', 'Resize handle appears on the inner edge'],
    position: { x: -380, y: 80 },
  },
  {
    id: 'status-bar', label: 'StatusBar', icon: PanelBottom,
    desc: 'Bottom bar with status, viewport, clock',
    overview: 'Fixed bottom chrome with a status indicator (colored dot + label), center viewport data (click to copy coordinates), terminal toggle, system info readout, and a live clock. Supports left/right custom content slots.',
    props: [
      { name: 'status', type: '{ label, color }', desc: 'Status indicator with emerald/amber/red/neutral' },
      { name: 'viewport', type: '{ pan, zoom, canvasSize }', desc: 'Viewport data for center display' },
      { name: 'onToggleTerminal', type: '() => void', desc: 'Terminal drawer toggle callback' },
      { name: 'left / right', type: 'ReactNode', desc: 'Custom content slots on each side' },
    ],
    usage: '<StatusBar\n  status={{ label: "READY", color: "emerald" }}\n  viewport={{ pan, zoom, canvasSize }}\n  onToggleTerminal={toggle}\n/>',
    position: { x: 380, y: 80 },
  },
  {
    id: 'command-palette', label: 'CommandPalette', icon: Search,
    desc: 'Searchable command menu (Cmd+K)',
    overview: 'Modal overlay with fuzzy text search, keyboard navigation (arrow keys + enter), and shortcut badge display. Renders as a centered dialog with backdrop blur. Commands are filtered in real-time as you type.',
    props: [
      { name: 'isOpen', type: 'boolean', desc: 'Controls visibility' },
      { name: 'onClose', type: '() => void', desc: 'Called on Escape or backdrop click' },
      { name: 'commands', type: 'CommandOption[]', desc: 'Array of { id, label, shortcut?, action }' },
    ],
    usage: '<CommandPalette\n  isOpen={open}\n  onClose={() => setOpen(false)}\n  commands={[\n    { id: "save", label: "Save", shortcut: "Cmd+S", action: save }\n  ]}\n/>',
    notes: ['Cmd+K is the conventional trigger', 'Search is case-insensitive substring match'],
    position: { x: -380, y: 480 },
  },
  {
    id: 'terminal-drawer', label: 'TerminalDrawer', icon: TerminalSquare,
    desc: 'Slide-in console drawer',
    overview: 'Bottom-anchored drawer that slides up from the status bar. Supports maximize toggle to fill the viewport. Content slot accepts any React children — typically used for logs, REPL output, or a shortcuts reference.',
    props: [
      { name: 'isOpen', type: 'boolean', desc: 'Controls slide-in visibility' },
      { name: 'onClose', type: '() => void', desc: 'Called when close button is clicked' },
      { name: 'isMaximized', type: 'boolean', desc: 'Whether drawer fills the viewport' },
      { name: 'onToggleMaximize', type: '() => void', desc: 'Maximize/restore toggle' },
      { name: 'children', type: 'ReactNode', desc: 'Drawer content' },
    ],
    usage: '<TerminalDrawer isOpen={open} onClose={close}\n  isMaximized={max} onToggleMaximize={toggle}>\n  <LogOutput />\n</TerminalDrawer>',
    position: { x: 380, y: 480 },
  },
  {
    id: 'canvas', label: 'Canvas', icon: Move,
    desc: 'Pan/zoom engine with grid + crosshairs',
    overview: 'The background layer that handles all pan/zoom interaction. Renders a two-layer dot grid (minor + major) that moves with the pan offset. Space+drag to pan, Cmd+scroll to zoom. Optional crosshair guides follow the cursor and toggle with Cmd+\\.',
    props: [
      { name: 'panOffset', type: '{ x, y }', desc: 'Current pan position' },
      { name: 'scale', type: 'number', desc: 'Current zoom level' },
      { name: 'onPan', type: '(delta) => void', desc: 'Pan delta callback' },
      { name: 'showGuides', type: 'boolean', desc: 'Crosshair guide visibility (default false)' },
      { name: 'onGuidesChange', type: '(v) => void', desc: 'Called when Cmd+\\ toggles guides' },
    ],
    usage: '<Canvas panOffset={pan} scale={zoom}\n  onPan={handlePan}\n  showGuides={false}\n/>',
    notes: ['Space key activates grab cursor', 'Stale-space auto-releases after 2.5s'],
    position: { x: -380, y: 880 },
  },
  {
    id: 'minimap', label: 'Minimap', icon: Map,
    desc: 'Viewport overview with click-to-navigate',
    overview: 'Embeddable viewport minimap with a dot grid background, center crosshairs, and a viewport rectangle that tracks the current pan/zoom position. Click anywhere on the map to navigate there. Designed to live in a SidePanel footer with its own collapse/expand header.',
    props: [
      { name: 'pan', type: '{ x, y }', desc: 'Current pan offset for viewport rect' },
      { name: 'zoom', type: 'number', desc: 'Current zoom for viewport rect sizing' },
      { name: 'viewportSize', type: '{ width, height }', desc: 'Browser viewport dimensions' },
      { name: 'isCollapsed', type: 'boolean', desc: 'Shows only the header bar when true' },
      { name: 'onNavigate', type: '(pos) => void', desc: 'Called with world coords on click' },
    ],
    usage: '<SidePanel footer={\n  <Minimap pan={pan} zoom={zoom}\n    viewportSize={vp}\n    onNavigate={setPan}\n    onToggleCollapse={toggle} />\n}>',
    notes: ['Width adapts to parent via ResizeObserver', 'Collapsed state shows a clickable header bar'],
    position: { x: 380, y: 880 },
  },
];

// ---------------------------------------------------------------------------
// Component doc sheet (floating card in world space)
// ---------------------------------------------------------------------------
function ComponentSheet({ entry, onClose, isSelected, onSelect }: {
  entry: ComponentEntry;
  onClose: () => void;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = entry.icon;
  return (
    <div
      onClick={onSelect}
      className={`w-[340px] border rounded-lg bg-neutral-950/80 backdrop-blur-md overflow-hidden cursor-pointer transition-all pointer-events-auto ${
        isSelected
          ? 'border-emerald-500/80 shadow-[0_0_40px_rgba(16,185,129,0.3),0_0_80px_rgba(16,185,129,0.15),inset_0_1px_0_rgba(16,185,129,0.2)]'
          : 'border-neutral-800/60 shadow-[0_0_40px_rgba(0,0,0,0.6)] hover:border-neutral-700/80'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/50">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-emerald-400" />
          <span className="text-[12px] font-mono font-bold text-white tracking-wider">{entry.label}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded transition-colors text-neutral-500 hover:text-white pointer-events-auto"
        >
          <X size={12} />
        </button>
      </div>

      {/* Overview */}
      <div className="px-4 py-3 border-b border-neutral-800/30">
        <div className="text-[10px] font-mono text-neutral-400 leading-relaxed">{entry.overview}</div>
      </div>

      {/* Props table */}
      <div className="px-4 py-3 border-b border-neutral-800/30">
        <div className="text-[9px] font-mono text-neutral-500 tracking-widest uppercase mb-2">Props</div>
        <div className="space-y-2">
          {entry.props.map(p => (
            <div key={p.name}>
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-mono text-emerald-400">{p.name}</span>
                <span className="text-[9px] font-mono text-neutral-600">{p.type}</span>
              </div>
              <div className="text-[9px] font-mono text-neutral-500 mt-0.5">{p.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Usage */}
      <div className="px-4 py-3 border-b border-neutral-800/30">
        <div className="text-[9px] font-mono text-neutral-500 tracking-widest uppercase mb-2">Usage</div>
        <pre className="text-[9px] font-mono text-neutral-400 bg-black/40 rounded px-3 py-2 overflow-x-auto whitespace-pre">{entry.usage}</pre>
      </div>

      {/* Notes */}
      {entry.notes && entry.notes.length > 0 && (
        <div className="px-4 py-3">
          <div className="text-[9px] font-mono text-neutral-500 tracking-widest uppercase mb-2">Notes</div>
          <ul className="space-y-1">
            {entry.notes.map((n, i) => (
              <li key={i} className="text-[9px] font-mono text-neutral-500 flex items-start gap-1.5">
                <span className="text-emerald-500/60 mt-px">-</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nav items for the left sidebar
// ---------------------------------------------------------------------------
const NAV_ITEMS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'components', label: 'Components', icon: Box },
  { id: 'styles', label: 'Styles', icon: Palette },
  { id: 'grid', label: 'Grid', icon: Grid3X3 },
  { id: 'docs', label: 'Documentation', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// ---------------------------------------------------------------------------
// Demo page
// ---------------------------------------------------------------------------
export default function Demo() {
  // Panel state
  const [leftCollapsed, setLeftCollapsed] = usePersistentState('hudson.left', false);
  const [rightCollapsed, setRightCollapsed] = usePersistentState('hudson.right', false);
  const [leftWidth, setLeftWidth] = usePersistentState('hudson.leftW', 260);
  const [rightWidth, setRightWidth] = usePersistentState('hudson.rightW', 280);

  // Pan/zoom
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  // Overlays
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);

  // UI state
  const [activeNav, setActiveNav] = useState('dashboard');
  const [searchValue, setSearchValue] = useState('');
  const [muted, setMuted] = useState(false);

  // Open component doc sheets (set of ids)
  const [openSheets, setOpenSheets] = useState<Set<string>>(new Set());

  // Selected card
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  // Minimap state
  const [minimapCollapsed, setMinimapCollapsed] = usePersistentState('hudson.minimap', false);

  // Crosshair guides (default off)
  const [showGuides, setShowGuides] = useState(false);

  // Sync mute state from localStorage after mount to avoid hydration mismatch
  useEffect(() => { setMuted(isMuted()); }, []);

  // Handlers
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
    const nowMuted = toggleMute();
    setMuted(nowMuted);
    if (!nowMuted) sounds.click();
  }, []);

  const handleMinimapNavigate = useCallback((pos: { x: number; y: number }) => {
    setPanOffset(pos);
  }, []);

  const handleFitAll = useCallback(() => {
    setPanOffset({ x: 0, y: 0 });
    setScale(1);
    sounds.blipUp();
  }, []);

  const toggleSheet = useCallback((id: string) => {
    setOpenSheets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    sounds.click();
  }, []);

  const closeSheet = useCallback((id: string) => {
    setOpenSheets(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    sounds.thock();
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

  // Command palette commands
  const commands: CommandOption[] = [
    { id: 'toggle-left', label: 'Toggle Left Panel', shortcut: 'Cmd+[', action: () => { setLeftCollapsed(c => !c); sounds.thock(); } },
    { id: 'toggle-right', label: 'Toggle Right Panel', shortcut: 'Cmd+]', action: () => { setRightCollapsed(c => !c); sounds.thock(); } },
    { id: 'toggle-terminal', label: 'Toggle Terminal', shortcut: 'Ctrl+`', action: () => { setShowTerminal(t => !t); sounds.slideIn(); } },
    { id: 'toggle-guides', label: showGuides ? 'Hide Crosshair Guides' : 'Show Crosshair Guides', shortcut: 'Cmd+\\', action: () => { setShowGuides(g => !g); } },
    { id: 'toggle-minimap', label: minimapCollapsed ? 'Show Minimap' : 'Hide Minimap', action: () => { setMinimapCollapsed(c => !c); sounds.thock(); } },
    { id: 'reset-view', label: 'Reset View', shortcut: 'Cmd+0', action: () => { setPanOffset({ x: 0, y: 0 }); setScale(1); sounds.blipUp(); } },
    { id: 'toggle-mute', label: muted ? 'Unmute Sounds' : 'Mute Sounds', shortcut: 'Cmd+M', action: handleToggleMute },
  ];

  // Keyboard shortcuts
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useState(() => {
      const handler = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          setShowCommandPalette(true);
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setSelectedCard(null);
        }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    });
  }

  // Count for inspector
  const openCount = openSheets.size;

  return (
    <Frame
      panOffset={panOffset}
      scale={scale}
      onPan={handlePan}
      onZoom={handleZoom}
      onViewportChange={setViewport}
      canvasProps={{
        showGuides,
        onGuidesChange: setShowGuides,
      }}
      hud={
        <>
          <NavigationBar
            title="HUDSON"
            subtitle="v0.1.0"
            search={{
              value: searchValue,
              onChange: setSearchValue,
              placeholder: 'Filter...',
            }}
            actions={
              <button
                onClick={handleToggleMute}
                className="p-1.5 rounded hover:bg-white/10 transition-colors text-neutral-500 hover:text-white"
                title={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            }
          />

          <SidePanel
            side="left"
            title="Navigation"
            icon={<Compass size={12} />}
            isCollapsed={leftCollapsed}
            onToggleCollapse={() => { setLeftCollapsed(!leftCollapsed); sounds.thock(); }}
            width={leftWidth}
            onResizeStart={handleResizeStart('left')}
            footer={
              <>
                <CommandDock
                  onOpenCommandPalette={() => { setShowCommandPalette(true); sounds.pop(); }}
                />
                <Minimap
                  pan={panOffset}
                  zoom={scale}
                  viewportSize={viewport}
                  isCollapsed={minimapCollapsed}
                  onToggleCollapse={() => { setMinimapCollapsed(c => !c); sounds.thock(); }}
                  onNavigate={handleMinimapNavigate}
                  onFitAll={handleFitAll}
                />
              </>
            }
          >
            <div className="py-2">
              {NAV_ITEMS.map(item => {
                const Icon = item.icon;
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setActiveNav(item.id); sounds.click(); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500'
                        : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200 border-l-2 border-transparent'
                    }`}
                  >
                    <Icon size={14} className={isActive ? 'text-emerald-400' : 'text-neutral-500'} />
                    <span className="text-[11px] font-mono tracking-wider uppercase">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </SidePanel>

          <SidePanel
            side="right"
            title="Inspector"
            icon={<ScanSearch size={12} />}
            isCollapsed={rightCollapsed}
            onToggleCollapse={() => { setRightCollapsed(!rightCollapsed); sounds.thock(); }}
            width={rightWidth}
            onResizeStart={handleResizeStart('right')}
          >
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <div className="text-[9px] font-mono text-neutral-500 tracking-widest uppercase">Active View</div>
                <div className="text-sm text-emerald-400 font-mono capitalize">{activeNav}</div>
              </div>
              <div className="space-y-2">
                <div className="text-[9px] font-mono text-neutral-500 tracking-widest uppercase">Viewport</div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="text-neutral-500">Width</div>
                  <div className="text-neutral-300">{viewport.width}px</div>
                  <div className="text-neutral-500">Height</div>
                  <div className="text-neutral-300">{viewport.height}px</div>
                  <div className="text-neutral-500">Scale</div>
                  <div className="text-neutral-300">{(scale * 100).toFixed(0)}%</div>
                  <div className="text-neutral-500">Pan X</div>
                  <div className="text-neutral-300">{panOffset.x.toFixed(0)}</div>
                  <div className="text-neutral-500">Pan Y</div>
                  <div className="text-neutral-300">{panOffset.y.toFixed(0)}</div>
                </div>
              </div>
              <div className="h-px bg-neutral-800/50" />
              <div className="space-y-2">
                <div className="text-[9px] font-mono text-neutral-500 tracking-widest uppercase">Component Sheets</div>
                <div className="text-[10px] font-mono text-neutral-400">
                  {openCount === 0 ? (
                    <span className="text-neutral-600">Click a component card to open its sheet</span>
                  ) : (
                    <span><span className="text-emerald-400">{openCount}</span> open</span>
                  )}
                </div>
                {openCount > 0 && (
                  <button
                    onClick={() => { setOpenSheets(new Set()); sounds.thock(); }}
                    className="text-[9px] font-mono text-neutral-500 hover:text-white transition-colors"
                  >
                    Close all
                  </button>
                )}
              </div>
              <div className="h-px bg-neutral-800/50" />
              <div className="space-y-2">
                <div className="text-[9px] font-mono text-neutral-500 tracking-widest uppercase">Panels</div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="text-neutral-500">Left</div>
                  <div className={leftCollapsed ? 'text-neutral-600' : 'text-emerald-400'}>{leftCollapsed ? 'Collapsed' : `${leftWidth}px`}</div>
                  <div className="text-neutral-500">Right</div>
                  <div className={rightCollapsed ? 'text-neutral-600' : 'text-emerald-400'}>{rightCollapsed ? 'Collapsed' : `${rightWidth}px`}</div>
                </div>
              </div>
            </div>
          </SidePanel>

          <StatusBar
            status={{ label: 'READY', color: 'emerald' }}
            viewport={{
              pan: panOffset,
              zoom: scale,
              canvasSize: { w: viewport.width, h: viewport.height },
            }}
            onToggleTerminal={() => { setShowTerminal(t => !t); sounds.slideIn(); }}
            isTerminalOpen={showTerminal}
          />

        </>
      }
    >
      {/* Center hub card */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: `calc(50% + ${panOffset.x}px)`,
          top: `calc(50% + ${panOffset.y}px)`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div className="w-[340px] p-6 border border-neutral-800/50 rounded-lg bg-neutral-900/40 backdrop-blur-sm">
          <h1 className="text-xl font-bold text-white mb-1 font-mono tracking-wider">HUDSON</h1>
          <p className="text-neutral-500 text-[10px] font-mono mb-5">
            HUD-style chrome components. Click a card to open its doc sheet.
          </p>
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            {COMPONENTS.map(c => {
              const Icon = c.icon;
              const isOpen = openSheets.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleSheet(c.id)}
                  className={`p-2.5 rounded border text-left transition-all cursor-pointer pointer-events-auto ${
                    isOpen
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-neutral-800/50 bg-black/30 hover:border-neutral-700 hover:bg-black/50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon size={10} className={isOpen ? 'text-emerald-400' : 'text-neutral-500'} />
                    <span className={`font-bold tracking-wider text-[9px] ${isOpen ? 'text-emerald-400' : 'text-emerald-400/70'}`}>{c.label}</span>
                  </div>
                  <div className="text-neutral-500 text-[8px] leading-tight">{c.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating component doc sheets */}
      {COMPONENTS.filter(c => openSheets.has(c.id)).map(c => (
        <div
          key={c.id}
          className="absolute pointer-events-none"
          style={{
            left: `calc(50% + ${panOffset.x + c.position.x}px)`,
            top: `calc(50% + ${panOffset.y + c.position.y}px)`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <ComponentSheet
            entry={c}
            onClose={() => closeSheet(c.id)}
            isSelected={selectedCard === c.id}
            onSelect={() => setSelectedCard(c.id)}
          />
        </div>
      ))}

      {/* Connection lines from hub to open sheets */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: -1 }}
      >
        {COMPONENTS.filter(c => openSheets.has(c.id)).map(c => {
          const cx = viewport.width / 2 + panOffset.x * scale;
          const cy = viewport.height / 2 + panOffset.y * scale;
          const sx = cx + c.position.x * scale;
          const sy = cy + c.position.y * scale;
          const isSelected = selectedCard === c.id;
          return (
            <line
              key={c.id}
              x1={cx} y1={cy}
              x2={sx} y2={sy}
              stroke={isSelected ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.08)'}
              strokeWidth={isSelected ? 2 : 1}
              strokeDasharray="4 4"
            />
          );
        })}
      </svg>

      {/* Overlays */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        commands={commands}
      />

      <TerminalDrawer
        isOpen={showTerminal}
        onClose={() => { setShowTerminal(false); sounds.slideOut(); }}
        onToggleMaximize={() => setIsTerminalMaximized(m => !m)}
        isMaximized={isTerminalMaximized}
      >
        <div className="p-4 font-mono text-[11px] space-y-3 overflow-y-auto frame-scrollbar">
          <div className="text-neutral-500 uppercase tracking-widest text-[9px] mb-2">Keyboard Shortcuts</div>
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
                <div className="text-neutral-500">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </TerminalDrawer>
    </Frame>
  );
}
