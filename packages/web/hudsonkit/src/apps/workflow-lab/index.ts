import { createElement } from 'react';
import { Network } from 'lucide-react';
import type { HudsonApp } from '../../index';
import { WorkflowLabContent } from './WorkflowLabContent';
import { WorkflowLabInspector } from './WorkflowLabInspector';
import { WorkflowLabLeftPanel } from './WorkflowLabLeftPanel';
import { WorkflowLabProvider } from './WorkflowLabProvider';
import {
  useWorkflowLabCommands,
  useWorkflowLabLayoutMode,
  useWorkflowLabNavActions,
  useWorkflowLabNavCenter,
  useWorkflowLabStatus,
} from './hooks';

export const workflowLabApp: HudsonApp = {
  id: 'workflow-lab',
  name: 'Workflow Lab',
  description: 'Read-only workflow graph fixture lab',
  mode: 'canvas',
  icon: createElement(Network, { size: 15 }),

  Provider: WorkflowLabProvider,

  leftPanel: {
    title: 'Workflows',
    icon: createElement(Network, { size: 12 }),
  },

  rightPanel: {
    title: 'Inspector',
    icon: createElement(Network, { size: 12 }),
  },

  slots: {
    Content: WorkflowLabContent,
    LeftPanel: WorkflowLabLeftPanel,
    Inspector: WorkflowLabInspector,
  },

  hooks: {
    useCommands: useWorkflowLabCommands,
    useStatus: useWorkflowLabStatus,
    useNavCenter: useWorkflowLabNavCenter,
    useNavActions: useWorkflowLabNavActions,
    useLayoutMode: useWorkflowLabLayoutMode,
  },
};
