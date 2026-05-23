'use client';

import { useVantage } from './VantageProvider';
import { ActionButton, EmptyPanel, InspectorRow, PanelShell, SectionLabel } from './components';

export function VantageInspector() {
  const { selectedNode, status, sendAction, selectedNodeId } = useVantage();

  if (!selectedNode) {
    return (
      <div className="p-4">
        <EmptyPanel
          title="No node selected"
          subtitle="Choose a runtime node to inspect metadata and send focus commands."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/50 p-4">
        <SectionLabel label="Inspector" />
        <h3 className="px-2.5 text-sm font-medium text-foreground/90">{selectedNode.title ?? 'Untitled node'}</h3>
        {selectedNode.subtitle && (
          <p className="mt-1 px-2.5 font-mono text-[10px] text-muted-foreground">{selectedNode.subtitle}</p>
        )}
      </div>

      <PanelShell className="mx-4 mt-4 px-3 py-1">
        <InspectorRow label="ID" value={selectedNode.id} />
        {selectedNode.runtimeKind && <InspectorRow label="Runtime" value={selectedNode.runtimeKind} />}
        {selectedNode.tmuxTarget && <InspectorRow label="Tmux" value={selectedNode.tmuxTarget} />}
        {selectedNode.remoteHost && <InspectorRow label="Host" value={selectedNode.remoteHost} />}
        {selectedNode.tag && <InspectorRow label="Tag" value={selectedNode.tag} />}
        {status?.workspaceID && <InspectorRow label="Workspace" value={status.workspaceID} />}
      </PanelShell>

      <div className="flex flex-wrap gap-2 p-4">
        <ActionButton
          label="Select"
          onClick={() => void sendAction('select', { nodeID: selectedNodeId, selectionMode: 'replace' })}
        />
        <ActionButton
          label="Focus"
          onClick={() => void sendAction('focus', { nodeID: selectedNodeId })}
        />
        <ActionButton
          label="Inspect"
          onClick={() => void sendAction('inspect', { nodeID: selectedNodeId })}
        />
        <ActionButton
          label="Metrics"
          variant="secondary"
          onClick={() => void sendAction('metrics', { includeNodes: false })}
        />
      </div>
    </div>
  );
}
