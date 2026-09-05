/** Framework-free presentation shell for hybrid agent/code workflows. */

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
}

export interface AgentWorkspaceController {
  readonly element: HTMLDivElement;
  readonly navigation: HTMLElement;
  readonly conversation: HTMLElement;
  readonly artifact: HTMLElement;
  readonly slots: Readonly<Record<AgentWorkspaceSlot, HTMLElement>>;
  setSlot(name: AgentWorkspaceSlot, content: Node | null): void;
  update(state: AgentWorkspaceState): void;
  destroy(): void;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

export function createAgentWorkspace(
  host: HTMLElement,
  initialSlots: AgentWorkspaceSlots = {},
): AgentWorkspaceController {
  const root = element('div', 'hk-agent-workspace');
  const navigation = element('aside', 'hk-agent-workspace__navigation');
  const main = element('main', 'hk-agent-workspace__main');
  const notice = element('div', 'hk-agent-workspace__notice');
  const work = element('section', 'hk-agent-workspace__work');
  const conversation = element('section', 'hk-agent-workspace__conversation');
  const artifact = element('section', 'hk-agent-workspace__artifact');
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
  navigation.append(slotNodes.navigationHeader, slotNodes.navigation, slotNodes.navigationFooter);
  conversation.append(slotNodes.conversationHeader, slotNodes.conversation, slotNodes.composer);
  artifact.append(slotNodes.artifactHeader, slotNodes.editor, slotNodes.results);
  work.append(conversation, artifact);
  main.append(notice, work);
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
  };

  update({ artifactVisible: Boolean(initialSlots.editor || initialSlots.results), navigationVisible: true });
  return {
    element: root,
    navigation,
    conversation,
    artifact,
    slots: slotNodes,
    setSlot,
    update,
    destroy: () => root.remove(),
  };
}
