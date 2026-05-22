import type { AppSettingsConfig } from 'hudsonkit';
import {
  AI_MODEL_OPTIONS,
  AI_PROVIDER_OPTIONS,
  PI_CLI_MODEL_OPTIONS,
  PI_CLI_PROVIDER_OPTIONS,
} from '../../lib/ai-models';

export const logoSettings: AppSettingsConfig = {
  sections: [
    {
      label: 'AI (Logo)',
      fields: [
        {
          key: 'aiProvider',
          label: 'Provider',
          description: 'Logo chat and background edits run through the Pi backend. This is independent from terminal settings.',
          type: 'select',
          default: 'minimax',
          options: AI_PROVIDER_OPTIONS,
        },
        {
          key: 'aiModel',
          label: 'Model',
          description: 'Default model for Logo chat, template generation, and parameter edits.',
          type: 'select',
          default: 'MiniMax-M2.7',
          options: AI_MODEL_OPTIONS,
        },
      ],
    },
    {
      label: 'Terminal (Logo)',
      fields: [
        {
          key: 'terminalAgent',
          label: 'CLI Agent',
          description: 'XTerm -> Hudson Relay -> Claude CLI by default. Switch to Pi only for app-specific terminal experiments.',
          type: 'segment',
          default: 'claude',
          options: [
            { label: 'Claude', value: 'claude' },
            { label: 'Pi', value: 'pi' },
          ],
        },
        {
          key: 'terminalProvider',
          label: 'Pi Provider',
          description: 'Only used when the Logo terminal CLI agent is Pi. The Pi CLI expects github-copilot, not copilot.',
          type: 'select',
          default: 'minimax',
          options: PI_CLI_PROVIDER_OPTIONS,
        },
        {
          key: 'terminalModel',
          label: 'Pi Model',
          description: 'Only used when the Logo terminal CLI agent is Pi.',
          type: 'select',
          default: 'MiniMax-M2.7',
          options: PI_CLI_MODEL_OPTIONS,
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
