'use client';

import { useMemo, useCallback, useState } from 'react';
import { useTerminalRelay, TerminalRelay, usePlatform } from '../../index';
import type { HudsonWorkspace, IntentCatalog } from '../../index';
import { useDataBus } from '../context/DataBusContext';
import type { PortCatalogEntry } from '../context/DataBusContext';
import type { PipeDefinition } from '../../index';
import { Cloud, TerminalSquare } from '../../icons';
import { useWorkspaceHostRoutes } from '../hostRoutes';

// ---------------------------------------------------------------------------
// System prompt — workspace-aware HudsonKit assistant
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  workspace: HudsonWorkspace,
  catalog: IntentCatalog,
  portCatalog: PortCatalogEntry[],
  pipes: PipeDefinition[],
): string {
  const appSections = catalog.apps.map(app => {
    const intentLines = app.intents.map(i => {
      const params = i.params?.map(p => `${p.name}: ${p.type}`).join(', ') ?? '';
      return `  - ${i.commandId}: ${i.description}${params ? ` (${params})` : ''}`;
    });
    return `### ${app.appName}\n${app.appDescription}\n${intentLines.join('\n')}`;
  });

  return `You are the HudsonKit terminal — the system-level assistant for this workspace.
You can help with any loaded app or general workspace tasks.

## Workspace: ${workspace.name}
${workspace.description ?? ''}

## Loaded Apps
${appSections.join('\n\n')}

## Shell Commands
- Toggle Terminal (Ctrl+\`): Show/hide terminal drawer
- Command Palette (Cmd+K): Open command palette
- Toggle Left Panel (Cmd+[): Show/hide left panel
- Toggle Right Panel (Cmd+]): Show/hide right panel
- Zoom to Fit (Cmd+0): Reset canvas view

## Data Ports
${portCatalog.length === 0 ? 'No apps declare ports.' : portCatalog.map(entry => {
    const outs = entry.outputs.map(o => `  OUT ${o.id} (${o.dataType}): ${o.name}${o.description ? ' — ' + o.description : ''}`);
    const ins = entry.inputs.map(i => `  IN  ${i.id} (${i.dataType}): ${i.name}${i.description ? ' — ' + i.description : ''}`);
    return `### ${entry.appName} (${entry.appId})\n${[...outs, ...ins].join('\n')}`;
  }).join('\n\n')}

## Active Pipes
${pipes.length === 0 ? 'No pipes configured.' : pipes.map(p =>
    `- ${p.name}: ${p.source.appId}.${p.source.portId} → ${p.sink.appId}.${p.sink.portId} (${p.enabled ? 'enabled' : 'disabled'})`
  ).join('\n')}

## Pipe Management
- Create pipes by using the workspace pipe UI or the host-provided pipe route when available.
- Delete pipes through the workspace pipe UI or host-provided pipe route when available.
- Pipe persistence is owned by the host application.

## Guidelines
- You are the global workspace assistant, not tied to any single app
- Help the user navigate between apps, run commands, and manage their workspace
- When asked about a specific app, use context from the loaded apps above
- You can help users pipe data between apps by creating and managing pipes
- Be concise and action-oriented`;
}

// ---------------------------------------------------------------------------
// CLAUDE.md for the workspace directory
// ---------------------------------------------------------------------------

const WORKSPACE_CLAUDE = `# HudsonKit Workspace

This is the HudsonKit workspace directory. You are the system-level assistant helping the user work across all loaded apps and general workspace tasks.

## What You Can Do
- Help with any loaded app (see your system prompt for the full list)
- Run shell commands, manage files, and automate workflows
- Navigate between apps using intents and commands
`;

function isHostedBrowserDemo() {
  if (typeof window === 'undefined') return false;
  return !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
}

function HostedTerminalNotice() {
  return (
    <div className="flex h-full items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-md rounded-lg border border-border bg-card p-5 shadow-2xl">
        <div className="mb-3 flex items-center gap-2 text-cyan-700 dark:text-cyan-300">
          <Cloud size={14} />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em]">Hosted Console</span>
        </div>
        <div className="text-sm font-medium text-foreground">AI console is live on Workers AI.</div>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
          Interactive terminal sessions need a sandboxed PTY backend. The local Hudson Relay is available in local and native builds; the hosted demo keeps this tab read-only until a Cloudflare sandbox backend is attached.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded border border-border bg-muted/55 px-3 py-2 font-mono text-[11px] text-muted-foreground">
          <TerminalSquare size={12} />
          <span>terminal backend: local relay or hosted sandbox</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface HudsonTerminalProps {
  workspace: HudsonWorkspace;
  catalog: IntentCatalog;
}

export function HudsonTerminal({ workspace, catalog }: HudsonTerminalProps) {
  const { serviceApiUrl } = usePlatform();
  const routes = useWorkspaceHostRoutes();
  const { getPortCatalog, pipes } = useDataBus();
  const [hostedDemo] = useState(() => isHostedBrowserDemo());

  const portCatalog = useMemo(() => getPortCatalog(), [getPortCatalog]);

  const systemPrompt = useMemo(
    () => buildSystemPrompt(workspace, catalog, portCatalog, pipes),
    [workspace, catalog, portCatalog, pipes],
  );

  const workspaceFiles = useMemo(() => ({
    'CLAUDE.md': WORKSPACE_CLAUDE,
  }), []);

  const relay = useTerminalRelay({
    url: 'ws://localhost:3600',
    systemPrompt,
    cwd: '~/hudson',
    workspaceFiles,
    sessionKey: 'hudson-terminal',
  });
  const configItems = useMemo(() => [
    { label: 'Relay', value: 'ws://localhost:3600' },
    { label: 'CWD', value: '~/hudson' },
  ], []);

  const handleStartRelay = useCallback(async (): Promise<boolean> => {
    if (!routes.serviceExecute) return false;
    try {
      const res = await fetch(`${serviceApiUrl}${routes.serviceExecute}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: 'relay', action: 'start', triggeredBy: 'user' }),
      });
      const data = await res.json();
      return data.success === true;
    } catch {
      return false;
    }
  }, [routes.serviceExecute, serviceApiUrl]);

  const openSettings = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: ',',
      metaKey: true,
      shiftKey: true,
      bubbles: true,
    }));
  }, []);

  if (hostedDemo) {
    return <HostedTerminalNotice />;
  }

  return (
    <TerminalRelay
      relay={relay}
      configItems={configItems}
      onOpenSettings={openSettings}
      onStartService={handleStartRelay}
    />
  );
}
