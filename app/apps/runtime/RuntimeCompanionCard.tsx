'use client';

import { RuntimeIcon } from './RuntimeIcon';
import { useRuntime } from './RuntimeProvider';
import { ActionButton, PanelShell, StatusPill } from './components';
import { resolveRuntimeProfile } from '@/app/lib/runtime/paths';

export function RuntimeCompanionCard() {
  const { phase, status, error, launchCompanion, launching, refresh, profileId } = useRuntime();
  const online = phase === 'online' && status?.online;
  const tone = online ? 'online' : phase === 'checking' ? 'checking' : 'offline';
  const profile = resolveRuntimeProfile(profileId);
  const profileLabel = status?.profileLabel ?? profile.label;
  const workspaceID = status?.workspaceID ?? '—';
  const environmentLabel = `LOCAL DEV · ${workspaceID} · ${profileLabel}`;

  return (
    <PanelShell className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
          <RuntimeIcon size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium text-foreground/90">Native companion</h2>
            <StatusPill tone={tone} label={online ? 'online' : phase === 'checking' ? 'checking' : 'offline'} />
          </div>

          <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
            {environmentLabel}
          </p>

          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {online
              ? 'The macOS host owns tmux sessions and terminal renderers. Hudson mirrors node status through the JSONL control lane.'
              : 'Launch the Runtime app to bring the spatial canvas online, then return here to inspect nodes and send commands.'}
          </p>

          {(status?.profileLabel || status?.latencyMs != null) && (
            <p className="mt-2 font-mono text-[10px] text-muted-foreground/75 tabular-nums">
              {status?.profileLabel}
              {status?.latencyMs != null ? ` · ${status.latencyMs}ms` : ''}
              {status?.nodeCount != null ? ` · ${status.nodeCount} nodes` : ''}
            </p>
          )}

          {error && (
            <p className="mt-2 text-[11px] leading-snug text-red-400 break-words">{error}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {!online && (
              <ActionButton
                label={launching ? 'Launching…' : 'Launch companion'}
                onClick={() => void launchCompanion()}
              />
            )}
            <ActionButton label="Recheck" variant="secondary" onClick={() => void refresh()} />
          </div>
        </div>
      </div>
    </PanelShell>
  );
}
