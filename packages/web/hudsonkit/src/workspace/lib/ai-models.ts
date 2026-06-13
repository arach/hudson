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
  { label: 'xAI', value: 'xai' },
  { label: 'Groq', value: 'groq' },
  { label: 'Google AI', value: 'google' },
];

/**
 * Copilot chat models offered by Hudson.
 *
 * Refreshed from pi-ai's registry on 2026-06-13. The runtime registry remains
 * authoritative; this list keeps static settings and fallback controls current.
 */
export const COPILOT_MODEL_OPTIONS: AISelectOption[] = [
  { label: 'GPT-5.5', value: 'gpt-5.5', provider: 'copilot', contextWindow: 400_000 },
  { label: 'GPT-5.4', value: 'gpt-5.4', provider: 'copilot', contextWindow: 400_000 },
  { label: 'GPT-5.4 Mini', value: 'gpt-5.4-mini', provider: 'copilot', contextWindow: 400_000 },
  { label: 'GPT-5.4 Nano', value: 'gpt-5.4-nano', provider: 'copilot', contextWindow: 400_000 },
  { label: 'GPT-5.3 Codex', value: 'gpt-5.3-codex', provider: 'copilot', contextWindow: 400_000 },
  { label: 'GPT-5.2 Codex', value: 'gpt-5.2-codex', provider: 'copilot', contextWindow: 400_000 },
  { label: 'GPT-5.2', value: 'gpt-5.2', provider: 'copilot', contextWindow: 400_000 },
  { label: 'GPT-5 Mini', value: 'gpt-5-mini', provider: 'copilot', contextWindow: 264_000 },
  { label: 'Claude Opus 4.8', value: 'claude-opus-4.8', provider: 'copilot', contextWindow: 200_000 },
  { label: 'Claude Opus 4.7', value: 'claude-opus-4.7', provider: 'copilot', contextWindow: 200_000 },
  { label: 'Claude Opus 4.6', value: 'claude-opus-4.6', provider: 'copilot', contextWindow: 1_000_000 },
  { label: 'Claude Opus 4.5', value: 'claude-opus-4.5', provider: 'copilot', contextWindow: 200_000 },
  { label: 'Claude Sonnet 4', value: 'claude-sonnet-4', provider: 'copilot', contextWindow: 216_000 },
  { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4.6', provider: 'copilot', contextWindow: 1_000_000 },
  { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4.5', provider: 'copilot', contextWindow: 200_000 },
  { label: 'Claude Haiku 4.5', value: 'claude-haiku-4.5', provider: 'copilot', contextWindow: 200_000 },
  { label: 'Gemini 3.1 Pro', value: 'gemini-3.1-pro-preview', provider: 'copilot', contextWindow: 128_000 },
  { label: 'Gemini 3 Flash', value: 'gemini-3-flash-preview', provider: 'copilot', contextWindow: 128_000 },
  { label: 'Gemini 3.5 Flash', value: 'gemini-3.5-flash', provider: 'copilot', contextWindow: 200_000 },
  { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro', provider: 'copilot', contextWindow: 128_000 },
  { label: 'GPT-4.1', value: 'gpt-4.1', provider: 'copilot', contextWindow: 128_000 },
  { label: 'GPT-4o', value: 'gpt-4o', provider: 'copilot', contextWindow: 128_000 },
  { label: 'Raptor Mini', value: 'raptor-mini', provider: 'copilot', contextWindow: 400_000 },
];

const GENERAL_MODEL_OPTIONS: AISelectOption[] = [
  { label: 'MiniMax M3', value: 'MiniMax-M3', provider: 'minimax', contextWindow: 512_000 },
  { label: 'MiniMax M2.7', value: 'MiniMax-M2.7', provider: 'minimax' },
  { label: 'MiniMax M2.7 High Speed', value: 'MiniMax-M2.7-highspeed', provider: 'minimax' },
  { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash', provider: 'google' },
  { label: 'Grok 4.3', value: 'grok-4.3', provider: 'xai', contextWindow: 1_000_000 },
  { label: 'Grok 4.20 Reasoning', value: 'grok-4.20-0309-reasoning', provider: 'xai', contextWindow: 2_000_000 },
  { label: 'Grok 4.20 Non-Reasoning', value: 'grok-4.20-0309-non-reasoning', provider: 'xai', contextWindow: 2_000_000 },
  { label: 'Grok Build 0.1', value: 'grok-build-0.1', provider: 'xai', contextWindow: 256_000 },
  { label: 'Grok Code Fast 1', value: 'grok-code-fast-1', provider: 'xai', contextWindow: 32_768 },
  { label: 'Llama 3.3 70B Versatile', value: 'llama-3.3-70b-versatile', provider: 'groq' },
];

function dedupeOptions(options: AISelectOption[]) {
  const seen = new Set<string>();
  return options.filter(option => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

export const AI_MODEL_OPTIONS: AISelectOption[] = dedupeOptions([
  ...COPILOT_MODEL_OPTIONS,
  ...GENERAL_MODEL_OPTIONS,
]);

export function mergeCopilotModelOptions(liveCopilotOptions: AISelectOption[] | null | undefined) {
  if (!liveCopilotOptions?.length) return AI_MODEL_OPTIONS;
  return dedupeOptions([
    ...liveCopilotOptions.map(option => ({ ...option, provider: 'copilot' })),
    ...AI_MODEL_OPTIONS.filter(option => option.provider !== 'copilot'),
  ]);
}

export const PI_CLI_PROVIDER_OPTIONS: AISelectOption[] = [
  { label: 'MiniMax', value: 'minimax' },
  { label: 'xAI', value: 'xai' },
  { label: 'GitHub Copilot', value: 'github-copilot' },
];

export const PI_CLI_MODEL_OPTIONS: AISelectOption[] = [
  { label: 'MiniMax M3', value: 'MiniMax-M3', provider: 'minimax' },
  { label: 'MiniMax M2.7', value: 'MiniMax-M2.7' },
  { label: 'MiniMax M2.7 High Speed', value: 'MiniMax-M2.7-highspeed' },
  { label: 'xAI / Grok 4.3', value: 'grok-4.3', provider: 'xai' },
  { label: 'xAI / Grok 4.20 Reasoning', value: 'grok-4.20-0309-reasoning', provider: 'xai' },
  { label: 'xAI / Grok 4.20 Non-Reasoning', value: 'grok-4.20-0309-non-reasoning', provider: 'xai' },
  { label: 'xAI / Grok Build 0.1', value: 'grok-build-0.1', provider: 'xai' },
  { label: 'xAI / Grok Code Fast 1', value: 'grok-code-fast-1', provider: 'xai' },
  ...COPILOT_MODEL_OPTIONS.map(option => ({
    ...option,
    label: `Copilot / ${option.label}`,
    provider: 'github-copilot',
  })),
];

export const HUDSON_AI_DEV_MODEL_PRESETS: AIModelPreset[] = [
  {
    label: 'Copilot / Gemini 3 Flash',
    value: 'copilot:gemini-3-flash-preview',
    provider: 'copilot',
    model: 'gemini-3-flash-preview',
  },
  {
    label: 'Copilot / Gemini 3.1 Pro',
    value: 'copilot:gemini-3.1-pro-preview',
    provider: 'copilot',
    model: 'gemini-3.1-pro-preview',
  },
  {
    label: 'Copilot / GPT-5.5',
    value: 'copilot:gpt-5.5',
    provider: 'copilot',
    model: 'gpt-5.5',
  },
  {
    label: 'Copilot / Claude Sonnet 4.6',
    value: 'copilot:claude-sonnet-4.6',
    provider: 'copilot',
    model: 'claude-sonnet-4.6',
  },
  {
    label: 'Copilot / GPT-5.4',
    value: 'copilot:gpt-5.4',
    provider: 'copilot',
    model: 'gpt-5.4',
  },
  {
    label: 'Copilot / GPT-5.3 Codex',
    value: 'copilot:gpt-5.3-codex',
    provider: 'copilot',
    model: 'gpt-5.3-codex',
  },
  {
    label: 'Copilot / GPT-4o',
    value: 'copilot:gpt-4o',
    provider: 'copilot',
    model: 'gpt-4o',
  },
  {
    label: 'MiniMax / M3',
    value: 'minimax:MiniMax-M3',
    provider: 'minimax',
    model: 'MiniMax-M3',
  },
  {
    label: 'xAI / Grok 4.3',
    value: 'xai:grok-4.3',
    provider: 'xai',
    model: 'grok-4.3',
  },
  {
    label: 'xAI / Grok 4.20 Reasoning',
    value: 'xai:grok-4.20-0309-reasoning',
    provider: 'xai',
    model: 'grok-4.20-0309-reasoning',
  },
  {
    label: 'xAI / Grok 4.20 Non-Reasoning',
    value: 'xai:grok-4.20-0309-non-reasoning',
    provider: 'xai',
    model: 'grok-4.20-0309-non-reasoning',
  },
  {
    label: 'xAI / Grok Build 0.1',
    value: 'xai:grok-build-0.1',
    provider: 'xai',
    model: 'grok-build-0.1',
  },
  {
    label: 'xAI / Grok Code Fast 1',
    value: 'xai:grok-code-fast-1',
    provider: 'xai',
    model: 'grok-code-fast-1',
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
];

export const DEFAULT_HUDSON_AI_DEV_MODEL_PRESET = HUDSON_AI_DEV_MODEL_PRESETS[0];
export const DEFAULT_HUDSON_AI_DEV_MODEL_PRESET_ID = DEFAULT_HUDSON_AI_DEV_MODEL_PRESET.value;
