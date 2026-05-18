import type { AppSettingsConfig } from 'hudsonkit';
import { AI_MODEL_OPTIONS, AI_PROVIDER_OPTIONS } from '../../lib/ai-models';

export const hudsonAISettings: AppSettingsConfig = {
  sections: [
    {
      label: 'AI (Hudson)',
      fields: [
        {
          key: 'provider',
          label: 'Provider',
          description: 'Hudson AI runs through the Pi backend. GitHub Copilot maps to the Pi provider github-copilot.',
          type: 'select',
          default: 'copilot',
          options: AI_PROVIDER_OPTIONS,
        },
        {
          key: 'model',
          label: 'Model',
          description: 'Default model for Hudson-level chat, voice replies, and workspace actions.',
          type: 'select',
          default: 'gemini-3-flash-preview',
          options: AI_MODEL_OPTIONS,
        },
      ],
    },
  ],
};
