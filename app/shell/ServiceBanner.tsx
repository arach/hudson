'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useServiceRegistryContext } from '../services/ServiceRegistryContext';
import type { WorkspaceAppConfig } from 'hudsonkit';

export function ServiceBanner({
  appConfig,
  onOpenServices,
  children,
}: {
  appConfig: WorkspaceAppConfig;
  onOpenServices: () => void;
  children: React.ReactNode;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const registry = useServiceRegistryContext();

  const deps = appConfig.app.services;
  if (!deps || deps.length === 0) return <>{children}</>;

  const missing = deps.filter(dep => {
    if (dep.optional === true) return false;
    if (dismissed.has(dep.serviceId)) return false;
    const status = registry.records[dep.serviceId]?.status;
    return status !== 'running';
  });

  if (missing.length === 0) return <>{children}</>;

  return (
    <div className="flex flex-col h-full">
      {missing.map(dep => {
        const svc = registry.catalog.find(s => s.id === dep.serviceId);
        const name = svc?.name ?? dep.serviceId;
        const isOptional = dep.optional === true;

        return (
          <div
            key={dep.serviceId}
            className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono shrink-0 ${
              isOptional
                ? 'bg-neutral-800/80 border-b border-neutral-700/50 text-neutral-400'
                : 'bg-amber-950/40 border-b border-amber-800/30 text-amber-200/90'
            }`}
          >
            <AlertTriangle size={12} className={isOptional ? 'text-neutral-500' : 'text-amber-500/80'} />
            <span className="flex-1 truncate">
              {name} is not running{dep.reason ? ` \u2014 ${dep.reason}` : ''}
            </span>
            <button
              onClick={onOpenServices}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                isOptional
                  ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                  : 'bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 border border-amber-500/20'
              }`}
            >
              Set Up
            </button>
            <button
              onClick={() => setDismissed(prev => new Set([...prev, dep.serviceId]))}
              className="p-0.5 rounded hover:bg-white/10 transition-colors text-neutral-500 hover:text-neutral-300"
              title="Dismiss"
            >
              <X size={10} />
            </button>
          </div>
        );
      })}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
