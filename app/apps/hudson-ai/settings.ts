import type { AppSettingsConfig } from 'hudsonkit';
import { AI_MODEL_OPTIONS, AI_PROVIDER_OPTIONS, type AISelectOption } from '../../lib/ai-models';

export function createHudsonAISettings(
  modelOptions: AISelectOption[] = AI_MODEL_OPTIONS,
): AppSettingsConfig {
  return {
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
            options: modelOptions,
          },
        ],
      },
    ],
  };
}

export const hudsonAISettings: AppSettingsConfig = createHudsonAISettings();
