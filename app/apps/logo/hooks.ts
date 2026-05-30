'use client';
import { useMemo } from 'react';
import type { CommandOption } from 'hudsonkit';
import { useLogo } from './LogoProvider';
import { useOptionalDataBus } from '../../shell/DataBusContext';

export function useLogoCommands(): CommandOption[] {
  const {
    templates,
    setVariant,
    resetDefaults,
    picks,
    params,
    elementOffsets,
    resetElementOffsets,
    inspectMode,
    toggleInspectMode,
    setEditorTool,
    drawingShapes,
    resetDrawingShapes,
  } = useLogo();
  const dataBus = useOptionalDataBus();
  const activeElementEditCount = Object.keys(elementOffsets[params.variant] ?? {}).length;
  const activeComponentCount = (drawingShapes[params.variant] ?? []).length;
  return useMemo(() => {
    const cmds: CommandOption[] = templates.map(t => ({
      id: `logo:${t.id}`,
      label: `Logo: ${t.name}`,
      action: () => setVariant(t.id),
    }));
    cmds.push({ id: 'logo:reset', label: 'Logo: Reset defaults', action: resetDefaults });
    cmds.push(
      { id: 'logo:tool-select', label: 'Logo: Select tool', action: () => setEditorTool('select'), shortcut: 'V' },
      { id: 'logo:tool-rectangle', label: 'Logo: Rectangle tool', action: () => setEditorTool('rect'), shortcut: 'R' },
      { id: 'logo:tool-ellipse', label: 'Logo: Oval tool', action: () => setEditorTool('ellipse'), shortcut: 'O' },
      { id: 'logo:tool-line', label: 'Logo: Line tool', action: () => setEditorTool('line'), shortcut: 'L' },
      { id: 'logo:tool-text', label: 'Logo: Text tool', action: () => setEditorTool('text'), shortcut: 'T' },
    );
    cmds.push({
      id: 'logo:toggle-inspect-mode',
      label: `Logo: ${inspectMode ? 'Hide' : 'Show'} element inspector`,
      action: toggleInspectMode,
    });
    if (activeComponentCount > 0) {
      cmds.push({
        id: 'logo:reset-components',
        label: `Logo: Reset components (${activeComponentCount})`,
        action: () => resetDrawingShapes(params.variant),
      });
    }
    if (activeElementEditCount > 0) {
      cmds.push({
        id: 'logo:reset-element-edits',
        label: `Logo: Reset element edits (${activeElementEditCount})`,
        action: () => resetElementOffsets(params.variant),
      });
    }
    cmds.push({
      id: 'logo:animate-selected-variant',
      label: `Logo: Animate selected variant${picks.length === 1 ? '' : 's'}${picks.length > 0 ? ` (${picks.length})` : ''}`,
      action: () => {
        if (picks.length === 0) {
          console.warn('[logo] Select at least one matrix variant before animating.');
          return;
        }
        const pushed = dataBus?.pushDirect('logo', 'animation-job', 'preframe-catalog', 'logo-animation-job');
        if (!pushed) {
          console.warn('[logo] Preframe animation port is not available. Start/register Preframe and try again.');
        }
      },
      shortcut: 'A',
    });
    return cmds;
  }, [
    activeComponentCount,
    activeElementEditCount,
    dataBus,
    inspectMode,
    params.variant,
    picks.length,
    resetDefaults,
    resetDrawingShapes,
    resetElementOffsets,
    setEditorTool,
    setVariant,
    templates,
    toggleInspectMode,
  ]);
}

export function useLogoStatus() {
  const { params, templates } = useLogo();
  const tmpl = templates.find(t => t.id === params.variant);
  return {
    label: tmpl?.name?.toUpperCase() ?? 'UNKNOWN',
    color: 'emerald' as const,
  };
}
