'use client';

import { useServices } from './ServicesProvider';
import type { ServiceStatus } from '@hudson/sdk';

const DOT_COLORS: Record<ServiceStatus, string> = {
  unknown: 'bg-neutral-600',
  not_installed: 'bg-neutral-500',
  installed: 'bg-amber-500',
  running: 'bg-emerald-500',
  error: 'bg-red-500',
};

export function ServicesLeftPanel() {
  const { catalog, records, selectedId, setSelectedId } = useServices();

  return (
    <div className="py-1">
      {catalog.map((svc) => {
        const status: ServiceStatus = records[svc.id]?.status ?? 'unknown';
        const isSelected = selectedId === svc.id;

        return (
          <button
            key={svc.id}
            type="button"
            onClick={() => setSelectedId(svc.id)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
              isSelected
                ? 'bg-white/5 text-neutral-200'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02]'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT_COLORS[status]}`} />
            <span className="text-xs truncate">{svc.name}</span>
          </button>
        );
      })}
    </div>
  );
}
