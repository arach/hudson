'use client';

import { useServices } from './ServicesProvider';

export function ServicesTerminal() {
  const { history, selectedId } = useServices();

  const lastAction = selectedId
    ? history.find((h) => h.serviceId === selectedId)
    : history[0];

  if (!lastAction) {
    return (
      <div className="p-3 text-xs text-neutral-600 font-mono">No actions yet</div>
    );
  }

  return (
    <div className="p-3 font-mono text-[11px] space-y-2">
      {/* Command header */}
      <div className="flex items-center gap-2 text-neutral-500">
        <span className="text-cyan-500">$</span>
        <span>{lastAction.command ?? `${lastAction.action} ${lastAction.serviceId}`}</span>
        {lastAction.exitCode != null && (
          <span
            className={`ml-auto ${
              lastAction.exitCode === 0 ? 'text-emerald-500' : 'text-red-500'
            }`}
          >
            exit {lastAction.exitCode}
          </span>
        )}
        {lastAction.exitCode == null && (
          <span className={`ml-auto ${lastAction.success ? 'text-emerald-500' : 'text-red-500'}`}>
            {lastAction.success ? 'ok' : 'fail'}
          </span>
        )}
      </div>

      {/* Output */}
      {lastAction.output && (
        <pre className="text-neutral-400 whitespace-pre-wrap break-words max-h-40 overflow-y-auto leading-relaxed">
          {lastAction.output}
        </pre>
      )}

      {/* Duration */}
      <div className="text-neutral-600 text-[10px]">
        {new Date(lastAction.timestamp).toLocaleTimeString()} — {lastAction.durationMs}ms
      </div>
    </div>
  );
}
