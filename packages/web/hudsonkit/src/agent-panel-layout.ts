/** Framework-free peer-panel layout used by AgentWorkspace. */

const PANEL_DRAG_THRESHOLD = 5;

export interface AgentWorkspacePanel {
  id: string;
  label: string;
  content: Node;
  disabled?: boolean;
}

export type AgentWorkspacePanelArrangement = 'single' | 'columns' | 'rows' | 'grid';

export interface AgentWorkspacePanelLayoutState {
  arrangement: AgentWorkspacePanelArrangement;
  order: string[];
  hiddenPanelIds: string[];
  focusedPanelId: string | null;
  gridColumns?: number;
  columnSizes?: number[];
  rowSizes?: number[];
}

export type AgentWorkspacePanelLayoutChangeReason =
  | 'arrangement'
  | 'focus'
  | 'hide'
  | 'show'
  | 'reorder'
  | 'resize'
  | 'state';

export interface AgentWorkspacePanelLayoutOptions {
  panels?: readonly AgentWorkspacePanel[];
  layout?: Partial<AgentWorkspacePanelLayoutState>;
  onChange?: (
    state: AgentWorkspacePanelLayoutState,
    reason: AgentWorkspacePanelLayoutChangeReason,
  ) => void;
}

export interface AgentWorkspacePanelLayoutController {
  readonly element: HTMLElement;
  setPanels(panels: readonly AgentWorkspacePanel[]): void;
  getLayout(): AgentWorkspacePanelLayoutState;
  setLayout(layout: Partial<AgentWorkspacePanelLayoutState>): void;
  showPanel(id: string): void;
  hidePanel(id: string): void;
  focusPanel(id: string): void;
  movePanel(id: string, toIndex: number): void;
  destroy(): void;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function cloneLayout(state: AgentWorkspacePanelLayoutState): AgentWorkspacePanelLayoutState {
  return {
    ...state,
    order: [...state.order],
    hiddenPanelIds: [...state.hiddenPanelIds],
    columnSizes: state.columnSizes ? [...state.columnSizes] : undefined,
    rowSizes: state.rowSizes ? [...state.rowSizes] : undefined,
  };
}

function normalizeSizes(sizes: readonly number[] | undefined, count: number): number[] {
  if (count <= 0) return [];
  if (!sizes || sizes.length !== count || sizes.some((size) => !Number.isFinite(size) || size <= 0)) {
    return Array.from({ length: count }, () => 100 / count);
  }
  const total = sizes.reduce((sum, size) => sum + size, 0);
  return sizes.map((size) => (size / total) * 100);
}

function moveItem(ids: readonly string[], id: string, toIndex: number): string[] {
  const next = ids.filter((candidate) => candidate !== id);
  next.splice(Math.max(0, Math.min(next.length, toIndex)), 0, id);
  return next;
}

export function createAgentPanelLayout(
  options: AgentWorkspacePanelLayoutOptions = {},
): AgentWorkspacePanelLayoutController {
  const root = element('section', 'hk-agent-workspace__peer-layout');
  const toolbar = element('header', 'hk-agent-workspace__peer-toolbar');
  const arrangementGroup = element('div', 'hk-agent-workspace__arrangements');
  const visibilityMenu = element('details', 'hk-agent-workspace__panel-visibility');
  const visibilitySummary = element('summary', 'hk-agent-workspace__panel-visibility-summary');
  const visibilityItems = element('div', 'hk-agent-workspace__panel-visibility-items');
  const body = element('div', 'hk-agent-workspace__peer-body');
  const frames = new Map<string, HTMLElement>();
  let panels = [...(options.panels ?? [])];
  let draggedPanelId: string | null = null;
  let dropTargetPanelId: string | null = null;
  let dragPreview: HTMLElement | null = null;
  let dragPointerId: number | null = null;
  let dragPointerHandle: HTMLElement | null = null;
  let dragStart = { x: 0, y: 0 };
  let suppressNextHandleClick = false;
  let state: AgentWorkspacePanelLayoutState = {
    arrangement: options.layout?.arrangement ?? 'single',
    order: [...(options.layout?.order ?? panels.map((panel) => panel.id))],
    hiddenPanelIds: [...(options.layout?.hiddenPanelIds ?? [])],
    focusedPanelId: options.layout?.focusedPanelId ?? panels[0]?.id ?? null,
    gridColumns: options.layout?.gridColumns,
    columnSizes: options.layout?.columnSizes ? [...options.layout.columnSizes] : undefined,
    rowSizes: options.layout?.rowSizes ? [...options.layout.rowSizes] : undefined,
  };

  root.setAttribute('aria-label', 'Workspace panels');
  arrangementGroup.setAttribute('role', 'group');
  arrangementGroup.setAttribute('aria-label', 'Panel arrangement');
  visibilitySummary.textContent = 'Panels';
  visibilityItems.setAttribute('role', 'menu');
  visibilityMenu.append(visibilitySummary, visibilityItems);
  toolbar.append(arrangementGroup, visibilityMenu);
  root.append(toolbar, body);

  const panelById = (id: string) => panels.find((panel) => panel.id === id);
  const availableIds = () => panels.map((panel) => panel.id);
  const orderedIds = () => {
    const known = new Set(availableIds());
    return [
      ...state.order.filter((id, index) => known.has(id) && state.order.indexOf(id) === index),
      ...availableIds().filter((id) => !state.order.includes(id)),
    ];
  };
  const visibleIds = () => orderedIds().filter((id) => !state.hiddenPanelIds.includes(id));

  const normalizeState = () => {
    state.order = orderedIds();
    state.hiddenPanelIds = state.hiddenPanelIds.filter((id, index) =>
      availableIds().includes(id) && state.hiddenPanelIds.indexOf(id) === index);
    const visible = visibleIds();
    if (!state.focusedPanelId || !visible.includes(state.focusedPanelId)) {
      state.focusedPanelId = visible[0] ?? null;
    }
    const visibleCount = visible.length;
    const columns = state.arrangement === 'columns'
      ? visibleCount
      : state.arrangement === 'grid'
        ? Math.max(1, Math.min(visibleCount, state.gridColumns ?? Math.ceil(Math.sqrt(visibleCount))))
        : 1;
    const rows = state.arrangement === 'rows'
      ? visibleCount
      : state.arrangement === 'grid'
        ? Math.max(1, Math.ceil(visibleCount / columns))
        : 1;
    state.gridColumns = state.arrangement === 'grid' ? columns : state.gridColumns;
    state.columnSizes = normalizeSizes(state.columnSizes, columns);
    state.rowSizes = normalizeSizes(state.rowSizes, rows);
  };

  const notify = (reason: AgentWorkspacePanelLayoutChangeReason) => {
    options.onChange?.(cloneLayout(state), reason);
  };

  const setArrangement = (arrangement: AgentWorkspacePanelArrangement) => {
    if (state.arrangement === arrangement) return;
    state.arrangement = arrangement;
    render();
    notify('arrangement');
  };

  const arrangementButtons = (['single', 'columns', 'rows', 'grid'] as const).map((arrangement) => {
    const button = element('button', 'hk-agent-workspace__arrangement-button');
    button.type = 'button';
    button.textContent = arrangement[0]!.toUpperCase() + arrangement.slice(1);
    button.addEventListener('click', () => setArrangement(arrangement));
    arrangementGroup.append(button);
    return { arrangement, button };
  });

  const movePanel = (id: string, toIndex: number) => {
    if (!panelById(id)) return;
    const next = moveItem(orderedIds(), id, toIndex);
    if (next.every((candidate, index) => candidate === state.order[index])) return;
    state.order = next;
    render();
    frames.get(id)?.querySelector<HTMLElement>('.hk-agent-workspace__panel-handle')?.focus();
    notify('reorder');
  };

  const focusPanel = (id: string) => {
    const panel = panelById(id);
    if (!panel || panel.disabled || state.hiddenPanelIds.includes(id)) return;
    if (state.focusedPanelId === id) return;
    state.focusedPanelId = id;
    render();
    notify('focus');
  };

  const showPanel = (id: string) => {
    if (!panelById(id) || !state.hiddenPanelIds.includes(id)) return;
    state.hiddenPanelIds = state.hiddenPanelIds.filter((candidate) => candidate !== id);
    state.focusedPanelId = id;
    render();
    notify('show');
  };

  const hidePanel = (id: string) => {
    const visible = visibleIds();
    const panel = panelById(id);
    if (!panel || panel.disabled || !visible.includes(id) || visible.length <= 1) return;
    state.hiddenPanelIds = [...state.hiddenPanelIds, id];
    if (state.focusedPanelId === id) state.focusedPanelId = visible.find((candidate) => candidate !== id) ?? null;
    render();
    notify('hide');
  };

  const clearDropTarget = () => {
    if (dropTargetPanelId) frames.get(dropTargetPanelId)?.removeAttribute('data-drop-target');
    dropTargetPanelId = null;
  };

  const setDropTarget = (id: string) => {
    if (!draggedPanelId || draggedPanelId === id || dropTargetPanelId === id) return;
    clearDropTarget();
    dropTargetPanelId = id;
    frames.get(id)?.setAttribute('data-drop-target', 'true');
  };

  const clearDragState = () => {
    const pointerId = dragPointerId;
    const pointerHandle = dragPointerHandle;
    clearDropTarget();
    if (draggedPanelId) frames.get(draggedPanelId)?.removeAttribute('data-drag-source');
    draggedPanelId = null;
    dragPreview?.remove();
    dragPreview = null;
    body.removeAttribute('data-dragging');
    root.removeAttribute('data-dragging-panel');
    dragPointerId = null;
    dragPointerHandle = null;
    if (pointerId !== null && pointerHandle?.hasPointerCapture?.(pointerId)) {
      pointerHandle.releasePointerCapture?.(pointerId);
    }
    root.ownerDocument.defaultView?.removeEventListener('keydown', cancelDragOnEscape);
  };

  const createDragPreview = (label: string) => {
    dragPreview?.remove();
    const preview = element('div', 'hk-agent-workspace__panel-drag-preview');
    preview.textContent = label;
    preview.setAttribute('aria-hidden', 'true');
    document.body.append(preview);
    dragPreview = preview;
    return preview;
  };

  const positionDragPreview = (x: number, y: number) => {
    if (!dragPreview) return;
    dragPreview.style.left = `${x + 14}px`;
    dragPreview.style.top = `${y + 14}px`;
  };

  const panelIdAtPoint = (x: number, y: number) => {
    const hit = root.ownerDocument.elementFromPoint?.(x, y);
    const frame = hit?.closest<HTMLElement>('[data-panel-id]');
    return frame && body.contains(frame) ? frame.dataset.panelId ?? null : null;
  };

  function cancelDragOnEscape(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !draggedPanelId) return;
    event.preventDefault();
    clearDragState();
  };

  const createFrame = (id: string) => {
    const frame = element('article', 'hk-agent-workspace__peer-panel');
    const header = element('header', 'hk-agent-workspace__peer-panel-header');
    const handle = element('button', 'hk-agent-workspace__panel-handle');
    const actions = element('details', 'hk-agent-workspace__panel-actions');
    const summary = element('summary', 'hk-agent-workspace__panel-actions-summary');
    const menu = element('div', 'hk-agent-workspace__panel-actions-menu');
    const earlier = element('button', 'hk-agent-workspace__panel-action');
    const later = element('button', 'hk-agent-workspace__panel-action');
    const hide = element('button', 'hk-agent-workspace__panel-action');
    const content = element('div', 'hk-agent-workspace__peer-panel-content');

    frame.dataset.panelId = id;
    frame.setAttribute('role', 'region');
    handle.type = 'button';
    handle.title = 'Drag to reorder; Alt+Arrow keys move this panel';
    summary.textContent = 'Actions';
    summary.setAttribute('aria-label', 'Panel actions');
    menu.setAttribute('role', 'menu');
    earlier.type = later.type = hide.type = 'button';
    earlier.textContent = 'Move earlier';
    later.textContent = 'Move later';
    hide.textContent = 'Hide panel';
    for (const button of [earlier, later, hide]) button.setAttribute('role', 'menuitem');
    menu.append(earlier, later, hide);
    actions.append(summary, menu);
    header.append(handle, actions);
    frame.append(header, content);

    handle.addEventListener('click', (event) => {
      if (suppressNextHandleClick) {
        suppressNextHandleClick = false;
        event.preventDefault();
        return;
      }
      focusPanel(id);
    });
    handle.addEventListener('keydown', (event) => {
      if (!event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const index = orderedIds().indexOf(id);
      const backwards = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
      movePanel(id, index + (backwards ? -1 : 1));
    });
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || panelById(id)?.disabled || dragPointerId !== null) return;
      dragPointerId = event.pointerId;
      dragPointerHandle = handle;
      dragStart = { x: event.clientX, y: event.clientY };
      handle.setPointerCapture?.(event.pointerId);
    });
    handle.addEventListener('pointermove', (event) => {
      if (dragPointerId !== event.pointerId) return;
      if (!draggedPanelId) {
        if (Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) < PANEL_DRAG_THRESHOLD) return;
        draggedPanelId = id;
        frame.dataset.dragSource = 'true';
        body.dataset.dragging = 'true';
        root.dataset.draggingPanel = id;
        createDragPreview(panelById(id)?.label ?? id);
        root.ownerDocument.defaultView?.addEventListener('keydown', cancelDragOnEscape);
      }
      event.preventDefault();
      positionDragPreview(event.clientX, event.clientY);
      const targetId = panelIdAtPoint(event.clientX, event.clientY);
      if (targetId && targetId !== draggedPanelId) setDropTarget(targetId);
      else clearDropTarget();
    });
    const finishPointerDrag = (event: PointerEvent, commit: boolean) => {
      if (dragPointerId !== event.pointerId) return;
      const source = draggedPanelId;
      const target = dropTargetPanelId;
      if (source && commit) suppressNextHandleClick = true;
      clearDragState();
      if (commit && source && target && source !== target) movePanel(source, orderedIds().indexOf(target));
    };
    handle.addEventListener('pointerup', (event) => finishPointerDrag(event, true));
    handle.addEventListener('pointercancel', (event) => finishPointerDrag(event, false));
    handle.addEventListener('lostpointercapture', (event) => finishPointerDrag(event, false));
    earlier.addEventListener('click', () => {
      movePanel(id, orderedIds().indexOf(id) - 1);
      actions.open = false;
    });
    later.addEventListener('click', () => {
      movePanel(id, orderedIds().indexOf(id) + 1);
      actions.open = false;
    });
    hide.addEventListener('click', () => {
      hidePanel(id);
      actions.open = false;
    });
    frames.set(id, frame);
    return frame;
  };

  const resizeTracks = (axis: 'column' | 'row', index: number, delta: number) => {
    const key = axis === 'column' ? 'columnSizes' : 'rowSizes';
    const sizes = [...(state[key] ?? [])];
    if (index < 0 || index + 1 >= sizes.length) return;
    const combined = sizes[index]! + sizes[index + 1]!;
    const first = Math.max(10, Math.min(combined - 10, sizes[index]! + delta));
    sizes[index] = first;
    sizes[index + 1] = combined - first;
    state[key] = sizes;
    render();
    notify('resize');
  };

  const createSeparator = (axis: 'column' | 'row', index: number, position: number) => {
    const separator = element('div', `hk-agent-workspace__panel-separator hk-agent-workspace__panel-separator--${axis}`);
    separator.tabIndex = 0;
    separator.setAttribute('role', 'separator');
    separator.setAttribute('aria-orientation', axis === 'column' ? 'vertical' : 'horizontal');
    separator.setAttribute('aria-label', `Resize ${axis}s`);
    separator.setAttribute('aria-valuemin', '10');
    separator.setAttribute('aria-valuemax', '90');
    separator.setAttribute('aria-valuenow', String(Math.round(position)));
    separator.dataset.separator = axis;
    separator.style.setProperty(axis === 'column' ? 'left' : 'top', `${position}%`);
    separator.addEventListener('keydown', (event) => {
      const backwards = axis === 'column' ? event.key === 'ArrowLeft' : event.key === 'ArrowUp';
      const forwards = axis === 'column' ? event.key === 'ArrowRight' : event.key === 'ArrowDown';
      if (!backwards && !forwards) return;
      event.preventDefault();
      resizeTracks(axis, index, backwards ? -5 : 5);
    });
    separator.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      const start = axis === 'column' ? event.clientX : event.clientY;
      let previous = start;
      const rect = body.getBoundingClientRect();
      const extent = axis === 'column' ? rect.width : rect.height;
      if (extent <= 0) return;
      separator.setPointerCapture?.(event.pointerId);
      const move = (moveEvent: PointerEvent) => {
        const current = axis === 'column' ? moveEvent.clientX : moveEvent.clientY;
        resizeTracks(axis, index, ((current - previous) / extent) * 100);
        previous = current;
      };
      const end = () => {
        separator.removeEventListener('pointermove', move);
        separator.removeEventListener('pointerup', end);
        separator.removeEventListener('pointercancel', end);
      };
      separator.addEventListener('pointermove', move);
      separator.addEventListener('pointerup', end);
      separator.addEventListener('pointercancel', end);
    });
    body.append(separator);
  };

  function render() {
    normalizeState();
    const visible = visibleIds();
    const shown = state.arrangement === 'single'
      ? visible.filter((id) => id === state.focusedPanelId)
      : visible;
    const columns = state.arrangement === 'columns'
      ? shown.length
      : state.arrangement === 'grid'
        ? Math.max(1, Math.min(shown.length, state.gridColumns ?? 1))
        : 1;
    const rows = state.arrangement === 'rows'
      ? shown.length
      : state.arrangement === 'grid'
        ? Math.max(1, Math.ceil(shown.length / columns))
        : 1;

    root.dataset.panelArrangement = state.arrangement;
    root.dataset.panelsVisible = String(panels.length > 0);
    body.style.gridTemplateColumns = normalizeSizes(state.columnSizes, columns).map((size) => `${size}fr`).join(' ');
    body.style.gridTemplateRows = normalizeSizes(state.rowSizes, rows).map((size) => `${size}fr`).join(' ');
    body.querySelectorAll<HTMLElement>('[data-separator]').forEach((separator) => separator.remove());

    for (const { arrangement, button } of arrangementButtons) {
      button.setAttribute('aria-pressed', String(state.arrangement === arrangement));
    }
    visibilityItems.replaceChildren();

    for (const id of orderedIds()) {
      const panel = panelById(id)!;
      const frame = frames.get(id) ?? createFrame(id);
      const handle = frame.querySelector<HTMLButtonElement>('.hk-agent-workspace__panel-handle')!;
      const content = frame.querySelector<HTMLElement>('.hk-agent-workspace__peer-panel-content')!;
      const actionButtons = frame.querySelectorAll<HTMLButtonElement>('.hk-agent-workspace__panel-action');
      handle.textContent = panel.label;
      handle.disabled = Boolean(panel.disabled);
      frame.setAttribute('aria-label', panel.label);
      frame.dataset.focused = String(state.focusedPanelId === id);
      if (content.childNodes.length !== 1 || content.firstChild !== panel.content) {
        content.replaceChildren(panel.content);
      }
      actionButtons.forEach((button) => { button.disabled = Boolean(panel.disabled); });
      frame.hidden = !shown.includes(id);
      body.append(frame);

      const visibility = element('button', 'hk-agent-workspace__panel-visibility-item');
      const isVisible = !state.hiddenPanelIds.includes(id);
      const opensSinglePanel = state.arrangement === 'single' && isVisible && state.focusedPanelId !== id;
      visibility.type = 'button';
      visibility.textContent = `${!isVisible ? 'Show' : opensSinglePanel ? 'Open' : 'Hide'} ${panel.label}`;
      visibility.setAttribute('role', 'menuitem');
      visibility.disabled = Boolean(panel.disabled) || (!opensSinglePanel && isVisible && visible.length <= 1);
      visibility.addEventListener('click', () => {
        if (!isVisible) showPanel(id);
        else if (opensSinglePanel) focusPanel(id);
        else hidePanel(id);
        visibilityMenu.open = false;
      });
      visibilityItems.append(visibility);
    }

    const columnSizes = normalizeSizes(state.columnSizes, columns);
    const rowSizes = normalizeSizes(state.rowSizes, rows);
    let position = 0;
    for (let index = 0; index < columnSizes.length - 1; index += 1) {
      position += columnSizes[index]!;
      createSeparator('column', index, position);
    }
    position = 0;
    for (let index = 0; index < rowSizes.length - 1; index += 1) {
      position += rowSizes[index]!;
      createSeparator('row', index, position);
    }
  }

  const setPanels = (nextPanels: readonly AgentWorkspacePanel[]) => {
    const ids = nextPanels.map((panel) => panel.id);
    if (new Set(ids).size !== ids.length) throw new Error('Agent workspace panel ids must be unique');
    panels = [...nextPanels];
    if (draggedPanelId && !ids.includes(draggedPanelId)) clearDragState();
    else if (dropTargetPanelId && !ids.includes(dropTargetPanelId)) clearDropTarget();
    for (const [id, frame] of frames) {
      if (!ids.includes(id)) {
        frame.remove();
        frames.delete(id);
      }
    }
    render();
  };

  const setLayout = (layout: Partial<AgentWorkspacePanelLayoutState>) => {
    state = {
      ...state,
      ...layout,
      order: layout.order ? [...layout.order] : state.order,
      hiddenPanelIds: layout.hiddenPanelIds ? [...layout.hiddenPanelIds] : state.hiddenPanelIds,
      columnSizes: layout.columnSizes ? [...layout.columnSizes] : state.columnSizes,
      rowSizes: layout.rowSizes ? [...layout.rowSizes] : state.rowSizes,
    };
    render();
    notify('state');
  };

  setPanels(panels);
  return {
    element: root,
    setPanels,
    getLayout: () => cloneLayout(state),
    setLayout,
    showPanel,
    hidePanel,
    focusPanel,
    movePanel,
    destroy: () => {
      clearDragState();
      root.remove();
    },
  };
}
