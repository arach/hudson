import type { AppSettingsConfig } from 'hudsonkit';
import { AI_MODEL_OPTIONS, AI_PROVIDER_OPTIONS } from '../../lib/ai-models';

export const dayStackSettings: AppSettingsConfig = {
  sections: [
    {
      label: 'AI',
      fields: [
        {
          key: 'aiProvider',
          label: 'Provider',
          type: 'select',
          default: 'copilot',
          options: AI_PROVIDER_OPTIONS,
        },
        {
          key: 'aiModel',
          label: 'Model',
          type: 'select',
          default: 'gemini-3-flash-preview',
          options: AI_MODEL_OPTIONS,
        },
      ],
    },
  ],
};
