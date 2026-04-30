import { createElement } from 'react';
import { TerminalSquare } from 'lucide-react';
import type { HudsonApp } from 'hudsonkit';
import { TerminalProvider } from './TerminalProvider';
import { TerminalContent } from './TerminalContent';

export const terminalApp: HudsonApp = {
  id: 'terminal',
  name: 'Terminal',
  description: 'Interactive terminal with Claude relay',
  mode: 'panel',

  Provider: TerminalProvider,

  slots: {
    Content: TerminalContent,
  },

  services: [{ serviceId: 'relay' }],

  hooks: {
    useCommands: () => [],
    useStatus: () => ({ label: 'Terminal', color: 'neutral' }),
  },
};
