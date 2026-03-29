import type { AppSettingsConfig } from '@hudson/sdk';

export const logoSettings: AppSettingsConfig = {
  sections: [
    {
      label: 'AI (Background)',
      fields: [
        {
          key: 'aiProvider',
          label: 'Provider',
          type: 'select',
          default: 'copilot',
          options: [
            { label: 'Copilot', value: 'copilot' },
            { label: 'MiniMax', value: 'minimax' },
            { label: 'GitHub Models', value: 'github' },
            { label: 'Anthropic', value: 'anthropic' },
            { label: 'OpenAI', value: 'openai' },
            { label: 'X.ai', value: 'xai' },
            { label: 'Groq', value: 'groq' },
            { label: 'Google AI', value: 'google' },
          ],
        },
        {
          key: 'aiModel',
          label: 'Model',
          type: 'select',
          default: 'gemini-3-flash-preview',
          options: [
            // Gemini
            { label: 'Gemini 3 Flash', value: 'gemini-3-flash-preview' },
            { label: 'Gemini 3 Pro', value: 'gemini-3-pro-preview' },
            { label: 'Gemini 3.1 Pro', value: 'gemini-3.1-pro-preview' },
            { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
            // Claude
            { label: 'Claude Opus 4.6', value: 'claude-opus-4.6' },
            { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4.6' },
            { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4.5' },
            { label: 'Claude Sonnet 4', value: 'claude-sonnet-4' },
            { label: 'Claude Haiku 4.5', value: 'claude-haiku-4.5' },
            // GPT
            { label: 'GPT-5.4', value: 'gpt-5.4' },
            { label: 'GPT-5.4 Mini', value: 'gpt-5.4-mini' },
            { label: 'GPT-4o', value: 'gpt-4o' },
            { label: 'GPT-4.1', value: 'gpt-4.1' },
            { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
            // Other
            { label: 'MiniMax M2.7', value: 'MiniMax-M2.7' },
            { label: 'Grok Code Fast', value: 'grok-code-fast-1' },
            { label: 'Llama 3.1 405B', value: 'Meta-Llama-3.1-405B-Instruct' },
          ],
        },
      ],
    },
    {
      label: 'Agent (Terminal)',
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
