import {
  assertHudsonVoiceSameOriginRequest,
  jsonHudsonVoiceError,
} from '@/app/lib/hudsonVoiceRuntime';
import {
  readHudsonVoicePreferences,
  writeHudsonVoicePreferences,
  assertHudsonVoiceMode,
  assertHudsonVoiceModelDownloadPolicy,
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
    if (error instanceof Error && error.message.startsWith('Invalid Hudson voice ')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
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
    modelDownloadPolicy: source.modelDownloadPolicy === undefined
      ? undefined
      : assertHudsonVoiceModelDownloadPolicy(source.modelDownloadPolicy),
    mode: source.mode === undefined ? undefined : assertHudsonVoiceMode(source.mode),
  };
}

function clean(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
