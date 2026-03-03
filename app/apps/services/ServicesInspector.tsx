'use client';

import { useServices } from './ServicesProvider';
import type { ServiceStatus } from '@hudson/sdk';

const STATUS_LABELS: Record<ServiceStatus, string> = {
  unknown: 'Unknown',
  not_installed: 'Not Running',
  installed: 'Installed',
  running: 'Running',
  error: 'Error',
};

export function ServicesInspector() {
  const { catalog, records, history, selectedId } = useServices();

  const svc = catalog.find((s) => s.id === selectedId);
  if (!svc) {
    return (
      <div className="p-3 text-xs text-neutral-600">Select a service to inspect</div>
    );
  }

  const record = records[svc.id];
  const status: ServiceStatus = record?.status ?? 'unknown';
  const svcHistory = history.filter((h) => h.serviceId === svc.id).slice(0, 20);

  return (
    <div className="p-3 space-y-4 text-xs">
      {/* Header */}
      <div>
        <div className="text-neutral-200 font-medium mb-1">{svc.name}</div>
        <p className="text-neutral-500">{svc.description}</p>
      </div>

      {/* Details */}
      <div className="space-y-1.5">
        <DetailRow label="Status" value={STATUS_LABELS[status]} />
        {svc.version && <DetailRow label="Version" value={svc.version} />}
        {record?.pid && <DetailRow label="PID" value={String(record.pid)} />}
        {svc.check.port && <DetailRow label="Port" value={String(svc.check.port)} />}
        {svc.check.healthUrl && <DetailRow label="Health" value={svc.check.healthUrl} />}
        {record?.lastChecked && (
          <DetailRow label="Last Checked" value={formatTime(record.lastChecked)} />
        )}
      </div>

      {/* Action History */}
      {svcHistory.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-600 mb-2">
            Recent Actions
          </div>
          <div className="space-y-1">
            {svcHistory.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-2 py-1 border-b border-neutral-800/50 last:border-0"
              >
                <span
                  className={`w-1 h-1 rounded-full flex-shrink-0 ${
                    entry.success ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
                <span className="text-neutral-400 flex-1 truncate">
                  {entry.action}
                  {entry.triggeredBy !== 'user' && (
                    <span className="text-neutral-600"> ({entry.triggeredBy})</span>
                  )}
                </span>
                <span className="text-neutral-600 tabular-nums flex-shrink-0">
                  {formatTime(entry.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-neutral-600">{label}</span>
      <span className="text-neutral-400 font-mono truncate">{value}</span>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
