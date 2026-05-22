'use client';

import type { WorkspaceAppConfig, ContextMenuEntry } from 'hudsonkit';
import {
  Crosshair,
  Layers,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  ScanSearch,
  TerminalSquare,
  X,
} from 'lucide-react';

type AppLike = WorkspaceAppConfig['app'];
export type ContextMenuMode = 'hudson-first' | 'chrome-first';

export function hasInspectorSurface(app: AppLike | null | undefined, hasVisiblePorts = false): boolean {
  return !!(app && (app.slots.Inspector || app.slots.RightPanel || app.tools?.length || hasVisiblePorts));
}

function inspectorMenuItem({
  id,
  hasSurface,
  isOpen,
  onShow,
  onHide,
  onBeforeAction,
}: {
  id: string;
  hasSurface: boolean;
  isOpen: boolean;
  onShow: () => void;
  onHide: () => void;
  onBeforeAction?: () => void;
}): ContextMenuEntry {
  return {
    id,
    label: isOpen ? 'Hide App Inspector' : 'Show App Inspector',
    shortcut: '⌘]',
    icon: isOpen ? <PanelRightClose size={12} /> : <PanelRightOpen size={12} />,
    disabled: !hasSurface,
    action: () => {
      if (!hasSurface) return;
      onBeforeAction?.();
      if (isOpen) onHide();
      else onShow();
    },
  };
}

function devtoolsMenuItem(id: string, onOpenDevtools: () => void): ContextMenuEntry {
  return {
    id,
    label: 'Chrome DevTools Help',
    shortcut: '⌘⌥I',
    icon: <ScanSearch size={12} />,
    action: onOpenDevtools,
  };
}

export function buildCanvasContextMenu({
  showGuides,
  minimapCollapsed,
  onNewTerminal,
  onResetView,
  onFitAll,
  onResetAllWindows,
  onToggleGuides,
  onToggleMinimap,
  onOpenDevtools,
}: {
  showGuides: boolean;
  minimapCollapsed: boolean;
  onNewTerminal: () => void;
  onResetView: () => void;
  onFitAll: () => void;
  onResetAllWindows: () => void;
  onToggleGuides: () => void;
  onToggleMinimap: () => void;
  onOpenDevtools: () => void;
}): ContextMenuEntry[] {
  return [
    {
      id: 'canvas:new-terminal',
      label: 'New Terminal',
      icon: <TerminalSquare size={12} />,
      action: onNewTerminal,
    },
    { type: 'separator' },
    {
      id: 'canvas:reset-view',
      label: 'Reset View',
      shortcut: '⌘0',
      icon: <RotateCcw size={12} />,
      action: onResetView,
    },
    {
      id: 'canvas:fit-all',
      label: 'Fit All in View',
      icon: <Maximize2 size={12} />,
      action: onFitAll,
    },
    {
      id: 'canvas:reset-all-windows',
      label: 'Reset All Windows',
      icon: <RotateCcw size={12} />,
      action: onResetAllWindows,
    },
    { type: 'separator' },
    {
      id: 'canvas:toggle-guides',
      label: showGuides ? 'Hide Guides' : 'Show Guides',
      shortcut: '⌘\\',
      icon: <Crosshair size={12} />,
      action: onToggleGuides,
    },
    {
      id: 'canvas:toggle-minimap',
      label: minimapCollapsed ? 'Show Minimap' : 'Hide Minimap',
      icon: <MapIcon size={12} />,
      action: onToggleMinimap,
    },
    { type: 'separator' },
    devtoolsMenuItem('canvas:devtools-inspector', onOpenDevtools),
  ];
}

export function buildAppWindowContextMenu({
  appId,
  isMaximized,
  hasInspector,
  inspectorOpen,
  onEnterFullscreen,
  onFocus,
  onShowInspector,
  onHideInspector,
  onBringToCenter,
  onToggleMaximize,
  onResetWindow,
  onResetView,
  onClose,
  onOpenDevtools,
}: {
  appId: string;
  isMaximized: boolean;
  hasInspector: boolean;
  inspectorOpen: boolean;
  onEnterFullscreen: () => void;
  onFocus: () => void;
  onShowInspector: () => void;
  onHideInspector: () => void;
  onBringToCenter: () => void;
  onToggleMaximize: () => void;
  onResetWindow: () => void;
  onResetView: () => void;
  onClose: () => void;
  onOpenDevtools: () => void;
}): ContextMenuEntry[] {
  return [
    {
      id: `${appId}:focus-mode`,
      label: 'Focus Mode',
      shortcut: '⌘⇧F',
      icon: <Maximize2 size={12} />,
      action: onEnterFullscreen,
    },
    inspectorMenuItem({
      id: `${appId}:toggle-inspector`,
      hasSurface: hasInspector,
      isOpen: inspectorOpen,
      onShow: onShowInspector,
      onHide: onHideInspector,
      onBeforeAction: onFocus,
    }),
    {
      id: `${appId}:bring-to-front`,
      label: 'Bring to Front',
      icon: <Layers size={12} />,
      action: onFocus,
    },
    { type: 'separator' },
    {
      id: `${appId}:bring-to-center`,
      label: 'Bring to Center',
      icon: <Crosshair size={12} />,
      action: onBringToCenter,
    },
    {
      id: `${appId}:maximize`,
      label: isMaximized ? 'Restore' : 'Maximize',
      icon: isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />,
      action: onToggleMaximize,
    },
    {
      id: `${appId}:reset-window`,
      label: 'Reset Window',
      icon: <RotateCcw size={12} />,
      action: onResetWindow,
    },
    { type: 'separator' },
    {
      id: `${appId}:reset-view`,
      label: 'Reset View',
      shortcut: '⌘0',
      icon: <RotateCcw size={12} />,
      action: onResetView,
    },
    { type: 'separator' },
    {
      id: `${appId}:close`,
      label: 'Close',
      shortcut: '⌘W',
      icon: <X size={12} />,
      action: onClose,
    },
    { type: 'separator' },
    devtoolsMenuItem(`${appId}:devtools-inspector`, onOpenDevtools),
  ];
}

export function buildDynamicWindowContextMenu({
  windowId,
  onFocus,
  onBringToCenter,
  onResetWindow,
  onClose,
  onOpenDevtools,
}: {
  windowId: string;
  onFocus: () => void;
  onBringToCenter: () => void;
  onResetWindow: () => void;
  onClose: () => void;
  onOpenDevtools: () => void;
}): ContextMenuEntry[] {
  return [
    {
      id: `${windowId}:bring-to-front`,
      label: 'Bring to Front',
      icon: <Layers size={12} />,
      action: onFocus,
    },
    {
      id: `${windowId}:bring-to-center`,
      label: 'Bring to Center',
      icon: <Crosshair size={12} />,
      action: onBringToCenter,
    },
    {
      id: `${windowId}:reset-window`,
      label: 'Reset Window',
      icon: <RotateCcw size={12} />,
      action: onResetWindow,
    },
    { type: 'separator' },
    {
      id: `${windowId}:close`,
      label: 'Close',
      shortcut: '⌘W',
      icon: <X size={12} />,
      action: onClose,
    },
    { type: 'separator' },
    devtoolsMenuItem(`${windowId}:devtools-inspector`, onOpenDevtools),
  ];
}
