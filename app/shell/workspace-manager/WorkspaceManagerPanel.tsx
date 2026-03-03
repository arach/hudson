'use client';

import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronRight, Settings as SettingsIcon } from 'lucide-react';
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
// App card — one per workspace app
// ---------------------------------------------------------------------------
function AppCard({ appId }: { appId: string }) {
  const {
    workspace,
    activatedAppIds,
    onToggleAppVisibility,
    serviceRegistry,
    appSettings,
  } = useWorkspaceManager();

  const config = workspace.apps.find(c => c.app.id === appId);
  if (!config) return null;

  const { app } = config;
  const isLoaded = activatedAppIds.has(appId);
  const entry = appSettings.find(e => e.appId === appId);
  const deps = app.services ?? [];

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  // Service health dots for this app
  const depStatuses = deps.map(dep => {
    const status: ServiceStatus = serviceRegistry.records[dep.serviceId]?.status ?? 'unknown';
    return { serviceId: dep.serviceId, status };
  });

  return (
    <div className={`rounded-lg border overflow-hidden transition-opacity ${
      isLoaded
        ? 'border-neutral-700/60 bg-neutral-900/40'
        : 'border-neutral-700/30 bg-neutral-900/20 opacity-50'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-mono font-medium text-neutral-200">{app.name}</span>
            {depStatuses.length > 0 && (
              <div className="flex items-center gap-1">
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
          {app.description && (
            <div className="text-[10px] font-mono text-neutral-500 mt-0.5 truncate">{app.description}</div>
          )}
        </div>

        {/* Loaded toggle */}
        <button
          onClick={() => onToggleAppVisibility(appId)}
          className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${
            isLoaded ? 'bg-emerald-600' : 'bg-neutral-700'
          }`}
          title={isLoaded ? 'Hide from workspace' : 'Show in workspace'}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            isLoaded ? 'left-[18px]' : 'left-0.5'
          }`} />
        </button>
      </div>

      {/* Expandable sections */}
      {isLoaded && (
        <div className="border-t border-neutral-700/30">
          {/* Settings accordion */}
          {entry && entry.config.sections.length > 0 && (
            <div className="border-b border-neutral-700/20">
              <button
                onClick={() => setSettingsOpen(o => !o)}
                className="w-full flex items-center gap-2 px-4 py-2 text-left text-[11px] font-mono text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                {settingsOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                <span>Settings ({entry.config.sections.length} {entry.config.sections.length === 1 ? 'section' : 'sections'})</span>
              </button>
              {settingsOpen && (
                <div className="px-4 pb-3">
                  <AppSettingsInline entry={entry} />
                </div>
              )}
            </div>
          )}

          {/* Services accordion */}
          {deps.length > 0 && (
            <div>
              <button
                onClick={() => setServicesOpen(o => !o)}
                className="w-full flex items-center gap-2 px-4 py-2 text-left text-[11px] font-mono text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                {servicesOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                <span>Services ({deps.length})</span>
              </button>
              {servicesOpen && (
                <div className="px-4 pb-3 space-y-2">
                  {deps.map(dep => {
                    const svc = serviceRegistry.catalog.find(s => s.id === dep.serviceId);
                    const status: ServiceStatus = serviceRegistry.records[dep.serviceId]?.status ?? 'unknown';
                    return (
                      <div key={dep.serviceId} className="flex items-center gap-2 text-[11px] font-mono">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SVC_STATUS_COLORS[status]}`} />
                        <span className="text-neutral-300 flex-1">{svc?.name ?? dep.serviceId}</span>
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{SVC_STATUS_LABELS[status]}</span>
                        {status !== 'running' && (
                          <ServiceActionButton label="Start" onClick={() => serviceRegistry.executeAction(dep.serviceId, 'start')} />
                        )}
                        <ServiceActionButton label="Check" variant="secondary" onClick={() => serviceRegistry.executeAction(dep.serviceId, 'check')} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* No settings / no services hint */}
          {(!entry || entry.config.sections.length === 0) && deps.length === 0 && (
            <div className="px-4 py-2 text-[10px] font-mono text-neutral-600">
              No settings &middot; No services
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline app settings renderer
// ---------------------------------------------------------------------------
function AppSettingsInline({ entry }: { entry: AppSettingsEntry }) {
  return (
    <div className="space-y-4">
      {entry.config.sections.map(section => (
        <div key={section.label}>
          <div className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest mb-2">{section.label}</div>
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
// Global services section
// ---------------------------------------------------------------------------
function GlobalServicesSection() {
  const { serviceRegistry } = useWorkspaceManager();
  const { catalog, records, history, executeAction } = serviceRegistry;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (catalog.length === 0) return null;

  return (
    <div className="px-6 py-4 border-b border-neutral-700/50">
      <div className="text-[10px] font-mono text-neutral-300 tracking-widest uppercase mb-4">Services</div>
      <div className="space-y-2">
        {catalog.map(svc => {
          const record = records[svc.id];
          const status: ServiceStatus = record?.status ?? 'unknown';
          const isExpanded = expandedId === svc.id;
          const svcHistory = history.filter(h => h.serviceId === svc.id).slice(0, 10);

          return (
            <div key={svc.id} className="rounded border border-neutral-700/60 bg-neutral-900/40 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : svc.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${SVC_STATUS_COLORS[status]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-mono font-medium text-neutral-200">{svc.name}</span>
                    {svc.version && <span className="text-[10px] font-mono text-neutral-500">v{svc.version}</span>}
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 truncate">{svc.description}</div>
                </div>
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider flex-shrink-0">
                  {SVC_STATUS_LABELS[status]}
                </span>
                {isExpanded ? <ChevronDown size={12} className="text-neutral-500" /> : <ChevronRight size={12} className="text-neutral-500" />}
              </button>

              {isExpanded && (
                <div className="border-t border-neutral-700/40 px-3 py-3 space-y-3">
                  <div className="flex gap-2">
                    {status !== 'running' && (
                      <ServiceActionButton label="Start" onClick={() => executeAction(svc.id, 'start')} />
                    )}
                    {status === 'running' && (
                      <ServiceActionButton label="Stop" variant="danger" onClick={() => executeAction(svc.id, 'stop')} />
                    )}
                    <ServiceActionButton label="Check" variant="secondary" onClick={() => executeAction(svc.id, 'check')} />
                    {(status === 'not_installed' || status === 'unknown') && (
                      <ServiceActionButton label="Install" variant="secondary" onClick={() => executeAction(svc.id, 'install')} />
                    )}
                  </div>

                  <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px] font-mono">
                    {record?.pid && (
                      <>
                        <span className="text-neutral-500">PID</span>
                        <span className="text-neutral-300">{record.pid}</span>
                      </>
                    )}
                    {svc.check.port && (
                      <>
                        <span className="text-neutral-500">Port</span>
                        <span className="text-neutral-300">{svc.check.port}</span>
                      </>
                    )}
                    {svc.check.healthUrl && (
                      <>
                        <span className="text-neutral-500">Health</span>
                        <span className="text-neutral-300 truncate">{svc.check.healthUrl}</span>
                      </>
                    )}
                    {record?.lastChecked && (
                      <>
                        <span className="text-neutral-500">Checked</span>
                        <span className="text-neutral-300">{new Date(record.lastChecked).toLocaleTimeString()}</span>
                      </>
                    )}
                  </div>

                  {record?.error && (
                    <div className="text-[10px] font-mono text-red-400 bg-red-500/5 border border-red-500/20 rounded px-2 py-1.5 break-words">
                      {record.error}
                    </div>
                  )}

                  {svcHistory.length > 0 && (
                    <div>
                      <div className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest mb-1.5">Recent</div>
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
              )}
            </div>
          );
        })}
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
  const { workspace } = useWorkspaceManager();

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
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[8vh] bg-black/60 backdrop-blur-[2px] pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="w-[560px] max-w-[90vw] bg-[#161616] border border-neutral-700 shadow-2xl rounded-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
        style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700 shrink-0">
          <div className="flex items-center gap-2">
            <SettingsIcon size={14} className="text-emerald-400" />
            <span className="text-[13px] font-mono font-bold text-white tracking-wider">WORKSPACE MANAGER</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors text-neutral-400 hover:text-white">
            <X size={14} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 frame-scrollbar">
          {/* Apps section */}
          <div className="px-6 py-4 border-b border-neutral-700/50">
            <div className="text-[10px] font-mono text-neutral-300 tracking-widest uppercase mb-4">Apps</div>
            <div className="space-y-2">
              {workspace.apps.map(config => (
                <AppCard key={config.app.id} appId={config.app.id} />
              ))}
            </div>
          </div>

          {/* Global services section */}
          <GlobalServicesSection />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-800/90 backdrop-blur-sm border-t border-neutral-700 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-neutral-300">Workspace Manager</span>
            <div className="px-1.5 py-0.5 rounded bg-neutral-700 border border-neutral-700 text-[11px] text-neutral-200 font-mono">&#8984;&#8679;,</div>
          </div>
        </div>
      </div>
    </div>
  );
}
