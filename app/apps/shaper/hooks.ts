'use client';

import { useMemo, createElement } from 'react';
import type { CommandOption, SearchConfig, StatusColor } from '@hudson/sdk';
import { sounds } from '@hudson/sdk';
import { useShaper } from './ShaperProvider';

// ---------------------------------------------------------------------------
// useCommands — app-specific commands for the command palette
// ---------------------------------------------------------------------------
export function useShaperCommands(): CommandOption[] {
  const ctx = useShaper();
  const {
    switchTool, undo, redo, quickSave, downloadJson, handleRetrace, newProject,
    resetZoom, zoomIn, zoomOut,
    showPath, setShowPath, showAnchors, setShowAnchors, showHandles, setShowHandles,
    showLabels, setShowLabels, showOriginal, setShowOriginal, showSilhouette, setShowSilhouette,
    showGrid, setShowGrid, showGuides, setShowGuides,
    animationModeEnabled, setAnimationModeEnabled,
    selectedPoint, deleteSelectedPoint, focusOnSelected,
  } = ctx;

  return useMemo<CommandOption[]>(() => [
    { id: 'shaper:select-tool', label: 'Tool: Select', action: () => switchTool('select'), shortcut: 'V' },
    { id: 'shaper:pen-tool', label: 'Tool: Pen', action: () => switchTool('pen'), shortcut: 'P' },
    { id: 'shaper:hand-tool', label: 'Tool: Hand', action: () => switchTool('hand'), shortcut: 'H' },
    { id: 'shaper:undo', label: 'Undo', action: undo, shortcut: 'Cmd+Z' },
    { id: 'shaper:redo', label: 'Redo', action: redo, shortcut: 'Cmd+Shift+Z' },
    { id: 'shaper:save', label: 'Save', action: () => { quickSave(); sounds.confirm(); }, shortcut: 'Cmd+S' },
    { id: 'shaper:export', label: 'Export JSON', action: downloadJson },
    { id: 'shaper:retrace', label: 'Re-trace from silhouette', action: handleRetrace },
    { id: 'shaper:new-project', label: 'New Project', action: newProject },
    { id: 'shaper:reset-zoom', label: 'Reset Zoom', action: resetZoom, shortcut: '0' },
    { id: 'shaper:zoom-in', label: 'Zoom In', action: zoomIn, shortcut: '+' },
    { id: 'shaper:zoom-out', label: 'Zoom Out', action: zoomOut, shortcut: '-' },
    { id: 'shaper:toggle-path', label: `${showPath ? 'Hide' : 'Show'} Bezier Path`, action: () => setShowPath(v => !v) },
    { id: 'shaper:toggle-anchors', label: `${showAnchors ? 'Hide' : 'Show'} Anchors`, action: () => setShowAnchors(v => !v) },
    { id: 'shaper:toggle-handles', label: `${showHandles ? 'Hide' : 'Show'} Handles`, action: () => setShowHandles(v => !v) },
    { id: 'shaper:toggle-labels', label: `${showLabels ? 'Hide' : 'Show'} Labels`, action: () => setShowLabels(v => !v) },
    { id: 'shaper:toggle-original', label: `${showOriginal ? 'Hide' : 'Show'} Original Image`, action: () => setShowOriginal(v => !v) },
    { id: 'shaper:toggle-silhouette', label: `${showSilhouette ? 'Hide' : 'Show'} Silhouette`, action: () => setShowSilhouette(v => !v) },
    { id: 'shaper:toggle-grid', label: `${showGrid ? 'Hide' : 'Show'} Grid`, action: () => setShowGrid(v => !v) },
    { id: 'shaper:toggle-guides', label: `${showGuides ? 'Hide' : 'Show'} Crosshair Guides`, action: () => setShowGuides(v => !v) },
    { id: 'shaper:toggle-animation', label: `${animationModeEnabled ? 'Disable' : 'Enable'} Animation Mode`, action: () => { setAnimationModeEnabled(v => !v); sounds.click(); }, shortcut: 'T' },
    ...(selectedPoint ? [
      { id: 'shaper:delete-point', label: 'Delete Selected Point', action: deleteSelectedPoint, shortcut: 'Backspace' },
      { id: 'shaper:focus-point', label: 'Focus on Selected Point', action: focusOnSelected },
    ] : []),
  ], [
    switchTool, undo, redo, quickSave, downloadJson, handleRetrace, newProject,
    resetZoom, zoomIn, zoomOut,
    showPath, showAnchors, showHandles, showLabels, showOriginal, showSilhouette, showGrid, showGuides,
    animationModeEnabled, selectedPoint, deleteSelectedPoint, focusOnSelected,
    setShowPath, setShowAnchors, setShowHandles, setShowLabels, setShowOriginal, setShowSilhouette, setShowGrid, setShowGuides, setAnimationModeEnabled,
  ]);
}

// ---------------------------------------------------------------------------
// useStatus
// ---------------------------------------------------------------------------
export function useShaperStatus(): { label: string; color: StatusColor } {
  const { saveStatus, isTracing } = useShaper();
  if (saveStatus === 'error') return { label: 'ERROR', color: 'red' };
  if (saveStatus === 'saving') return { label: 'SAVING', color: 'amber' };
  if (isTracing) return { label: 'TRACING', color: 'amber' };
  return { label: 'READY', color: 'emerald' };
}

// ---------------------------------------------------------------------------
// useSearch
// ---------------------------------------------------------------------------
export function useShaperSearch(): SearchConfig {
  const { searchQuery, setSearchQuery } = useShaper();
  return {
    value: searchQuery,
    onChange: setSearchQuery,
    placeholder: 'stroke:left x>500 y<300 ...',
  };
}

// ---------------------------------------------------------------------------
// useNavCenter — current tool indicator
// ---------------------------------------------------------------------------
export function useShaperNavCenter() {
  const { tool } = useShaper();
  const toolLabels: Record<string, string> = { select: 'Select', pen: 'Pen', hand: 'Hand' };
  return createElement('span', {
    className: 'text-[10px] font-mono text-neutral-500 uppercase tracking-wider',
  }, toolLabels[tool] || tool);
}

// ---------------------------------------------------------------------------
// useNavActions — save status + filename
// ---------------------------------------------------------------------------
export function useShaperNavActions() {
  const { saveStatus, projectImage, projectMeta } = useShaper();
  const displayName = projectMeta?.name ?? (projectImage ? projectImage.name : 'talkie-bezier.json');
  return createElement('span', { className: 'flex items-center gap-2' },
    createElement('span', { className: 'text-[11px] font-mono text-neutral-400' }, displayName),
    createElement('span', {
      className: `text-[10px] transition-colors ${
        saveStatus === 'saved' ? 'text-green-400' : saveStatus === 'saving' ? 'text-blue-400' : saveStatus === 'error' ? 'text-red-400' : 'text-neutral-600'
      }`,
    }, saveStatus === 'saved' ? 'saved' : saveStatus === 'saving' ? 'saving...' : saveStatus === 'error' ? 'save error' : '')
  );
}

// ---------------------------------------------------------------------------
// useLayoutMode — always 'panel'
// ---------------------------------------------------------------------------
export function useShaperLayoutMode(): 'canvas' | 'panel' {
  return 'panel';
}

// ---------------------------------------------------------------------------
// useActiveToolHint — suggest which tool to auto-expand
// ---------------------------------------------------------------------------
export function useShaperActiveToolHint(): string | null {
  const { selectedPoint, animationModeEnabled, projectImage, bezierData } = useShaper();
  if (selectedPoint) return 'appearance';
  if (animationModeEnabled) return 'animation';
  return null;
}
