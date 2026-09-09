export const AI_MODELS_PATH = '/api/ai/models';

export interface AISelectOption {
  value: string;
  label: string;
  provider?: string;
  contextWindow?: number;
}

export interface AIModelPreset extends AISelectOption {
  provider: string;
  model: string;
}

export const AI_PROVIDER_OPTIONS: AISelectOption[] = [
  { label: 'GitHub Copilot', value: 'copilot' },
  { label: 'MiniMax', value: 'minimax' },
  { label: 'GitHub Models', value: 'github' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'X.ai', value: 'xai' },
  { label: 'Groq', value: 'groq' },
  { label: 'Google AI', value: 'google' },
];

// Catalogs are loaded from the server's installed pi-ai registry. Keeping the
// loading state empty prevents stale bundled options from masking new models.
export const AI_MODEL_OPTIONS: AISelectOption[] = [];

export const PI_CLI_PROVIDER_OPTIONS: AISelectOption[] = [
  { label: 'MiniMax', value: 'minimax' },
  { label: 'GitHub Copilot', value: 'github-copilot' },
];
