'use client';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createAgentWorkspace, type AgentWorkspaceController } from './agent-workspace';
import type { AgentWorkspacePanelLayoutState } from './agent-panel-layout';
export interface EditorPanelRenderer { id: string; label: string; content: ReactNode; disabled?: boolean }
/** One React tree: portals preserve the caller's Provider even when a panel hides. */
export function EditorPanels({ panels, layout, onLayoutChange, onReady }: {
  panels: readonly EditorPanelRenderer[];
  layout: AgentWorkspacePanelLayoutState;
  onLayoutChange?: (layout: AgentWorkspacePanelLayoutState) => void;
  onReady?: (controller: AgentWorkspaceController | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<AgentWorkspaceController | null>(null);
  const [nodes, setNodes] = useState<Map<string, HTMLElement>>(new Map());
  const latest = useRef({ onLayoutChange, onReady });
  latest.current = { onLayoutChange, onReady };
  // Initial layout belongs to this mount. Subsequent changes are controller-owned.
  const initial = useRef(layout);
  useLayoutEffect(() => {
    const workspace = createAgentWorkspace(host.current!, { notice: null }, {
      panelLayout: initial.current,
      onPanelLayoutChange: value => latest.current.onLayoutChange?.(value),
    });
    workspace.update({ navigationVisible: false });
    controller.current = workspace;
    latest.current.onReady?.(workspace);
    return () => { latest.current.onReady?.(null); workspace.destroy(); controller.current = null; };
  }, []);
  useLayoutEffect(() => {
    setNodes(previous => {
      const next = new Map<string, HTMLElement>();
      for (const panel of panels) {
        const node = previous.get(panel.id) ?? document.createElement('div');
        node.className = 'hk-editor-panel-mount'; next.set(panel.id, node);
      }
      controller.current?.setPanels(panels.map(panel => ({ ...panel, content: next.get(panel.id)! })));
      // Restore initial visibility after installing the first panel set.
      if (previous.size === 0) controller.current?.setPanelLayout(initial.current);
      return next;
    });
  }, [panels]);
  return <><div className="hk-editor-panel-host" ref={host} />{panels.map(panel => {
    const node = nodes.get(panel.id);
    return node ? createPortal(panel.content, node, panel.id) : null;
  })}</>;
}
