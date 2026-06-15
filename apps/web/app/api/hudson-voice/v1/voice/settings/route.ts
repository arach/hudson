import {
  assertHudsonVoiceSameOriginRequest,
  jsonHudsonVoiceError,
} from '@/app/lib/hudsonVoiceRuntime';
import {
  readHudsonVoicePreferences,
  writeHudsonVoicePreferences,
  type HudsonVoicePreferences,
} from '@/app/lib/hudsonVoicePreferences';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    assertHudsonVoiceSameOriginRequest(request);
    return Response.json({ settings: readHudsonVoicePreferences() });
  } catch (error) {
    return jsonHudsonVoiceError(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertHudsonVoiceSameOriginRequest(request);
    const body = await request.json().catch(() => ({}));
    const settings = readSettingsPatch(body);
    return Response.json({ settings: writeHudsonVoicePreferences(settings) });
  } catch (error) {
    return jsonHudsonVoiceError(error);
  }
}

function readSettingsPatch(body: unknown): Partial<HudsonVoicePreferences> {
  const record = body && typeof body === 'object'
    ? body as Record<string, unknown>
    : {};
  const source = record.settings && typeof record.settings === 'object'
    ? record.settings as Record<string, unknown>
    : record;

  return {
    preferredInputDeviceId: clean(source.preferredInputDeviceId ?? source.inputDeviceId),
    preferredOutputDeviceId: clean(source.preferredOutputDeviceId ?? source.outputDeviceId),
    preferredTranscriptionModelId: clean(source.preferredTranscriptionModelId ?? source.modelId),
    preferredSynthesisModelId: clean(source.preferredSynthesisModelId),
    preferredLanguage: clean(source.preferredLanguage ?? source.language),
    mode: clean(source.mode) ?? undefined,
  };
}

function clean(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
