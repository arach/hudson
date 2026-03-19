'use client';

import { useMemo, useCallback } from 'react';
import { useTerminalRelay, TerminalRelay, usePlatform } from '@hudson/sdk';
import type { HudsonWorkspace, IntentCatalog } from '@hudson/sdk';
import { useDataBus } from './DataBusContext';
import type { PortCatalogEntry } from './DataBusContext';
import type { PipeDefinition } from '@hudson/sdk';

// ---------------------------------------------------------------------------
// System prompt — workspace-aware Hudson OS assistant
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

  return `You are the Hudson OS terminal — the system-level assistant for this workspace.
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
- Create pipes by POSTing to /api/pipes with { pipe: { name, source: {appId, portId}, sink: {appId, portId}, enabled: true } }
- Delete pipes: POST /api/pipes with { action: "delete", pipe: { id: "..." } }
- Pipes are stored as JSON files in .data/pipes/

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

const WORKSPACE_CLAUDE = `# Hudson OS Workspace

This is the Hudson OS workspace directory. You are the system-level assistant helping the user work across all loaded apps and general workspace tasks.

## What You Can Do
- Help with any loaded app (see your system prompt for the full list)
- Run shell commands, manage files, and automate workflows
- Navigate between apps using intents and commands
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface HudsonTerminalProps {
  workspace: HudsonWorkspace;
  catalog: IntentCatalog;
}

export function HudsonTerminal({ workspace, catalog }: HudsonTerminalProps) {
  const { serviceApiUrl } = usePlatform();
  const { getPortCatalog, pipes } = useDataBus();

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
    try {
      const res = await fetch(`${serviceApiUrl}/api/services/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: 'relay', action: 'start', triggeredBy: 'user' }),
      });
      const data = await res.json();
      return data.success === true;
    } catch {
      return false;
    }
  }, [serviceApiUrl]);

  const openSettings = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: ',',
      metaKey: true,
      shiftKey: true,
      bubbles: true,
    }));
  }, []);

  return (
    <TerminalRelay
      relay={relay}
      configItems={configItems}
      onOpenSettings={openSettings}
      onStartService={handleStartRelay}
    />
  );
}
