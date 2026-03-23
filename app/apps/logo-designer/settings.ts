import type { AppSettingsConfig } from '@hudson/sdk';

export const logoSettings: AppSettingsConfig = {
  sections: [
    {
      label: 'Agent',
      fields: [
        {
          key: 'agent',
          label: 'CLI Agent',
          type: 'segment',
          default: 'pi',
          options: [
            { label: 'Claude', value: 'claude' },
            { label: 'Pi', value: 'pi' },
          ],
        },
        {
          key: 'provider',
          label: 'Provider',
          type: 'text',
          default: 'minimax',
        },
        {
          key: 'model',
          label: 'Model',
          type: 'text',
          default: 'MiniMax-M2.7',
        },
      ],
    },
    {
      label: 'Relay',
      fields: [
        {
          key: 'relayUrl',
          label: 'Relay URL',
          type: 'text',
          default: 'ws://localhost:3600',
        },
        {
          key: 'compileEndpoint',
          label: 'Compile Endpoint',
          type: 'text',
          default: '/api/logo/compile',
        },
        {
          key: 'relayBackend',
          label: 'Session Backend',
          type: 'segment',
          default: 'pty',
          options: [
            { label: 'PTY', value: 'pty' },
            { label: 'tmux', value: 'tmux' },
          ],
        },
      ],
    },
    {
      label: 'Model',
      fields: [
        {
          key: 'modelTier',
          label: 'Context Depth',
          type: 'segment',
          default: 'comprehensive',
          options: [
            { label: 'Minimal', value: 'minimal' },
            { label: 'Focused', value: 'focused' },
            { label: 'Comprehensive', value: 'comprehensive' },
          ],
        },
      ],
    },
    {
      label: 'Files',
      fields: [
        {
          key: 'homeFolder',
          label: 'Home Folder',
          type: 'text',
          default: '~/hudson/logos',
        },
      ],
    },
  ],
};
