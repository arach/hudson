import type { AgentWorkspaceController } from '../../packages/web/hudsonkit/src/agent-workspace';
import type { AgentWorkspacePanelLayoutState } from '../../packages/web/hudsonkit/src/agent-panel-layout';
export type UICommand = { command: 'arrangement'; value: 'single' | 'columns' | 'rows' | 'grid' } | { command: 'togglePanel'; value: 'chat' | 'preview' | 'history' | 'source' } | { command: 'toggleSource' };
export function isUICommand(value: unknown): value is UICommand {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return p.command === 'toggleSource' || p.command === 'arrangement' && typeof p.value === 'string' && ['single','columns','rows','grid'].includes(String(p.value)) || p.command === 'togglePanel' && typeof p.value === 'string' && ['chat','preview','history','source'].includes(String(p.value));
}
export function layoutState(layout: AgentWorkspacePanelLayoutState) {
  const panels = layout.order.filter(id => !layout.hiddenPanelIds.includes(id));
  return { arrangement: layout.arrangement, panels, sourceOpen: panels.includes('source') };
}
export function applyUICommand(shell: AgentWorkspaceController, command: UICommand) {
  if (command.command === 'arrangement') shell.setPanelLayout({ arrangement: command.value, ...(command.value === 'grid' ? { gridColumns: 2 } : {}) });
  else {
    const panel = command.command === 'toggleSource' ? 'source' : command.value;
    if (shell.getPanelLayout().hiddenPanelIds.includes(panel)) shell.showPanel(panel); else shell.hidePanel(panel);
  }
}
