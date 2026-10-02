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
  useLayoutEffect(() => { latest.current = { onLayoutChange, onReady }; }, [onLayoutChange, onReady]);
  // Initial layout belongs to this mount. Subsequent changes are controller-owned.
  const initial = useRef(layout);
  const mounts = useRef(new Map<string, HTMLElement>());
  const initialized = useRef(false);
  useLayoutEffect(() => {
    const workspace = createAgentWorkspace(host.current!, { notice: null }, {
      panelLayout: initial.current,
      onPanelLayoutChange: value => {
        if (initialized.current) latest.current.onLayoutChange?.(value);
      },
    });
    workspace.update({ navigationVisible: false });
    controller.current = workspace;
    return () => {
      initialized.current = false;
      latest.current.onReady?.(null);
      workspace.destroy();
      controller.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    const next = new Map<string, HTMLElement>();
    for (const panel of panels) {
      const node = mounts.current.get(panel.id) ?? document.createElement('div');
      node.className = 'hk-editor-panel-mount';
      next.set(panel.id, node);
    }
    mounts.current = next;
    const workspace = controller.current!;
    workspace.setPanels(panels.map(panel => ({ ...panel, content: next.get(panel.id)! })));
    if (!initialized.current) {
      workspace.setPanelLayout(initial.current);
      initialized.current = true;
      latest.current.onReady?.(workspace);
    }
    // Publish imperative DOM mount points to React; no DOM work in state updaters.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNodes(next);
  }, [panels]);
  return <><div className="hk-editor-panel-host" ref={host} />{panels.map(panel => {
    const node = nodes.get(panel.id);
    return node ? createPortal(panel.content, node, panel.id) : null;
  })}</>;
}
