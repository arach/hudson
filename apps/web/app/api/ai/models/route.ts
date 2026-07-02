import { NextResponse } from 'next/server';
import {
  AI_MODEL_OPTIONS,
  COPILOT_MODEL_OPTIONS,
  mergeCopilotModelOptions,
  type AISelectOption,
} from '@/app/lib/ai-models';
import { fetchCopilotChatModels } from '../copilot-auth';

export const dynamic = 'force-dynamic';

interface CopilotModelEntry {
  id?: unknown;
  name?: unknown;
  capabilities?: {
    type?: unknown;
    limits?: {
      max_context_window_tokens?: unknown;
    };
  };
}

interface CopilotModelsResponse {
  data?: CopilotModelEntry[];
}

const OFFERED_COPILOT_MODELS = new Map(
  COPILOT_MODEL_OPTIONS.map(option => [option.value, option]),
);

function normalizeCopilotModels(payload: unknown) {
  const data = (payload as CopilotModelsResponse | null)?.data;
  if (!Array.isArray(data)) return [];

  return data
    .filter(entry => entry.capabilities?.type === 'chat')
    .flatMap(entry => {
      if (typeof entry.id !== 'string') return [];
      const contextWindow = entry.capabilities?.limits?.max_context_window_tokens;
      return [{
        id: entry.id,
        label: typeof entry.name === 'string' ? entry.name : entry.id,
        contextWindow: typeof contextWindow === 'number' ? contextWindow : undefined,
      }];
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function toOfferedOptions(
  liveModels: ReturnType<typeof normalizeCopilotModels>,
): AISelectOption[] {
  const liveModelMap = new Map(liveModels.map(model => [model.id, model]));
  return COPILOT_MODEL_OPTIONS.flatMap(offered => {
    const model = liveModelMap.get(offered.value);
    if (!model) return [];
    return [{
      ...offered,
      contextWindow: model.contextWindow ?? offered.contextWindow,
    }];
  });
}

export async function GET(req: Request) {
  const provider = new URL(req.url).searchParams.get('provider') ?? 'copilot';

  if (provider !== 'copilot' && provider !== 'github-copilot') {
    return NextResponse.json({
      provider,
      source: 'static',
      fetchedAt: new Date().toISOString(),
      models: AI_MODEL_OPTIONS,
      options: AI_MODEL_OPTIONS,
    });
  }

  try {
    const payload = await fetchCopilotChatModels();
    const liveModels = normalizeCopilotModels(payload);
    const liveOptions = toOfferedOptions(liveModels);
    const modelOptions = mergeCopilotModelOptions(liveOptions);

    return NextResponse.json({
      provider: 'copilot',
      source: 'live',
      fetchedAt: new Date().toISOString(),
      models: liveModels,
      offeredModelIds: liveOptions.map(option => option.value),
      unavailableOfferedModelIds: COPILOT_MODEL_OPTIONS
        .map(option => option.value)
        .filter(id => !liveOptions.some(option => option.value === id)),
      unofferedAvailableModelIds: liveModels
        .map(model => model.id)
        .filter(id => !OFFERED_COPILOT_MODELS.has(id)),
      options: modelOptions,
    });
  } catch (error) {
    return NextResponse.json({
      provider: 'copilot',
      source: 'static',
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      models: COPILOT_MODEL_OPTIONS,
      options: AI_MODEL_OPTIONS,
    });
  }
}
