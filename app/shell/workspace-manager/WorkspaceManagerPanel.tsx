'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Settings as SettingsIcon } from 'lucide-react';
import { useWorkspaceManager } from './WorkspaceManagerContext';
import type { ServiceStatus } from '@hudson/sdk';
import type { AppSettingsEntry } from '../../apps/hudson-docs/components';
import {
  SettingsSlider,
  SettingsToggle,
  SettingsSegment,
  SettingsText,
  ServiceActionButton,
} from '../../apps/hudson-docs/components';

// ---------------------------------------------------------------------------
// Status color/label maps
// ---------------------------------------------------------------------------
const SVC_STATUS_COLORS: Record<ServiceStatus, string> = {
  unknown: 'bg-neutral-500',
  not_installed: 'bg-neutral-500',
  installed: 'bg-amber-500',
  running: 'bg-emerald-500',
  error: 'bg-red-500',
};

const SVC_STATUS_LABELS: Record<ServiceStatus, string> = {
  unknown: 'Unknown',
  not_installed: 'Not Running',
  installed: 'Installed',
  running: 'Running',
  error: 'Error',
};

// ---------------------------------------------------------------------------
// Inline app settings renderer (no accordion wrapper)
// ---------------------------------------------------------------------------
function AppSettingsInline({ entry }: { entry: AppSettingsEntry }) {
  return (
    <div className="space-y-5">
      {entry.config.sections.map(section => (
        <div key={section.label}>
          <div className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest mb-2.5">{section.label}</div>
          <div className="space-y-3">
            {section.fields.map(field => {
              const value = entry.values[field.key] ?? field.default;
              switch (field.type) {
                case 'text':
                  return (
                    <SettingsText
                      key={field.key}
                      label={field.label}
                      value={String(value)}
                      onChange={v => entry.onUpdate({ [field.key]: v })}
                    />
                  );
                case 'number':
                case 'slider':
                  return (
                    <SettingsSlider
                      key={field.key}
                      label={field.label}
                      value={Number(value)}
                      min={field.min ?? 0}
                      max={field.max ?? 100}
                      step={field.step ?? 1}
                      format={field.format ?? (v => String(v))}
                      onChange={v => entry.onUpdate({ [field.key]: v })}
                    />
                  );
                case 'toggle':
                  return (
                    <SettingsToggle
                      key={field.key}
                      label={field.label}
                      checked={Boolean(value)}
                      onChange={v => entry.onUpdate({ [field.key]: v })}
                    />
                  );
                case 'segment':
                  return (
                    <SettingsSegment
                      key={field.key}
                      label={field.label}
                      value={String(value)}
                      options={field.options ?? []}
                      onChange={v => entry.onUpdate({ [field.key]: v })}
                    />
                  );
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
// Service card — shown in right column per app
// ---------------------------------------------------------------------------
function ServiceCard({
  serviceId,
}: {
  serviceId: string;
}) {
  const { serviceRegistry } = useWorkspaceManager();
  const { catalog, records, history, executeAction, autoStartIds, toggleAutoStart } = serviceRegistry;
  const svc = catalog.find(s => s.id === serviceId);
  const record = records[serviceId];
  const status: ServiceStatus = record?.status ?? 'unknown';
  const svcHistory = history.filter(h => h.serviceId === serviceId).slice(0, 5);
  const isAutoStart = autoStartIds.includes(serviceId);

  // Track loading per action
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleAction = useCallback(async (action: 'start' | 'stop' | 'check' | 'install') => {
    setLoadingAction(action);
    try {
      await executeAction(serviceId, action);
    } finally {
      setLoadingAction(null);
    }
  }, [executeAction, serviceId]);

  return (
    <div className="rounded-lg border border-neutral-700/60 bg-neutral-900/40 overflow-hidden min-w-0">
      {/* Service header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 min-w-0">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${SVC_STATUS_COLORS[status]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-mono font-medium text-neutral-200">{svc?.name ?? serviceId}</span>
            {svc?.version && <span className="text-[10px] font-mono text-neutral-500">v{svc.version}</span>}
          </div>
          {svc?.description && (
            <div className="text-[10px] font-mono text-neutral-500 truncate">{svc.description}</div>
          )}
        </div>
        <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider flex-shrink-0">
          {SVC_STATUS_LABELS[status]}
        </span>
      </div>

      {/* Actions + details */}
      <div className="border-t border-neutral-700/40 px-3 py-2.5 space-y-2.5">
        <div className="flex gap-2 flex-wrap">
          {status !== 'running' && (
            <ServiceActionButton
              label="Start"
              loading={loadingAction === 'start'}
              onClick={() => handleAction('start')}
            />
          )}
          {status === 'running' && (
            <ServiceActionButton
              label="Stop"
              variant="danger"
              loading={loadingAction === 'stop'}
              onClick={() => handleAction('stop')}
            />
          )}
          <ServiceActionButton
            label="Check"
            variant="secondary"
            loading={loadingAction === 'check'}
            onClick={() => handleAction('check')}
          />
          {(status === 'not_installed' || status === 'unknown') && (
            <ServiceActionButton
              label="Install"
              variant="secondary"
              loading={loadingAction === 'install'}
              onClick={() => handleAction('install')}
            />
          )}
        </div>

        {/* Auto-start toggle */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-neutral-500">Auto-start</span>
          <button
            onClick={() => toggleAutoStart(serviceId)}
            className={`w-7 h-4 rounded-full relative transition-colors ${
              isAutoStart ? 'bg-emerald-600' : 'bg-neutral-700'
            }`}
            title={isAutoStart ? 'Disable auto-start' : 'Start automatically when app opens'}
          >
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
              isAutoStart ? 'left-[13px]' : 'left-0.5'
            }`} />
          </button>
        </div>

        {/* Detail grid */}
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px] font-mono">
          {record?.pid && (
            <>
              <span className="text-neutral-500">PID</span>
              <span className="text-neutral-300">{record.pid}</span>
            </>
          )}
          {svc?.check.port && (
            <>
              <span className="text-neutral-500">Port</span>
              <span className="text-neutral-300">{svc.check.port}</span>
            </>
          )}
          {svc?.check.healthUrl && (
            <>
              <span className="text-neutral-500">Health</span>
              <span className="text-neutral-300 truncate">{svc.check.healthUrl}</span>
            </>
          )}
          {record?.logFile && (
            <>
              <span className="text-neutral-500">Logs</span>
              <button
                onClick={() => navigator.clipboard.writeText(`tail -f ${record.logFile}`)}
                className="text-neutral-300 truncate text-left hover:text-cyan-400 transition-colors cursor-pointer"
                title={`Click to copy: tail -f ${record.logFile}`}
              >
                {record.logFile}
              </button>
            </>
          )}
          {record?.lastChecked && (
            <>
              <span className="text-neutral-500">Checked</span>
              <span className="text-neutral-300">{new Date(record.lastChecked).toLocaleTimeString()}</span>
            </>
          )}
        </div>

        {/* Error */}
        {record?.error && (
          <div className="text-[10px] font-mono text-red-400 bg-red-500/5 border border-red-500/20 rounded px-2 py-1.5 break-words">
            {record.error}
          </div>
        )}

        {/* Recent history */}
        {svcHistory.length > 0 && (
          <div>
            <div className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Recent</div>
            <div className="space-y-0.5">
              {svcHistory.map(h => (
                <div key={h.id} className="flex items-center gap-2 text-[10px] font-mono py-0.5">
                  <span className={`w-1 h-1 rounded-full flex-shrink-0 ${h.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="text-neutral-400">{h.action}</span>
                  {h.durationMs > 0 && <span className="text-neutral-600">{h.durationMs}ms</span>}
                  <span className="text-neutral-600 ml-auto flex-shrink-0">
                    {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
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
// App content — two-column: settings (left) + services (right)
// ---------------------------------------------------------------------------
function AppContent({ appId }: { appId: string }) {
  const {
    workspace,
    activatedAppIds,
    onToggleAppVisibility,
    appSettings,
  } = useWorkspaceManager();

  const config = workspace.apps.find(c => c.app.id === appId);
  if (!config) return null;

  const { app } = config;
  const isLoaded = activatedAppIds.has(appId);
  const entry = appSettings.find(e => e.appId === appId);
  const deps = app.services ?? [];
  const hasSettings = entry && entry.config.sections.length > 0;
  const hasServices = deps.length > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      {/* App header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-700/40 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-mono font-bold text-white tracking-wider">{app.name}</div>
          {app.description && (
            <div className="text-[11px] font-mono text-neutral-400 mt-0.5">{app.description}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
            {isLoaded ? 'Loaded' : 'Unloaded'}
          </span>
          <button
            onClick={() => onToggleAppVisibility(appId)}
            className={`w-9 h-5 rounded-full relative transition-colors ${
              isLoaded ? 'bg-emerald-600' : 'bg-neutral-700'
            }`}
            title={isLoaded ? 'Hide from workspace' : 'Show in workspace'}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              isLoaded ? 'left-[18px]' : 'left-0.5'
            }`} />
          </button>
        </div>
      </div>

      {/* Two-column content */}
      <div className="flex-1 overflow-y-auto frame-scrollbar">
        <div className={`grid gap-5 p-5 ${hasSettings && hasServices ? 'grid-cols-[1fr_1fr]' : 'grid-cols-1'}`}>
          {/* Left: Settings */}
          {hasSettings && entry && (
            <div className="min-w-0">
              <div className="text-[10px] font-mono text-neutral-300 tracking-widest uppercase mb-3">Settings</div>
              <AppSettingsInline entry={entry} />
            </div>
          )}

          {/* Right: Services */}
          {hasServices && (
            <div className="min-w-0">
              <div className="text-[10px] font-mono text-neutral-300 tracking-widest uppercase mb-3">Services</div>
              <div className="space-y-2">
                {deps.map(dep => (
                  <ServiceCard key={dep.serviceId} serviceId={dep.serviceId} />
                ))}
              </div>
            </div>
          )}

          {/* No settings, no services */}
          {!hasSettings && !hasServices && (
            <div className="text-[11px] font-mono text-neutral-600 py-8 text-center">
              No settings or services configured for this app.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkspaceManagerPanel — the modal overlay
// ---------------------------------------------------------------------------
export function WorkspaceManagerPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { workspace, activatedAppIds, focusedAppId, serviceRegistry } = useWorkspaceManager();
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  // Auto-select the currently focused app when opening, fallback to first app
  useEffect(() => {
    if (isOpen && workspace.apps.length > 0) {
      const target = workspace.apps.find(c => c.app.id === focusedAppId)
        ? focusedAppId
        : workspace.apps[0].app.id;
      setSelectedAppId(target);
    }
  }, [isOpen, workspace.apps, focusedAppId]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[6vh] bg-black/60 backdrop-blur-[2px] pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="w-[960px] max-w-[92vw] bg-[#161616] border border-neutral-700 shadow-2xl rounded-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-700 shrink-0">
          <div className="flex items-center gap-2">
            <SettingsIcon size={14} className="text-emerald-400" />
            <span className="text-[13px] font-mono font-bold text-white tracking-wider">WORKSPACE MANAGER</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors text-neutral-400 hover:text-white">
            <X size={14} />
          </button>
        </div>

        {/* Body: app rail + content */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left rail — vertical app tabs */}
          <div className="w-[120px] shrink-0 border-r border-neutral-700/50 overflow-y-auto frame-scrollbar bg-neutral-900/30">
            <div className="py-2">
              {workspace.apps.map(config => {
                const { app } = config;
                const isActive = selectedAppId === app.id;
                const isLoaded = activatedAppIds.has(app.id);
                const deps = app.services ?? [];

                // Service health dots
                const depStatuses = deps.map(dep => {
                  const status: ServiceStatus = serviceRegistry.records[dep.serviceId]?.status ?? 'unknown';
                  return { serviceId: dep.serviceId, status };
                });

                return (
                  <button
                    key={app.id}
                    onClick={() => setSelectedAppId(app.id)}
                    className={`w-full text-left px-3 py-2.5 transition-colors relative ${
                      isActive
                        ? 'bg-white/[0.04]'
                        : 'hover:bg-white/[0.02]'
                    } ${!isLoaded ? 'opacity-40' : ''}`}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-emerald-500 rounded-r" />
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-mono font-medium truncate ${isActive ? 'text-emerald-400' : 'text-neutral-300'}`}>
                        {app.name}
                      </span>
                      {depStatuses.length > 0 && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          {depStatuses.map(d => (
                            <div
                              key={d.serviceId}
                              className={`w-1.5 h-1.5 rounded-full ${SVC_STATUS_COLORS[d.status]}`}
                              title={`${d.serviceId}: ${SVC_STATUS_LABELS[d.status]}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right content area */}
          {selectedAppId ? (
            <AppContent appId={selectedAppId} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-[11px] font-mono text-neutral-600">
              Select an app from the sidebar
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-neutral-800/90 backdrop-blur-sm border-t border-neutral-700 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-neutral-300">Workspace Manager</span>
            <div className="px-1.5 py-0.5 rounded bg-neutral-700 border border-neutral-700 text-[11px] text-neutral-200 font-mono">&#8984;&#8679;,</div>
          </div>
        </div>
      </div>
    </div>
  );
}
