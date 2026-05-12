export interface AISelectOption {
  value: string;
  label: string;
}

export interface AIModelPreset extends AISelectOption {
  provider: string;
  model: string;
}

export const AI_PROVIDER_OPTIONS: AISelectOption[] = [
  { label: 'MiniMax', value: 'minimax' },
  { label: 'OpenCode', value: 'opencode' },
  { label: 'GitHub Copilot', value: 'github-copilot' },
  { label: 'OpenAI Codex', value: 'openai-codex' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'X.ai', value: 'xai' },
  { label: 'Groq', value: 'groq' },
  { label: 'Google AI', value: 'google' },
];

export const AI_MODEL_OPTIONS: AISelectOption[] = [
  { label: 'Gemini 3 Flash', value: 'gemini-3-flash' },
  { label: 'Gemini 3 Flash', value: 'gemini-3-flash-preview' },
  { label: 'Gemini 3 Pro', value: 'gemini-3-pro-preview' },
  { label: 'Gemini 3.1 Pro', value: 'gemini-3.1-pro-preview' },
  { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
  { label: 'Claude Opus 4.6', value: 'claude-opus-4.6' },
  { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4.6' },
  { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4.5' },
  { label: 'Claude Sonnet 4', value: 'claude-sonnet-4' },
  { label: 'Claude Haiku 4.5', value: 'claude-haiku-4.5' },
  { label: 'GPT-5.4', value: 'gpt-5.4' },
  { label: 'GPT-5.4 Mini', value: 'gpt-5.4-mini' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'GPT-4.1', value: 'gpt-4.1' },
  { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
  { label: 'MiniMax M2.7', value: 'MiniMax-M2.7' },
  { label: 'Grok 4.1 Fast', value: 'grok-4-1-fast' },
  { label: 'Grok Code Fast', value: 'grok-code-fast-1' },
  { label: 'Llama 3.1 405B', value: 'Meta-Llama-3.1-405B-Instruct' },
];

export const HUDSON_AI_DEV_MODEL_PRESETS: AIModelPreset[] = [
  {
    label: 'MiniMax / M2.7',
    value: 'minimax:MiniMax-M2.7',
    provider: 'minimax',
    model: 'MiniMax-M2.7',
  },
  {
    label: 'OpenCode / Gemini 3 Flash',
    value: 'opencode:gemini-3-flash',
    provider: 'opencode',
    model: 'gemini-3-flash',
  },
  {
    label: 'OpenCode / GPT-5.4',
    value: 'opencode:gpt-5.4',
    provider: 'opencode',
    model: 'gpt-5.4',
  },
  {
    label: 'GitHub Copilot / Gemini 3 Flash',
    value: 'github-copilot:gemini-3-flash-preview',
    provider: 'github-copilot',
    model: 'gemini-3-flash-preview',
  },
  {
    label: 'GitHub Copilot / Gemini 3 Pro',
    value: 'github-copilot:gemini-3-pro-preview',
    provider: 'github-copilot',
    model: 'gemini-3-pro-preview',
  },
  {
    label: 'GitHub Copilot / Claude Sonnet 4.6',
    value: 'github-copilot:claude-sonnet-4.6',
    provider: 'github-copilot',
    model: 'claude-sonnet-4.6',
  },
  {
    label: 'GitHub Copilot / GPT-5.4',
    value: 'github-copilot:gpt-5.4',
    provider: 'github-copilot',
    model: 'gpt-5.4',
  },
  {
    label: 'OpenAI Codex / GPT-5.4',
    value: 'openai-codex:gpt-5.4',
    provider: 'openai-codex',
    model: 'gpt-5.4',
  },
  {
    label: 'Anthropic / Claude Sonnet 4',
    value: 'anthropic:claude-sonnet-4-20250514',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
  },
  {
    label: 'OpenAI / GPT-4o Mini',
    value: 'openai:gpt-4o-mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
  },
  {
    label: 'Google / Gemini 2.0 Flash',
    value: 'google:gemini-2.0-flash',
    provider: 'google',
    model: 'gemini-2.0-flash',
  },
  {
    label: 'X.ai / Grok 4.1 Fast',
    value: 'xai:grok-4-1-fast',
    provider: 'xai',
    model: 'grok-4-1-fast',
  },
];

export const DEFAULT_HUDSON_AI_DEV_MODEL_PRESET = HUDSON_AI_DEV_MODEL_PRESETS[0];
export const DEFAULT_HUDSON_AI_DEV_MODEL_PRESET_ID = DEFAULT_HUDSON_AI_DEV_MODEL_PRESET.value;
