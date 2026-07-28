import {
  assertHudsonVoiceSameOriginRequest,
  callHudsonVoiceRuntimeRpc,
  jsonHudsonVoiceError,
  normalizeHudsonVoiceRuntimeHealth,
  readHudsonVoiceRuntimeCapability,
  resolveHudsonVoiceRuntimePath,
} from '@/app/lib/hudsonVoiceRuntime';
import { readHudsonVoicePreferences } from '@/app/lib/hudsonVoicePreferences';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    assertHudsonVoiceSameOriginRequest(request);
    const preferences = readHudsonVoicePreferences();
    const runtimeCapability = readHudsonVoiceRuntimeCapability();
    const health = await callHudsonVoiceRuntimeRpc('health');
    const modelId = preferences.preferredTranscriptionModelId ?? undefined;
    const [models, warmup] = await Promise.all([
      callHudsonVoiceRuntimeRpc('models.list').catch(error => ({ error: errorMessage(error) })),
      modelId
        ? callHudsonVoiceRuntimeRpc('warmup.status', { modelId, clientId: 'hudson-web' })
          .catch(error => ({ error: errorMessage(error) }))
        : Promise.resolve(null),
    ]);

    const normalized = normalizeHudsonVoiceRuntimeHealth(health, runtimeCapability);
    return Response.json({
      ...normalized,
      permissions: {
        microphone: 'granted',
      },
      input: {
        selectedDeviceId: preferences.preferredInputDeviceId,
        selectedDeviceName: preferences.preferredInputDeviceId ? 'Selected Hudson Voice input' : null,
        defaultDeviceId: null,
      },
      settings: preferences,
      model: {
        selectedModelId: modelId ?? null,
        defaultModelId: preferences.preferredTranscriptionModelId,
        readiness: normalizeModelReadiness(modelId, models, warmup),
        models: Array.isArray((models as Record<string, unknown>).models)
          ? (models as { models: unknown[] }).models
          : [],
      },
      troubleshooting: {
        runtimeCapabilityPath: resolveHudsonVoiceRuntimePath(),
        runtimeAlive: true,
        modelReadinessSource: warmup && !('error' in warmup) ? 'warmup.status' : 'placeholder',
      },
    });
  } catch (error) {
    return jsonHudsonVoiceError(error);
  }
}

function normalizeModelReadiness(
  modelId: string | undefined,
  models: Record<string, unknown>,
  warmup: Record<string, unknown> | null,
) {
  if (!modelId) {
    return {
      state: 'placeholder',
      detail: 'No Hudson Voice transcription model is selected.',
    };
  }

  if (warmup && !('error' in warmup)) {
    const rawWarmup = warmup.warmup && typeof warmup.warmup === 'object'
      ? warmup.warmup as Record<string, unknown>
      : warmup;
    return {
      state: typeof rawWarmup.state === 'string' ? rawWarmup.state : 'unknown',
      modelId,
      detail: 'Reported by embedded runtime warmup.status.',
      warmup: rawWarmup,
    };
  }

  if (Array.isArray(models.models)) {
    const model = models.models.find(item => (
      item && typeof item === 'object' && (item as { id?: unknown }).id === modelId
    ));
    if (model && typeof model === 'object') {
      const record = model as Record<string, unknown>;
      return {
        state: record.preloaded ? 'ready' : record.installed ? 'available' : 'not-installed',
        modelId,
        detail: 'Derived from embedded runtime models.list.',
        model: record,
      };
    }
  }

  return {
    state: 'placeholder',
    modelId,
    detail: warmup && 'error' in warmup
      ? String(warmup.error)
      : 'The embedded runtime did not expose model readiness for this model.',
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Hudson Voice runtime probe failed.';
}
