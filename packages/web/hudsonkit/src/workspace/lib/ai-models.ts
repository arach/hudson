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
  { label: 'MiniMax', value: 'minimax' },
  { label: 'Codex', value: 'openai-codex' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'X.ai', value: 'xai' },
  { label: 'Groq', value: 'groq' },
  { label: 'Google AI', value: 'google' },
];

/**
 * Codex (openai-codex) chat models offered by Hudson's pi-ai backend.
 *
 * Mirrors the `openai-codex` provider registered by @earendil-works/pi-ai
 * 0.78.1; the pi-ai runtime routes these through the ChatGPT Codex backend by
 * exact model id.
 */
export const CODEX_MODEL_OPTIONS: AISelectOption[] = [
  { label: 'GPT-5.5', value: 'gpt-5.5', provider: 'openai-codex', contextWindow: 272_000 },
  { label: 'GPT-5.4', value: 'gpt-5.4', provider: 'openai-codex', contextWindow: 272_000 },
  { label: 'GPT-5.4 Mini', value: 'gpt-5.4-mini', provider: 'openai-codex', contextWindow: 272_000 },
  { label: 'GPT-5.3 Codex Spark', value: 'gpt-5.3-codex-spark', provider: 'openai-codex', contextWindow: 128_000 },
];

const GENERAL_MODEL_OPTIONS: AISelectOption[] = [
  { label: 'MiniMax M3', value: 'MiniMax-M3', provider: 'minimax', contextWindow: 512_000 },
  { label: 'MiniMax M2.7', value: 'MiniMax-M2.7', provider: 'minimax', contextWindow: 204_800 },
  { label: 'MiniMax M2.7 High Speed', value: 'MiniMax-M2.7-highspeed', provider: 'minimax', contextWindow: 204_800 },
  { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash', provider: 'google' },
  { label: 'Grok 4.1 Fast', value: 'grok-4-1-fast', provider: 'xai' },
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
  ...GENERAL_MODEL_OPTIONS,
  ...CODEX_MODEL_OPTIONS,
]);

export function mergeCodexModelOptions(liveCodexOptions: AISelectOption[] | null | undefined) {
  if (!liveCodexOptions?.length) return AI_MODEL_OPTIONS;
  return dedupeOptions([
    ...liveCodexOptions.map(option => ({ ...option, provider: 'openai-codex' })),
    ...AI_MODEL_OPTIONS.filter(option => option.provider !== 'openai-codex'),
  ]);
}

export const PI_CLI_PROVIDER_OPTIONS: AISelectOption[] = [
  { label: 'MiniMax', value: 'minimax' },
  { label: 'Codex', value: 'openai-codex' },
];

export const PI_CLI_MODEL_OPTIONS: AISelectOption[] = [
  { label: 'MiniMax M3', value: 'MiniMax-M3' },
  { label: 'MiniMax M2.7', value: 'MiniMax-M2.7' },
  { label: 'MiniMax M2.7 High Speed', value: 'MiniMax-M2.7-highspeed' },
  ...CODEX_MODEL_OPTIONS.map(option => ({
    ...option,
    label: `Codex / ${option.label}`,
    provider: 'openai-codex',
  })),
];

export const HUDSON_AI_DEV_MODEL_PRESETS: AIModelPreset[] = [
  {
    label: 'MiniMax / M3',
    value: 'minimax:MiniMax-M3',
    provider: 'minimax',
    model: 'MiniMax-M3',
  },
  {
    label: 'Codex / GPT-5.5',
    value: 'openai-codex:gpt-5.5',
    provider: 'openai-codex',
    model: 'gpt-5.5',
  },
  {
    label: 'Codex / GPT-5.4',
    value: 'openai-codex:gpt-5.4',
    provider: 'openai-codex',
    model: 'gpt-5.4',
  },
  {
    label: 'Codex / GPT-5.4 Mini',
    value: 'openai-codex:gpt-5.4-mini',
    provider: 'openai-codex',
    model: 'gpt-5.4-mini',
  },
  {
    label: 'Codex / GPT-5.3 Codex Spark',
    value: 'openai-codex:gpt-5.3-codex-spark',
    provider: 'openai-codex',
    model: 'gpt-5.3-codex-spark',
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
