'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X, Settings as SettingsIcon, LayoutGrid, AppWindow, RotateCcw,
  Maximize2, Eye, EyeOff, Crosshair, GripVertical, Power, Sliders,
} from 'lucide-react';
import { useWorkspaceManager } from './WorkspaceManagerContext';
import type { WindowBounds } from './WorkspaceManagerContext';
import type { ServiceStatus } from '@hudson/sdk';
import type { AppSettingsEntry } from '../../apps/hudson-docs/components';
import {
  SettingsSlider,
  SettingsToggle,
  SettingsSegment,
  SettingsSelect,
  SettingsText,
  SettingsSection,
  ServiceActionButton,
  FontSettingsCard,
} from '../../apps/hudson-docs/components';
import { DEFAULT_SHELL_SETTINGS } from '../shellSettings';
import { HudsonVoiceSettingsEditor } from '../HudsonVoiceSettingsEditor';
import { HudsonEnvironmentEditor } from '../HudsonEnvironmentEditor';

// ---------------------------------------------------------------------------
// Status color/label maps
// ---------------------------------------------------------------------------
// Status colors are real runtime signals (service running / errored) and must
// stay in the success / destructive / warning family regardless of template.
const SVC_STATUS_COLORS: Record<ServiceStatus, string> = {
  unknown: 'bg-muted-foreground',
  not_installed: 'bg-muted-foreground',
  installed: 'bg-warning',
  running: 'bg-success',
  error: 'bg-destructive',
};

const SVC_STATUS_LABELS: Record<ServiceStatus, string> = {
  unknown: 'Unknown',
  not_installed: 'Not Running',
  installed: 'Installed',
  running: 'Running',
  error: 'Error',
};

// App color palette (no purple)
const APP_COLORS = [
  { fill: '#06b6d4' },
  { fill: '#10b981' },
  { fill: '#3b82f6' },
  { fill: '#14b8a6' },
  { fill: '#f59e0b' },
  { fill: '#f43f5e' },
];

export type EditorTab = 'overview' | 'apps' | 'settings' | 'environment';
// ---------------------------------------------------------------------------
// Inline app settings renderer
// ---------------------------------------------------------------------------
function AppSettingsInline({ entry }: { entry: AppSettingsEntry }) {
  return (
    <div className="space-y-5">
      {entry.config.sections.map(section => (
        <div key={section.label}>
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-2.5">{section.label}</div>
          <div className="space-y-3">
            {section.fields.map(field => {
              const value = entry.values[field.key] ?? field.default;
              switch (field.type) {
                case 'text':
                  return <SettingsText key={field.key} label={field.label} value={String(value)} onChange={v => entry.onUpdate({ [field.key]: v })} />;
                case 'number':
                case 'slider':
                  return <SettingsSlider key={field.key} label={field.label} value={Number(value)} min={field.min ?? 0} max={field.max ?? 100} step={field.step ?? 1} format={field.format ?? (v => String(v))} onChange={v => entry.onUpdate({ [field.key]: v })} />;
                case 'toggle':
                  return <SettingsToggle key={field.key} label={field.label} checked={Boolean(value)} onChange={v => entry.onUpdate({ [field.key]: v })} />;
                case 'segment':
                  return <SettingsSegment key={field.key} label={field.label} value={String(value)} options={field.options ?? []} onChange={v => entry.onUpdate({ [field.key]: v })} />;
                case 'select':
                  return <SettingsSelect key={field.key} label={field.label} value={String(value)} options={field.options ?? []} onChange={v => entry.onUpdate({ [field.key]: v })} />;
                default:
                  return null;
              }
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service card
// ---------------------------------------------------------------------------
function ServiceCard({ serviceId }: { serviceId: string }) {
  const { serviceRegistry } = useWorkspaceManager();
  const { catalog, records, history, executeAction, autoStartIds, toggleAutoStart } = serviceRegistry;
  const svc = catalog.find(s => s.id === serviceId);
  const record = records[serviceId];
  const status: ServiceStatus = record?.status ?? 'unknown';
  const svcHistory = history.filter(h => h.serviceId === serviceId).slice(0, 5);
  const isAutoStart = autoStartIds.includes(serviceId);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleAction = useCallback(async (action: 'start' | 'stop' | 'check' | 'install') => {
    setLoadingAction(action);
    try { await executeAction(serviceId, action); } finally { setLoadingAction(null); }
  }, [executeAction, serviceId]);

  return (
    <div className="rounded-lg border border-border/70 bg-card/72 overflow-hidden min-w-0">
      <div className="flex items-center gap-2.5 px-3 py-2.5 min-w-0">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${SVC_STATUS_COLORS[status]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-mono font-medium text-foreground/84">{svc?.name ?? serviceId}</span>
            {svc?.version && <span className="text-[10px] font-mono text-muted-foreground">v{svc.version}</span>}
          </div>
          {svc?.description && <div className="text-[10px] font-mono text-muted-foreground truncate">{svc.description}</div>}
        </div>
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex-shrink-0">{SVC_STATUS_LABELS[status]}</span>
      </div>
      <div className="border-t border-border/60 px-3 py-2.5 space-y-2.5">
        <div className="flex gap-2 flex-wrap">
          {status !== 'running' && <ServiceActionButton label="Start" loading={loadingAction === 'start'} onClick={() => handleAction('start')} />}
          {status === 'running' && <ServiceActionButton label="Stop" variant="danger" loading={loadingAction === 'stop'} onClick={() => handleAction('stop')} />}
          <ServiceActionButton label="Check" variant="secondary" loading={loadingAction === 'check'} onClick={() => handleAction('check')} />
          {(status === 'not_installed' || status === 'unknown') && <ServiceActionButton label="Install" variant="secondary" loading={loadingAction === 'install'} onClick={() => handleAction('install')} />}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-muted-foreground">Auto-start</span>
          <button
            onClick={() => toggleAutoStart(serviceId)}
            className={`w-7 h-4 rounded-full relative transition-colors ${isAutoStart ? 'bg-accent' : 'bg-muted'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-card shadow transition-transform ${isAutoStart ? 'left-[13px]' : 'left-0.5'}`} />
          </button>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px] font-mono">
          {record?.pid && <><span className="text-muted-foreground">PID</span><span className="text-foreground/78">{record.pid}</span></>}
          {svc?.check.port && <><span className="text-muted-foreground">Port</span><span className="text-foreground/78">{svc.check.port}</span></>}
          {record?.lastChecked && <><span className="text-muted-foreground">Checked</span><span className="text-foreground/78">{new Date(record.lastChecked).toLocaleTimeString()}</span></>}
        </div>
        {record?.error && <div className="text-[10px] font-mono text-destructive bg-destructive/5 border border-destructive/20 rounded px-2 py-1.5 break-words">{record.error}</div>}
        {svcHistory.length > 0 && (
          <div>
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Recent</div>
            <div className="space-y-0.5">
              {svcHistory.map(h => (
                <div key={h.id} className="flex items-center gap-2 text-[10px] font-mono py-0.5">
                  <span className={`w-1 h-1 rounded-full flex-shrink-0 ${h.success ? 'bg-success' : 'bg-destructive'}`} />
                  <span className="text-foreground/70">{h.action}</span>
                  {h.durationMs > 0 && <span className="text-muted-foreground">{h.durationMs}ms</span>}
                  <span className="text-muted-foreground ml-auto flex-shrink-0">{new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visual layout minimap
// ---------------------------------------------------------------------------
function LayoutMinimap({
  hoveredAppId,
  onHoverApp,
  onSelectApp,
}: {
  hoveredAppId: string | null;
  onHoverApp: (id: string | null) => void;
  onSelectApp: (id: string) => void;
}) {
  const { workspace, activatedAppIds, disabledAppIds, focusedAppId, windowBoundsMap } = useWorkspaceManager();

  const rects = useMemo(() => {
    return workspace.apps
      .filter(c => c.canvasMode === 'windowed' && !disabledAppIds.has(c.app.id))
      .map((config, i) => {
        const bounds: WindowBounds = windowBoundsMap[config.app.id] ?? config.defaultWindowBounds ?? { x: 0, y: 0, w: 800, h: 600 };
        const isVisible = activatedAppIds.has(config.app.id);
        const color = APP_COLORS[i % APP_COLORS.length];
        return { id: config.app.id, name: config.app.name, bounds, isVisible, color };
      });
  }, [workspace.apps, windowBoundsMap, activatedAppIds, disabledAppIds]);

  const viewport = useMemo(() => {
    if (rects.length === 0) return { minX: -500, minY: -400, width: 1000, height: 800 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of rects) {
      minX = Math.min(minX, r.bounds.x);
      minY = Math.min(minY, r.bounds.y);
      maxX = Math.max(maxX, r.bounds.x + r.bounds.w);
      maxY = Math.max(maxY, r.bounds.y + r.bounds.h);
    }
    const pad = 80;
    return { minX: minX - pad, minY: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 };
  }, [rects]);

  return (
    <div className="rounded-lg border border-border/70 bg-card/72 overflow-hidden">
      <svg viewBox={`${viewport.minX} ${viewport.minY} ${viewport.width} ${viewport.height}`} className="w-full" style={{ height: 260 }}>
        <defs>
          <pattern id="wm-grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <circle cx="50" cy="50" r="1" fill="oklch(var(--foreground) / 0.08)" />
          </pattern>
        </defs>
        <rect x={viewport.minX} y={viewport.minY} width={viewport.width} height={viewport.height} fill="url(#wm-grid)" />
        <line x1="-20" y1="0" x2="20" y2="0" stroke="oklch(var(--foreground) / 0.12)" strokeWidth="1" />
        <line x1="0" y1="-20" x2="0" y2="20" stroke="oklch(var(--foreground) / 0.12)" strokeWidth="1" />

        {rects.map(r => {
          const isFocused = r.id === focusedAppId;
          const isHovered = r.id === hoveredAppId;
          const opacity = !r.isVisible ? 0.25 : isHovered ? 1 : 0.7;
          return (
            <g key={r.id} opacity={opacity} className="cursor-pointer" onMouseEnter={() => onHoverApp(r.id)} onMouseLeave={() => onHoverApp(null)} onClick={() => onSelectApp(r.id)}>
              <rect x={r.bounds.x} y={r.bounds.y} width={r.bounds.w} height={r.bounds.h} rx={6} fill={r.color.fill + '18'} stroke={r.color.fill + (isFocused ? 'aa' : '55')} strokeWidth={isFocused ? 2 : 1} strokeDasharray={!r.isVisible ? '4 2' : undefined} />
              <rect x={r.bounds.x} y={r.bounds.y} width={r.bounds.w} height={24} rx={6} fill={r.color.fill + '20'} />
              <rect x={r.bounds.x} y={r.bounds.y + 18} width={r.bounds.w} height={6} fill={r.color.fill + '20'} />
              <text x={r.bounds.x + 10} y={r.bounds.y + 16} fill={r.color.fill} fontSize={11} fontFamily="monospace" fontWeight={600}>{r.name}</text>
              <text x={r.bounds.x + r.bounds.w - 8} y={r.bounds.y + r.bounds.h - 8} fill="oklch(var(--foreground) / 0.28)" fontSize={9} fontFamily="monospace" textAnchor="end">{r.bounds.w}x{r.bounds.h}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag-sortable app row
// ---------------------------------------------------------------------------
function DraggableAppRow({
  appId,
  draggedId,
  dragOverId,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  children,
}: {
  appId: string;
  draggedId: string | null;
  dragOverId: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDragEnd: () => void;
  onDrop: () => void;
  children: React.ReactNode;
}) {
  const isDragging = draggedId === appId;
  const isOver = dragOverId === appId && draggedId !== appId;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(appId);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver(appId);
      }}
      onDragEnd={onDragEnd}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={`transition-all duration-150 ${isDragging ? 'opacity-30 scale-[0.98]' : ''} ${isOver ? 'translate-y-[-2px]' : ''}`}
      style={isOver ? { borderTop: '2px solid oklch(var(--accent))' } : undefined}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------
function OverviewTab({ onSwitchToApp }: { onSwitchToApp: (appId: string) => void }) {
  const {
    workspace,
    activatedAppIds,
    disabledAppIds,
    appOrder,
    focusedAppId,
    onToggleAppVisibility,
    onToggleAppDisabled,
    onReorderApps,
    onFocusApp,
    windowBoundsMap,
    onResetLayout,
    onFitAll,
  } = useWorkspaceManager();

  const [hoveredAppId, setHoveredAppId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Order apps by persisted order
  const orderedApps = useMemo(() => {
    const map = new Map(workspace.apps.map(c => [c.app.id, c]));
    return appOrder
      .filter(id => map.has(id))
      .map(id => map.get(id)!);
  }, [workspace.apps, appOrder]);

  // Split into enabled and disabled
  const enabledApps = useMemo(() => orderedApps.filter(c => !disabledAppIds.has(c.app.id)), [orderedApps, disabledAppIds]);
  const disabledApps = useMemo(() => orderedApps.filter(c => disabledAppIds.has(c.app.id)), [orderedApps, disabledAppIds]);

  const handleDrop = useCallback(() => {
    if (!draggedId || !dragOverId || draggedId === dragOverId) return;
    const ids = [...appOrder];
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(dragOverId);
    if (fromIdx === -1 || toIdx === -1) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedId);
    onReorderApps(ids);
    setDraggedId(null);
    setDragOverId(null);
  }, [draggedId, dragOverId, appOrder, onReorderApps]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  const visibleCount = enabledApps.filter(c => activatedAppIds.has(c.app.id)).length;

  return (
    <div className="flex-1 overflow-y-auto frame-scrollbar">
      <div className="p-5 space-y-5">
        {/* Workspace header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[18px] font-mono font-bold text-foreground tracking-wide">{workspace.name}</div>
            {workspace.description && <div className="text-[11px] font-mono text-muted-foreground mt-1">{workspace.description}</div>}
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-info" />
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{workspace.mode} mode</span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                {enabledApps.length} enabled &middot; {visibleCount} visible
                {disabledApps.length > 0 && <> &middot; {disabledApps.length} disabled</>}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onFitAll} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-card border border-border text-[10px] font-mono text-foreground/76 hover:text-foreground hover:border-border/80 transition-colors" title="Fit all windows into view">
              <Maximize2 size={10} /> Fit All
            </button>
            <button onClick={onResetLayout} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-card border border-border text-[10px] font-mono text-foreground/76 hover:text-foreground hover:border-border/80 transition-colors" title="Reset all window positions">
              <RotateCcw size={10} /> Reset Layout
            </button>
          </div>
        </div>

        {/* Visual layout minimap */}
        <div>
          <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Canvas Layout</div>
          <LayoutMinimap hoveredAppId={hoveredAppId} onHoverApp={setHoveredAppId} onSelectApp={onSwitchToApp} />
        </div>

        {/* Enabled apps (drag-sortable) */}
        <div>
          <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Applications</div>
          <div className="space-y-1">
            {enabledApps.map(config => {
              const { app } = config;
              const isVisible = activatedAppIds.has(app.id);
              const isFocused = app.id === focusedAppId;
              const isHovered = app.id === hoveredAppId;
              const bounds: WindowBounds | undefined = windowBoundsMap[app.id] ?? config.defaultWindowBounds;
              const color = APP_COLORS[workspace.apps.indexOf(config) % APP_COLORS.length];

              return (
                <DraggableAppRow
                  key={app.id}
                  appId={app.id}
                  draggedId={draggedId}
                  dragOverId={dragOverId}
                  onDragStart={setDraggedId}
                  onDragOver={setDragOverId}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
                >
                  <div
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors group ${
                      isHovered ? 'bg-accent/8 border-border' : 'bg-card/72 border-border/60'
                    }`}
                    onMouseEnter={() => setHoveredAppId(app.id)}
                    onMouseLeave={() => setHoveredAppId(null)}
                  >
                    {/* Drag handle */}
                    <div className="text-muted-foreground hover:text-foreground/80 cursor-grab active:cursor-grabbing flex-shrink-0">
                      <GripVertical size={12} />
                    </div>

                    {/* Color dot */}
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color.fill + '80' }} />

                    {/* App info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-mono font-medium text-foreground/84">{app.name}</span>
                        {isFocused && <span className="text-[9px] font-mono text-accent uppercase tracking-wider">Focused</span>}
                      </div>
                      {app.description && <div className="text-[10px] font-mono text-muted-foreground truncate">{app.description}</div>}
                    </div>

                    {/* Bounds */}
                    {bounds && config.canvasMode === 'windowed' && (
                      <div className="text-[9px] font-mono text-muted-foreground flex-shrink-0 tabular-nums hidden group-hover:block">
                        {bounds.w}x{bounds.h}
                      </div>
                    )}

                    {/* Focus */}
                    <button onClick={() => onFocusApp(app.id)} className="p-1 hover:bg-accent/10 rounded transition-colors text-muted-foreground hover:text-accent flex-shrink-0 opacity-0 group-hover:opacity-100" title="Focus">
                      <Crosshair size={12} />
                    </button>

                    {/* Visibility toggle */}
                    <button
                      onClick={() => onToggleAppVisibility(app.id)}
                      className={`p-1 hover:bg-accent/10 rounded transition-colors flex-shrink-0 ${isVisible ? 'text-foreground/72 hover:text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
                      title={isVisible ? 'Hide' : 'Show'}
                    >
                      {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>

                    {/* Disable */}
                    <button
                      onClick={() => onToggleAppDisabled(app.id)}
                      className="p-1 hover:bg-accent/10 rounded transition-colors text-muted-foreground hover:text-destructive flex-shrink-0 opacity-0 group-hover:opacity-100"
                      title="Disable app"
                    >
                      <Power size={12} />
                    </button>

                    {/* Settings */}
                    <button onClick={() => onSwitchToApp(app.id)} className="p-1 hover:bg-accent/10 rounded transition-colors text-muted-foreground hover:text-foreground flex-shrink-0 opacity-0 group-hover:opacity-100" title="Settings">
                      <SettingsIcon size={12} />
                    </button>
                  </div>
                </DraggableAppRow>
              );
            })}
          </div>
        </div>

        {/* Disabled apps */}
        {disabledApps.length > 0 && (
          <div>
            <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Disabled</div>
            <div className="space-y-1">
              {disabledApps.map((config) => {
                const { app } = config;
                return (
                  <div key={app.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 bg-card/60 opacity-50 hover:opacity-80 transition-opacity">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-muted" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[12px] font-mono text-muted-foreground">{app.name}</span>
                    </div>
                    <button
                      onClick={() => onToggleAppDisabled(app.id)}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono text-accent hover:text-accent border border-accent/20 hover:border-accent/40 transition-colors"
                    >
                      <Power size={10} /> Enable
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Session */}
        <div>
          <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Session</div>
          <div className="rounded-lg border border-border/60 bg-card/72 p-3">
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[10px] font-mono">
              <span className="text-muted-foreground">Workspace ID</span>
              <span className="text-foreground/78 font-medium">{workspace.id}</span>
              <span className="text-muted-foreground">Key prefix</span>
              <span className="text-foreground/70">hudson.ws.{workspace.id}.*</span>
            </div>
            <div className="mt-3">
              <button
                onClick={() => {
                  const keys = Object.keys(localStorage).filter(k => k.startsWith(`hudson.ws.${workspace.id}.`));
                  if (keys.length > 0 && confirm(`Clear ${keys.length} persisted keys for this workspace?`)) {
                    keys.forEach(k => localStorage.removeItem(k));
                    window.location.reload();
                  }
                }}
                className="text-[10px] font-mono text-destructive hover:text-destructive/80 border border-destructive/20 hover:border-destructive/40 rounded px-2.5 py-1 transition-colors"
              >
                Clear workspace state
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings tab (merged from SettingsPanel)
// ---------------------------------------------------------------------------
function SettingsTab() {
  const { shellSettings, onUpdateShellSettings, onResetShellSettings } = useWorkspaceManager();
  const voiceSettings = shellSettings.voice ?? DEFAULT_SHELL_SETTINGS.voice;

  return (
    <div className="flex-1 overflow-y-auto frame-scrollbar">
      <SettingsSection label="Appearance">
        <SettingsSegment
          label="Theme"
          value={shellSettings.theme}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          onChange={v => onUpdateShellSettings({ theme: v })}
        />
        <SettingsSegment
          label="Template"
          value={shellSettings.template}
          options={[
            { value: 'hudson', label: 'Hudson' },
            { value: 'editorial', label: 'Editorial' },
          ]}
          onChange={v => onUpdateShellSettings({ template: v })}
        />
        <SettingsSlider label="Glow Intensity" value={shellSettings.glowIntensity} min={0} max={100} step={1} format={v => `${v}%`} onChange={v => onUpdateShellSettings({ glowIntensity: v })} />
        <SettingsSlider label="Grid Opacity" value={shellSettings.gridOpacity ?? 60} min={0} max={100} step={5} format={v => `${v}%`} onChange={v => onUpdateShellSettings({ gridOpacity: v })} />
        <SettingsSegment
          label="Connector Style"
          value={shellSettings.connectorStyle}
          options={[
            { value: 'dashed', label: 'Dashed' },
            { value: 'solid', label: 'Solid' },
            { value: 'dotted', label: 'Dotted' },
          ]}
          onChange={v => onUpdateShellSettings({ connectorStyle: v })}
        />
        <div className="rounded border border-border/60 bg-secondary/70 px-3 py-2 text-[10px] font-mono text-muted-foreground">
          Theme controls the light/dark/system mode for the workspace. Template swaps the visual token set.
        </div>
      </SettingsSection>
      <SettingsSection label="Typography">
        <FontSettingsCard
          fontSize={shellSettings.font?.fontSize ?? 13}
          fontFamily={shellSettings.font?.fontFamily ?? 'system-ui'}
          onChangeFontSize={v => onUpdateShellSettings({ font: { ...(shellSettings.font ?? { fontSize: 13, fontFamily: 'system-ui' }), fontSize: v } })}
          onChangeFontFamily={v => onUpdateShellSettings({ font: { ...(shellSettings.font ?? { fontSize: 13, fontFamily: 'system-ui' }), fontFamily: v } })}
        />
      </SettingsSection>
      <SettingsSection label="Navigation">
        <SettingsSlider label="Zoom Sensitivity" value={shellSettings.zoomSensitivity ?? 1.0} min={0.5} max={3} step={0.1} format={v => `${(v ?? 1.0).toFixed(1)}x`} onChange={v => onUpdateShellSettings({ zoomSensitivity: v })} />
      </SettingsSection>
      <SettingsSection label="Sound">
        <SettingsToggle label="Master Mute" checked={shellSettings.masterMute} onChange={v => onUpdateShellSettings({ masterMute: v })} />
        <SettingsToggle label="Click Sounds" checked={shellSettings.uiClickSounds} onChange={v => onUpdateShellSettings({ uiClickSounds: v })} />
        <SettingsToggle label="Transition Sounds" checked={shellSettings.uiTransitionSounds} onChange={v => onUpdateShellSettings({ uiTransitionSounds: v })} />
      </SettingsSection>
      <SettingsSection label="Voice">
        <HudsonVoiceSettingsEditor
          voiceSettings={voiceSettings}
          onChange={next => onUpdateShellSettings({ voice: next })}
        />
      </SettingsSection>
      <SettingsSection label="Shortcuts">
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[11px] font-mono">
          {[
            ['Space + Drag', 'Pan canvas'],
            ['Cmd + Scroll', 'Zoom in / out'],
            ['Cmd + 0', 'Reset view'],
            ['Cmd + K', 'Command palette'],
            ['Settings button', 'Open workspace settings'],
            ['Command Palette', 'Search settings + template commands'],
            ['Cmd + [', 'Toggle left panel'],
            ['Cmd + ]', 'Toggle right panel'],
            ['Cmd + \\', 'Toggle crosshair guides'],
            ['Ctrl + `', 'Toggle terminal'],
            ['Cmd + M', 'Toggle mute'],
          ].map(([key, desc]) => (
              <div key={key} className="contents">
                <div className="text-accent/80 whitespace-nowrap">{key}</div>
              <div className="text-foreground/76">{desc}</div>
            </div>
          ))}
        </div>
      </SettingsSection>
      <div className="px-6 py-4">
        <button onClick={onResetShellSettings} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono text-foreground/76 hover:text-foreground border border-border hover:border-border/80 transition-colors">
          <RotateCcw size={10} /> Reset All Settings
        </button>
      </div>
    </div>
  );
}

function EnvironmentTab() {
  return (
    <div className="flex-1 overflow-y-auto frame-scrollbar">
      <SettingsSection label="Local Environment">
        <HudsonEnvironmentEditor />
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App detail tab content
// ---------------------------------------------------------------------------
function AppContent({ appId }: { appId: string }) {
  const { workspace, activatedAppIds, disabledAppIds, onToggleAppVisibility, onToggleAppDisabled, appSettings, windowBoundsMap } = useWorkspaceManager();

  const config = workspace.apps.find(c => c.app.id === appId);
  if (!config) return null;

  const { app } = config;
  const isDisabled = disabledAppIds.has(appId);
  const isLoaded = activatedAppIds.has(appId);
  const entry = appSettings.find(e => e.appId === appId);
  const deps = app.services ?? [];
  const hasSettings = entry && entry.config.sections.length > 0;
  const hasServices = deps.length > 0;
  const bounds = windowBoundsMap[appId] ?? config.defaultWindowBounds;

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      {/* App header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-mono font-bold text-foreground tracking-wider">{app.name}</div>
          {app.description && <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{app.description}</div>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Disable/Enable */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {isDisabled ? 'Disabled' : 'Enabled'}
            </span>
            <button
              onClick={() => onToggleAppDisabled(appId)}
              className={`w-9 h-5 rounded-full relative transition-colors ${!isDisabled ? 'bg-accent' : 'bg-muted'}`}
              title={isDisabled ? 'Enable app' : 'Disable app'}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-card shadow transition-transform ${!isDisabled ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Visibility (only for enabled apps) */}
          {!isDisabled && (
            <div className="flex items-center gap-2 border-l border-border/60 pl-3">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                {isLoaded ? 'Visible' : 'Hidden'}
              </span>
              <button
                onClick={() => onToggleAppVisibility(appId)}
                className={`w-9 h-5 rounded-full relative transition-colors ${isLoaded ? 'bg-info' : 'bg-muted'}`}
                title={isLoaded ? 'Hide from canvas' : 'Show on canvas'}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-card shadow transition-transform ${isLoaded ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>
          )}
        </div>
      </div>

      {isDisabled ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Power size={24} className="text-muted-foreground mx-auto mb-3" />
            <div className="text-[12px] font-mono text-muted-foreground">This app is disabled</div>
            <div className="text-[10px] font-mono text-muted-foreground mt-1">Enable it to load its Provider and render on the canvas</div>
            <button
              onClick={() => onToggleAppDisabled(appId)}
              className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono text-accent border border-accent/30 hover:border-accent/60 transition-colors mx-auto"
            >
              <Power size={11} /> Enable App
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto frame-scrollbar">
          <div className="p-5 space-y-5">
            {/* Window bounds */}
            {config.canvasMode === 'windowed' && bounds && (
              <div>
                <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2.5">Window Position</div>
                <div className="grid grid-cols-4 gap-2">
                  {(['x', 'y', 'w', 'h'] as const).map(key => (
                    <div key={key} className="rounded-md border border-border/60 bg-card/72 px-2.5 py-2">
                      <div className="text-[9px] font-mono text-muted-foreground uppercase mb-1">{key === 'w' ? 'Width' : key === 'h' ? 'Height' : key.toUpperCase()}</div>
                      <div className="text-[13px] font-mono text-foreground/84 tabular-nums">{bounds[key]}px</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* App metadata */}
            <div>
              <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2.5">Details</div>
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[10px] font-mono">
                <span className="text-muted-foreground">ID</span><span className="text-foreground/76">{app.id}</span>
                <span className="text-muted-foreground">Mode</span><span className="text-foreground/76">{app.mode}</span>
                <span className="text-muted-foreground">Canvas</span><span className="text-foreground/76">{config.canvasMode ?? 'native'}</span>
                {app.ports?.outputs && app.ports.outputs.length > 0 && (
                  <><span className="text-muted-foreground">Outputs</span><span className="text-foreground/76">{app.ports.outputs.map(o => o.name).join(', ')}</span></>
                )}
                {app.ports?.inputs && app.ports.inputs.length > 0 && (
                  <><span className="text-muted-foreground">Inputs</span><span className="text-foreground/76">{app.ports.inputs.map(o => o.name).join(', ')}</span></>
                )}
                {app.intents && app.intents.length > 0 && (
                  <><span className="text-muted-foreground">Intents</span><span className="text-foreground/76">{app.intents.length} registered</span></>
                )}
              </div>
            </div>

            {/* Settings + Services */}
            {(hasSettings || hasServices) && (
              <div className={`grid gap-5 ${hasSettings && hasServices ? 'grid-cols-[1fr_1fr]' : 'grid-cols-1'}`}>
                {hasSettings && entry && (
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-3">Settings</div>
                    <AppSettingsInline entry={entry} />
                  </div>
                )}
                {hasServices && (
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-3">Services</div>
                    <div className="space-y-2">{deps.map(dep => <ServiceCard key={dep.serviceId} serviceId={dep.serviceId} />)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkspaceManagerPanel — unified settings + workspace editor
// ---------------------------------------------------------------------------
function WorkspaceManagerPanelBody({
  onClose,
  defaultTab,
}: {
  onClose: () => void;
  defaultTab: EditorTab;
}) {
  const { workspace, activatedAppIds, disabledAppIds, focusedAppId, serviceRegistry } = useWorkspaceManager();
  const [tab, setTab] = useState<EditorTab>(defaultTab);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(() => {
    if (workspace.apps.length === 0) return null;
    return workspace.apps.find(c => c.app.id === focusedAppId)
      ? focusedAppId
      : workspace.apps[0].app.id;
  });
  const preferredAppId = workspace.apps.find(c => c.app.id === focusedAppId)
    ? focusedAppId
    : workspace.apps[0]?.app.id ?? null;
  const activeSelectedAppId = workspace.apps.some(c => c.app.id === selectedAppId)
    ? selectedAppId
    : preferredAppId;

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const switchToApp = useCallback((appId: string) => {
    setTab('apps');
    setSelectedAppId(appId);
  }, []);

  const tabConfig = [
    { id: 'overview' as const, label: 'Workspace', icon: LayoutGrid },
    { id: 'apps' as const, label: 'Apps', icon: AppWindow },
    { id: 'settings' as const, label: 'Settings', icon: Sliders },
    { id: 'environment' as const, label: 'Environment', icon: SettingsIcon },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[6vh] bg-foreground/60 backdrop-blur-[2px] pointer-events-auto" onClick={onClose}>
      <div
        className="w-[1020px] max-w-[94vw] bg-card border border-border shadow-2xl rounded-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
        style={{ maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header with tabs */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <SettingsIcon size={14} className="text-accent" />
              <span className="text-[13px] font-mono font-bold text-foreground tracking-wider">HUDSON</span>
            </div>
            <div className="flex items-center gap-1 ml-2">
              {tabConfig.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono font-medium transition-colors ${
                    tab === t.id
                      ? 'bg-accent/10 text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/8'
                  }`}
                >
                  <t.icon size={11} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-accent/10 rounded transition-colors text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {tab === 'overview' ? (
            <OverviewTab onSwitchToApp={switchToApp} />
          ) : tab === 'environment' ? (
            <EnvironmentTab />
          ) : tab === 'settings' ? (
            <SettingsTab />
          ) : (
            <>
              {/* Left rail */}
              <div className="w-[140px] shrink-0 border-r border-border/60 overflow-y-auto frame-scrollbar bg-card/72">
                <div className="py-2">
                  {workspace.apps.map(config => {
                    const { app } = config;
                    const isActive = activeSelectedAppId === app.id;
                    const isDisabled = disabledAppIds.has(app.id);
                    const isLoaded = activatedAppIds.has(app.id);
                    const deps = app.services ?? [];

                    const depStatuses = deps.map(dep => {
                      const status: ServiceStatus = serviceRegistry.records[dep.serviceId]?.status ?? 'unknown';
                      return { serviceId: dep.serviceId, status };
                    });

                    return (
                      <button
                        key={app.id}
                        onClick={() => setSelectedAppId(app.id)}
                        className={`w-full text-left px-3 py-2.5 transition-colors relative ${
                          isActive ? 'bg-accent/8' : 'hover:bg-accent/6'
                        } ${isDisabled ? 'opacity-30' : !isLoaded ? 'opacity-50' : ''}`}
                      >
                        {isActive && <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-accent rounded-r" />}
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[11px] font-mono font-medium truncate ${isActive ? 'text-accent' : 'text-foreground/76'}`}>
                            {app.name}
                          </span>
                          {isDisabled && <Power size={9} className="text-muted-foreground flex-shrink-0" />}
                          {depStatuses.length > 0 && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              {depStatuses.map(d => (
                                <div key={d.serviceId} className={`w-1.5 h-1.5 rounded-full ${SVC_STATUS_COLORS[d.status]}`} title={`${d.serviceId}: ${SVC_STATUS_LABELS[d.status]}`} />
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right content */}
              {activeSelectedAppId ? (
                <AppContent appId={activeSelectedAppId} />
              ) : (
                <div className="flex-1 flex items-center justify-center text-[11px] font-mono text-muted-foreground">
                  Select an app from the sidebar
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-card/95 backdrop-blur-sm border-t border-border flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-muted-foreground">
                {tab === 'settings'
                  ? 'Settings'
                  : tab === 'environment'
                    ? 'Environment'
                    : tab === 'apps'
                      ? 'Apps'
                      : 'Workspace'}
              </span>
              {tab !== 'settings' && (
                <div className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px] text-foreground/76 font-mono">
                  {tab === 'environment' ? '.env' : '\u2318\u21e7,'}
                </div>
              )}
            </div>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">
            {workspace.apps.length - disabledAppIds.size} of {workspace.apps.length} apps enabled
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceManagerPanel({
  isOpen,
  onClose,
  defaultTab = 'overview',
}: {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: EditorTab;
}) {
  if (!isOpen) return null;
  return <WorkspaceManagerPanelBody key={defaultTab} onClose={onClose} defaultTab={defaultTab} />;
}
