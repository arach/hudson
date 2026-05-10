'use client';

import { useMemo, type ReactNode } from 'react';
import { useHudsonAIRuntime } from '../../shell/HudsonAIRuntimeContext';
import { useHudsonAIApp } from './HudsonAIProvider';

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-[10px] font-mono text-muted-foreground">{label}</span>
      <span className="text-[11px] text-right text-foreground/72">{value}</span>
    </div>
  );
}

export function HudsonAIInspector() {
  const { toolContext } = useHudsonAIRuntime();
  const { resolvedModel, resolvedProvider } = useHudsonAIApp();

  const commandCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const command of toolContext.commands) {
      if (command.appId) {
        counts.set(command.appId, (counts.get(command.appId) ?? 0) + 1);
      }
    }
    return counts;
  }, [toolContext.commands]);

  const settingsCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of toolContext.appSettings) {
      const total = entry.sections.reduce((sum, section) => sum + section.fields.length, 0);
      counts.set(entry.appId, total);
    }
    return counts;
  }, [toolContext.appSettings]);

  return (
    <div className="h-full min-h-0 overflow-y-auto frame-scrollbar p-3 space-y-4">
      <div className="rounded-xl border border-border/70 bg-card/72 p-3">
        <SectionTitle>Runtime</SectionTitle>
        <div className="mt-2 divide-y divide-border/60">
          <DetailRow label="Workspace" value={toolContext.workspace.name} />
          <DetailRow label="Provider" value={resolvedProvider} />
          <DetailRow label="Model" value={resolvedModel} />
          <DetailRow label="Apps" value={toolContext.apps.length} />
          <DetailRow label="Intents" value={toolContext.intents.length} />
          <DetailRow label="Commands" value={toolContext.commands.length} />
          <DetailRow label="App Settings" value={toolContext.appSettings.length} />
          <DetailRow label="Services" value={toolContext.services.length} />
          <DetailRow label="Pipes" value={toolContext.pipes.length} />
        </div>
      </div>

      <div className="space-y-2">
        <SectionTitle>Construction</SectionTitle>
        <div className="space-y-2">
          <div className="rounded-xl border border-border/60 bg-background/52 px-3 py-2">
            <div className="text-[11px] font-medium text-foreground/76">Intent Index</div>
            <div className="mt-1 text-[10px] leading-relaxed text-foreground/62">
              {toolContext.intents.length} intents are indexed from shell + workspace apps, then mapped back to live command IDs for execution.
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/52 px-3 py-2">
            <div className="text-[11px] font-medium text-foreground/76">Command Bridge</div>
            <div className="mt-1 text-[10px] leading-relaxed text-foreground/62">
              {toolContext.commands.length} commands are live callable actions gathered from shell, services, and app hooks.
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/52 px-3 py-2">
            <div className="text-[11px] font-medium text-foreground/76">Settings Bridge</div>
            <div className="mt-1 text-[10px] leading-relaxed text-foreground/62">
              {toolContext.appSettings.length} app settings surfaces are available to the assistant alongside shell settings and environment controls.
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <SectionTitle>Capability Map</SectionTitle>
        <div className="space-y-2">
          {toolContext.apps.map(app => {
            const inputCount = app.ports?.inputs?.length ?? 0;
            const outputCount = app.ports?.outputs?.length ?? 0;
            const visibleLabel = app.visible ? 'Visible' : 'Hidden';
            const focusLabel = app.focused ? 'Focused' : app.disabled ? 'Disabled' : 'Ready';

            return (
              <div
                key={app.id}
                className="rounded-xl border border-border/70 bg-card/72 p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-foreground/86">{app.name}</div>
                    <div className="truncate text-[10px] font-mono text-muted-foreground">{app.id}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="rounded-full border border-border/70 px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground">
                      {visibleLabel}
                    </span>
                    <span className="rounded-full border border-cyan-700/30 dark:border-cyan-500/20 bg-cyan-700/10 dark:bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-mono text-cyan-700 dark:text-cyan-300/80">
                      {focusLabel}
                    </span>
                  </div>
                </div>

                {app.description && (
                  <div className="text-[10px] leading-relaxed text-foreground/62">
                    {app.description}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="rounded-lg border border-border/60 bg-background/52 px-2 py-2">
                    <div className="text-muted-foreground">Commands</div>
                    <div className="mt-1 text-[13px] text-foreground/78">{commandCounts.get(app.id) ?? 0}</div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/52 px-2 py-2">
                    <div className="text-muted-foreground">Settings</div>
                    <div className="mt-1 text-[13px] text-foreground/78">{settingsCounts.get(app.id) ?? 0}</div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/52 px-2 py-2">
                    <div className="text-muted-foreground">Inputs</div>
                    <div className="mt-1 text-[13px] text-foreground/78">{inputCount}</div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/52 px-2 py-2">
                    <div className="text-muted-foreground">Outputs</div>
                    <div className="mt-1 text-[13px] text-foreground/78">{outputCount}</div>
                  </div>
                </div>

                {(app.tools.length > 0 || app.activeToolHint || app.status) && (
                  <div className="space-y-1 text-[10px] leading-relaxed text-foreground/62">
                    {app.tools.length > 0 && (
                      <div>Tools: {app.tools.map(tool => tool.name).join(', ')}</div>
                    )}
                    {app.activeToolHint && (
                      <div>Active tool hint: {app.activeToolHint}</div>
                    )}
                    {app.status && (
                      <div>Status: {app.status.label} ({app.status.color})</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {toolContext.intents.length > 0 && (
        <div className="space-y-2">
          <SectionTitle>Intent Samples</SectionTitle>
          <div className="space-y-2">
            {toolContext.intents.slice(0, 10).map(intent => (
              <div
                key={`${intent.appId}:${intent.commandId}`}
                className="rounded-xl border border-border/60 bg-background/52 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-medium text-foreground/76">{intent.title}</div>
                  <div className="text-[10px] font-mono text-cyan-700 dark:text-cyan-300/75">{intent.category}</div>
                </div>
                <div className="mt-1 text-[10px] text-foreground/62">
                  {intent.appName} • {intent.commandId}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(toolContext.services.length > 0 || toolContext.pipes.length > 0) && (
        <div className="space-y-4">
          {toolContext.services.length > 0 && (
            <div className="space-y-2">
              <SectionTitle>Services</SectionTitle>
              <div className="space-y-2">
                {toolContext.services.map(service => (
                  <div
                    key={service.id}
                    className="rounded-xl border border-border/60 bg-background/52 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-medium text-foreground/76">{service.name}</div>
                      <div className="text-[10px] font-mono text-cyan-700 dark:text-cyan-300/75">{service.status}</div>
                    </div>
                    {service.description && (
                      <div className="mt-1 text-[10px] text-foreground/62">{service.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {toolContext.pipes.length > 0 && (
            <div className="space-y-2">
              <SectionTitle>Pipes</SectionTitle>
              <div className="space-y-2">
                {toolContext.pipes.map(pipe => (
                  <div
                    key={pipe.id}
                    className="rounded-xl border border-border/60 bg-background/52 px-3 py-2"
                  >
                    <div className="text-[11px] font-medium text-foreground/76">{pipe.name}</div>
                    <div className="mt-1 text-[10px] font-mono text-foreground/62">
                      {pipe.source.appId}.{pipe.source.portId} -&gt; {pipe.sink.appId}.{pipe.sink.portId}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
