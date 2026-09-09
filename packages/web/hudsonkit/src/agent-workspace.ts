/** Framework-free presentation shell for hybrid agent/code workflows. */

import {
  createAgentPanelLayout,
  type AgentWorkspacePanel,
  type AgentWorkspacePanelLayoutChangeReason,
  type AgentWorkspacePanelLayoutState,
} from './agent-panel-layout';

export type {
  AgentWorkspacePanel,
  AgentWorkspacePanelArrangement,
  AgentWorkspacePanelLayoutChangeReason,
  AgentWorkspacePanelLayoutState,
} from './agent-panel-layout';

export type AgentWorkspaceSlot =
  | 'navigationHeader'
  | 'navigation'
  | 'navigationFooter'
  | 'notice'
  | 'conversationHeader'
  | 'conversation'
  | 'composer'
  | 'artifactHeader'
  | 'editor'
  | 'results';

export interface AgentWorkspaceSlots {
  navigationHeader?: Node | null;
  navigation?: Node | null;
  navigationFooter?: Node | null;
  notice?: Node | null;
  conversationHeader?: Node | null;
  conversation?: Node | null;
  composer?: Node | null;
  artifactHeader?: Node | null;
  editor?: Node | null;
  results?: Node | null;
}

export interface AgentWorkspaceState {
  artifactVisible?: boolean;
  navigationVisible?: boolean;
  splitPercent?: number;
  selectedToolId?: string | null;
  secondaryToolId?: string | null;
  toolLayout?: AgentWorkspaceToolLayout;
  toolSplitPercent?: number;
}

export interface AgentWorkspaceTool {
  id: string;
  label: string;
  content: Node;
  disabled?: boolean;
}

export type AgentWorkspaceToolPane = 'primary' | 'secondary';
export type AgentWorkspaceToolLayout = 'single' | 'split';

export interface AgentWorkspaceOptions {
  tools?: readonly AgentWorkspaceTool[];
  selectedToolId?: string | null;
  secondaryToolId?: string | null;
  toolLayout?: AgentWorkspaceToolLayout;
  toolSplitPercent?: number;
  onToolSelect?: (id: string, pane: AgentWorkspaceToolPane) => void;
  onToolLayoutChange?: (layout: AgentWorkspaceToolLayout) => void;
  panels?: readonly AgentWorkspacePanel[];
  panelLayout?: Partial<AgentWorkspacePanelLayoutState>;
  onPanelLayoutChange?: (
    state: AgentWorkspacePanelLayoutState,
    reason: AgentWorkspacePanelLayoutChangeReason,
  ) => void;
}

export interface AgentWorkspaceController {
  readonly element: HTMLDivElement;
  readonly navigation: HTMLElement;
  readonly conversation: HTMLElement;
  readonly artifact: HTMLElement;
  readonly panelLayout: HTMLElement;
  readonly toolTabs: HTMLElement;
  readonly primaryToolPane: HTMLElement;
  readonly secondaryToolPane: HTMLElement;
  readonly slots: Readonly<Record<AgentWorkspaceSlot, HTMLElement>>;
  setSlot(name: AgentWorkspaceSlot, content: Node | null): void;
  setTools(tools: readonly AgentWorkspaceTool[]): void;
  setPanels(panels: readonly AgentWorkspacePanel[]): void;
  getPanelLayout(): AgentWorkspacePanelLayoutState;
  setPanelLayout(layout: Partial<AgentWorkspacePanelLayoutState>): void;
  showPanel(id: string): void;
  hidePanel(id: string): void;
  focusPanel(id: string): void;
  movePanel(id: string, toIndex: number): void;
  update(state: AgentWorkspaceState): void;
  destroy(): void;
}

let workspaceId = 0;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

export function createAgentWorkspace(
  host: HTMLElement,
  initialSlots: AgentWorkspaceSlots = {},
  options: AgentWorkspaceOptions = {},
): AgentWorkspaceController {
  const id = ++workspaceId;
  const root = element('div', 'hk-agent-workspace');
  const navigation = element('aside', 'hk-agent-workspace__navigation');
  const main = element('main', 'hk-agent-workspace__main');
  const notice = element('div', 'hk-agent-workspace__notice');
  const work = element('section', 'hk-agent-workspace__work');
  const conversation = element('section', 'hk-agent-workspace__conversation');
  const artifact = element('section', 'hk-agent-workspace__artifact');
  const toolChrome = element('div', 'hk-agent-workspace__tool-chrome');
  const toolPanePicker = element('div', 'hk-agent-workspace__tool-pane-picker');
  const primaryPicker = element('button', 'hk-agent-workspace__tool-pane-button');
  const secondaryPicker = element('button', 'hk-agent-workspace__tool-pane-button');
  const toolTabs = element('div', 'hk-agent-workspace__tool-tabs');
  const splitButton = element('button', 'hk-agent-workspace__split-button');
  const toolBody = element('div', 'hk-agent-workspace__tool-body');
  const primaryToolPane = element('div', 'hk-agent-workspace__tool-pane hk-agent-workspace__tool-pane--primary');
  const secondaryToolPane = element('div', 'hk-agent-workspace__tool-pane hk-agent-workspace__tool-pane--secondary');
  const peerLayout = createAgentPanelLayout({
    panels: options.panels,
    layout: options.panelLayout,
    onChange: options.onPanelLayoutChange,
  });
  const slotNodes: Record<AgentWorkspaceSlot, HTMLElement> = {
    navigationHeader: element('header', 'hk-agent-workspace__navigation-header'),
    navigation: element('div', 'hk-agent-workspace__navigation-body'),
    navigationFooter: element('footer', 'hk-agent-workspace__navigation-footer'),
    notice,
    conversationHeader: element('header', 'hk-agent-workspace__conversation-header'),
    conversation: element('div', 'hk-agent-workspace__conversation-body'),
    composer: element('div', 'hk-agent-workspace__composer'),
    artifactHeader: element('header', 'hk-agent-workspace__artifact-header'),
    editor: element('div', 'hk-agent-workspace__editor'),
    results: element('div', 'hk-agent-workspace__results'),
  };

  notice.setAttribute('role', 'status');
  toolTabs.setAttribute('role', 'tablist');
  toolTabs.setAttribute('aria-label', 'Workspace tools');
  primaryPicker.type = 'button';
  primaryPicker.textContent = 'Primary';
  secondaryPicker.type = 'button';
  secondaryPicker.textContent = 'Secondary';
  splitButton.type = 'button';
  splitButton.textContent = 'Split';
  splitButton.setAttribute('aria-label', 'Split tools');
  toolPanePicker.setAttribute('aria-label', 'Target tool pane');
  toolPanePicker.setAttribute('role', 'group');
  toolPanePicker.append(primaryPicker, secondaryPicker);
  toolChrome.append(toolPanePicker, toolTabs, splitButton);
  toolBody.append(primaryToolPane, secondaryToolPane);
  navigation.append(slotNodes.navigationHeader, slotNodes.navigation, slotNodes.navigationFooter);
  conversation.append(slotNodes.conversationHeader, slotNodes.conversation, slotNodes.composer);
  artifact.append(slotNodes.artifactHeader, slotNodes.editor, slotNodes.results, toolChrome, toolBody);
  work.append(conversation, artifact);
  main.append(notice, work, peerLayout.element);
  root.append(navigation, main);
  host.replaceChildren(root);

  const setSlot = (name: AgentWorkspaceSlot, content: Node | null) => {
    const slot = slotNodes[name];
    slot.replaceChildren(...(content ? [content] : []));
    slot.hidden = !content;
  };
  for (const [name, content] of Object.entries(initialSlots) as [AgentWorkspaceSlot, Node | null | undefined][]) {
    setSlot(name, content ?? null);
  }

  let tools = [...(options.tools ?? [])];
  let selectedToolId = options.selectedToolId ?? tools.find((tool) => !tool.disabled)?.id ?? null;
  let secondaryToolId = options.secondaryToolId ?? null;
  let toolLayout = options.toolLayout ?? 'single';
  let activeToolPane: AgentWorkspaceToolPane = 'primary';

  const enabledTools = () => tools.filter((tool) => !tool.disabled);
  const validToolId = (candidate: string | null, exclude?: string | null) => {
    if (candidate && candidate !== exclude && enabledTools().some((tool) => tool.id === candidate)) return candidate;
    return enabledTools().find((tool) => tool.id !== exclude)?.id ?? null;
  };

  const renderTools = () => {
    selectedToolId = validToolId(selectedToolId);
    secondaryToolId = toolLayout === 'split' ? validToolId(secondaryToolId, selectedToolId) : secondaryToolId;
    if (toolLayout === 'split' && !secondaryToolId) toolLayout = 'single';
    if (toolLayout === 'single') activeToolPane = 'primary';

    root.dataset.toolsVisible = String(tools.length > 0);
    root.dataset.toolLayout = toolLayout;
    root.dataset.activeToolPane = activeToolPane;
    toolChrome.hidden = tools.length === 0;
    toolBody.hidden = tools.length === 0;
    secondaryToolPane.hidden = toolLayout !== 'split';
    toolPanePicker.hidden = toolLayout !== 'split';
    splitButton.disabled = enabledTools().length < 2;
    splitButton.setAttribute('aria-pressed', String(toolLayout === 'split'));
    splitButton.textContent = toolLayout === 'split' ? 'Single' : 'Split';
    primaryPicker.setAttribute('aria-pressed', String(activeToolPane === 'primary'));
    secondaryPicker.setAttribute('aria-pressed', String(activeToolPane === 'secondary'));

    toolTabs.replaceChildren();
    primaryToolPane.replaceChildren();
    secondaryToolPane.replaceChildren();
    const activeId = activeToolPane === 'primary' ? selectedToolId : secondaryToolId;
    for (const tool of tools) {
      const tab = element('button', 'hk-agent-workspace__tool-tab');
      const panel = element('section', 'hk-agent-workspace__tool-panel');
      const safeId = tool.id.replace(/[^a-zA-Z0-9_-]/g, '-');
      const tabId = `hk-agent-workspace-${id}-tab-${safeId}`;
      const panelId = `hk-agent-workspace-${id}-panel-${safeId}`;
      tab.type = 'button';
      tab.id = tabId;
      tab.textContent = tool.label;
      tab.disabled = Boolean(tool.disabled);
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(tool.id === activeId));
      tab.setAttribute('aria-controls', panelId);
      tab.tabIndex = tool.id === activeId ? 0 : -1;
      panel.id = panelId;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tabId);
      panel.tabIndex = 0;
      panel.append(tool.content);

      const pane = tool.id === selectedToolId
        ? primaryToolPane
        : toolLayout === 'split' && tool.id === secondaryToolId
          ? secondaryToolPane
          : null;
      panel.hidden = !pane;
      pane?.append(panel);
      if (!pane) toolBody.append(panel);

      tab.addEventListener('click', () => {
        if (tool.disabled) return;
        const paneName = toolLayout === 'split' ? activeToolPane : 'primary';
        const previousPrimary = selectedToolId;
        if (paneName === 'primary') {
          selectedToolId = tool.id;
          if (secondaryToolId === tool.id) secondaryToolId = previousPrimary;
        } else {
          secondaryToolId = tool.id;
          if (selectedToolId === tool.id) selectedToolId = validToolId(previousPrimary, tool.id);
        }
        options.onToolSelect?.(tool.id, paneName);
        renderTools();
      });
      toolTabs.append(tab);
    }
  };

  toolTabs.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const available = Array.from(toolTabs.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
    const current = available.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0 || available.length === 0) return;
    event.preventDefault();
    const next = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? available.length - 1
        : (current + (event.key === 'ArrowRight' ? 1 : -1) + available.length) % available.length;
    available[next]?.focus();
  });

  primaryPicker.addEventListener('click', () => {
    activeToolPane = 'primary';
    renderTools();
  });
  secondaryPicker.addEventListener('click', () => {
    activeToolPane = 'secondary';
    renderTools();
  });
  splitButton.addEventListener('click', () => {
    toolLayout = toolLayout === 'single' ? 'split' : 'single';
    options.onToolLayoutChange?.(toolLayout);
    renderTools();
  });

  const setTools = (nextTools: readonly AgentWorkspaceTool[]) => {
    tools = [...nextTools];
    if (tools.length > 0) {
      artifact.hidden = false;
      root.dataset.artifactVisible = 'true';
    }
    renderTools();
  };

  const setPanels = (panels: readonly AgentWorkspacePanel[]) => {
    peerLayout.setPanels(panels);
    const visible = panels.length > 0;
    root.dataset.peerPanelsVisible = String(visible);
    work.hidden = visible;
    peerLayout.element.hidden = !visible;
  };

  const update = (state: AgentWorkspaceState) => {
    if (state.artifactVisible !== undefined) {
      artifact.hidden = !state.artifactVisible;
      root.dataset.artifactVisible = String(state.artifactVisible);
    }
    if (state.navigationVisible !== undefined) {
      navigation.hidden = !state.navigationVisible;
      root.dataset.navigationVisible = String(state.navigationVisible);
    }
    if (state.splitPercent !== undefined) {
      const split = Math.min(75, Math.max(25, state.splitPercent));
      root.style.setProperty('--hk-agent-workspace-split', `${split}%`);
    }
    if (state.selectedToolId !== undefined) selectedToolId = state.selectedToolId;
    if (state.secondaryToolId !== undefined) secondaryToolId = state.secondaryToolId;
    if (state.toolLayout !== undefined) toolLayout = state.toolLayout;
    if (state.toolSplitPercent !== undefined) {
      const split = Math.min(75, Math.max(25, state.toolSplitPercent));
      root.style.setProperty('--hk-agent-workspace-tool-split', `${split}%`);
    }
    if (
      state.selectedToolId !== undefined
      || state.secondaryToolId !== undefined
      || state.toolLayout !== undefined
    ) renderTools();
  };

  renderTools();
  setPanels(options.panels ?? []);
  update({
    artifactVisible: Boolean(initialSlots.editor || initialSlots.results || tools.length),
    navigationVisible: true,
    toolSplitPercent: options.toolSplitPercent,
  });
  return {
    element: root,
    navigation,
    conversation,
    artifact,
    panelLayout: peerLayout.element,
    toolTabs,
    primaryToolPane,
    secondaryToolPane,
    slots: slotNodes,
    setSlot,
    setTools,
    setPanels,
    getPanelLayout: peerLayout.getLayout,
    setPanelLayout: peerLayout.setLayout,
    showPanel: peerLayout.showPanel,
    hidePanel: peerLayout.hidePanel,
    focusPanel: peerLayout.focusPanel,
    movePanel: peerLayout.movePanel,
    update,
    destroy: () => root.remove(),
  };
}
