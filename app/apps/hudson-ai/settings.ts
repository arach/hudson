import type { AppSettingsConfig } from 'hudsonkit';
import { AI_MODEL_OPTIONS, AI_PROVIDER_OPTIONS } from '../../lib/ai-models';

export const hudsonAISettings: AppSettingsConfig = {
  sections: [
    {
      label: 'Model',
      fields: [
        {
          key: 'provider',
          label: 'AI Provider',
          type: 'select',
          default: 'copilot',
          options: AI_PROVIDER_OPTIONS,
        },
        {
          key: 'model',
          label: 'AI Model',
          type: 'select',
          default: 'gemini-3-flash-preview',
          options: AI_MODEL_OPTIONS,
        },
      ],
    },
  ],
};
