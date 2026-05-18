'use client';

import { createElement, useMemo } from 'react';
import type { CommandOption, StatusColor } from 'hudsonkit';
import { useWorkflowLab } from './WorkflowLabProvider';

export function useWorkflowLabCommands(): CommandOption[] {
  const { fixtures, selectFixture, selectNode } = useWorkflowLab();

  return useMemo<CommandOption[]>(() => [
    ...fixtures.map(fixture => ({
      id: `workflow-lab:fixture:${fixture.id}`,
      label: `Open ${fixture.label}`,
      section: 'Workflow Fixtures',
      action: () => selectFixture(fixture.id),
    })),
    {
      id: 'workflow-lab:clear-selection',
      label: 'Clear Workflow Selection',
      section: 'Workflow Lab',
      action: () => selectNode(null),
    },
  ], [fixtures, selectFixture, selectNode]);
}

export function useWorkflowLabStatus(): { label: string; color: StatusColor } {
  const { activeDocument } = useWorkflowLab();
  return { label: `${activeDocument.nodes.length} nodes`, color: 'emerald' };
}

export function useWorkflowLabNavCenter() {
  const { activeDocument } = useWorkflowLab();
  return createElement('span', {
    className: 'font-mono text-[10px] uppercase tracking-wider text-muted-foreground',
  }, activeDocument.metadata?.slug ?? activeDocument.id);
}

export function useWorkflowLabNavActions() {
  const { activeDocument } = useWorkflowLab();
  const outputKeyCount = activeDocument.nodes.filter(node => node.outputKey).length;

  return createElement('span', {
    className: 'font-mono text-[11px] text-muted-foreground',
  }, `${activeDocument.nodes.length} nodes / ${activeDocument.connections.length} edges / ${outputKeyCount} outputs`);
}

export function useWorkflowLabLayoutMode(): 'canvas' {
  return 'canvas';
}
