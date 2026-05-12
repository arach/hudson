'use client';

import { HudWorkflowGraph } from 'hudsonkit';
import { useShellLayout } from '../../shell/ShellLayoutContext';
import { useWorkflowLab } from './WorkflowLabProvider';

export function WorkflowLabContent() {
  const { leftWidth, rightWidth } = useShellLayout();
  const {
    activeDocument,
    schema,
    selectedNodeId,
    selectNode,
  } = useWorkflowLab();

  return (
    <div
      className="pointer-events-auto h-[calc(100vh-76px)] max-h-full min-h-0 max-w-full overflow-hidden bg-background"
      style={{ width: `calc(100vw - ${leftWidth + rightWidth}px)` }}
    >
      <HudWorkflowGraph
        className="h-full min-h-0"
        document={activeDocument}
        schema={schema}
        selectedNodeId={selectedNodeId}
        onSelectNode={selectNode}
      />
    </div>
  );
}
