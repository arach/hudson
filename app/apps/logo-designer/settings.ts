import type { AppSettingsConfig } from '@hudson/sdk';

export const logoSettings: AppSettingsConfig = {
  sections: [
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
