'use client';

import { useServices } from './ServicesProvider';
import type { ServiceStatus } from 'hudsonkit';

const DOT_COLORS: Record<ServiceStatus, string> = {
  unknown: 'bg-muted-foreground/50',
  not_installed: 'bg-muted-foreground',
  installed: 'bg-warning',
  running: 'bg-success',
  error: 'bg-destructive',
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
                ? 'bg-muted/60 text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
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
