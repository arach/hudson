import { createElement } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import type { HudsonApp, AppManifest } from 'hudsonkit';
import { DAY_STACK_AGENT_GUIDE } from './agent-context';
import { DayStackChat } from './DayStackChat';
import { DayStackContent } from './DayStackContent';
import { DayStackLeftPanel } from './DayStackLeftPanel';
import { DayStackRightPanel } from './DayStackRightPanel';
import { DayStackProvider, useDayStack } from './DayStackProvider';
import { dayStackIntents } from './intents';
import { useDayStackPortInput, useDayStackPortOutput } from './ports';
import { dayStackSettings } from './settings';
import {
  useDayStackCommands,
  useDayStackLayoutMode,
  useDayStackNavActions,
  useDayStackNavCenter,
  useDayStackStatus,
} from './hooks';

function DayStackHeaderActions() {
  const { addHourBlock } = useDayStack();
  return createElement('button', {
    onClick: addHourBlock,
    className: 'rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-cyan-700 dark:hover:text-cyan-300',
    title: 'Add focus block',
  }, createElement(Plus, { size: 12 }));
}

const dayStackManifest: AppManifest = {
  id: 'day-stack',
  name: 'Stacks',
  description: 'Markdown daily focus planner for stacking project blocks, intentions, completion, and next-focus voice actions.',
  mode: 'panel',
  commands: [
    { id: 'day-stack:add-block', label: 'Add Focus Block' },
    { id: 'day-stack:done-next', label: 'Complete Current Block and Focus Next' },
    { id: 'day-stack:next', label: 'Focus Next Block' },
    { id: 'day-stack:reset', label: 'Reset Stacks' },
  ],
};

export const dayStackApp: HudsonApp = {
  id: 'day-stack',
  name: 'Stacks',
  description: 'Markdown daily focus stack for project blocks, intentions, completion, and next-focus voice actions.',
  agentContext: DAY_STACK_AGENT_GUIDE,
  mode: 'panel',
  manifest: dayStackManifest,
  intents: dayStackIntents,
  settings: dayStackSettings,
  portInspector: 'hidden',

  Provider: DayStackProvider,

  ports: {
    outputs: [
      { id: 'agent-guide', name: 'Agent Guide', dataType: 'markdown', description: 'Stacks planning rules, naming guidance, voice phrases, and markdown format' },
      { id: 'plan-markdown', name: 'Plan Markdown', dataType: 'text', description: 'Current Stacks source in markdown block format' },
      { id: 'blocks', name: 'Parsed Blocks', dataType: 'json', description: 'Parsed schedule blocks with times, project names, intentions, and done state' },
      { id: 'active-block', name: 'Active Block', dataType: 'json', description: 'The currently focused Stacks block' },
    ],
    inputs: [
      { id: 'plan-markdown', name: 'Plan Markdown', dataType: 'text', description: 'Replace the current plan with Stacks markdown' },
      { id: 'intake-text', name: 'Intake Text', dataType: 'text', description: 'Append raw planning intake from voice, Talkie, or another source under an Intake heading' },
    ],
  },

  leftPanel: {
    title: 'Today',
    icon: createElement(CalendarClock, { size: 12 }),
    headerActions: DayStackHeaderActions,
  },
  rightPanel: {
    title: 'Focus Details',
    icon: createElement(CalendarClock, { size: 12 }),
  },

  slots: {
    Content: DayStackContent,
    LeftPanel: DayStackLeftPanel,
    Inspector: DayStackRightPanel,
    Chat: DayStackChat,
  },

  hooks: {
    useCommands: useDayStackCommands,
    useStatus: useDayStackStatus,
    useNavCenter: useDayStackNavCenter,
    useNavActions: useDayStackNavActions,
    useLayoutMode: useDayStackLayoutMode,
    usePortOutput: useDayStackPortOutput,
    usePortInput: useDayStackPortInput,
  },
};
