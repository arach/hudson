'use client';

import { HudWorkflowGraph } from '../../workflow';
import { useWorkflowLab } from './WorkflowLabProvider';

export function WorkflowLabContent() {
  const {
    activeDocument,
    schema,
    selectedNodeId,
    selectNode,
  } = useWorkflowLab();

  return (
    <div className="pointer-events-auto h-full min-h-0 w-full overflow-hidden bg-background">
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
