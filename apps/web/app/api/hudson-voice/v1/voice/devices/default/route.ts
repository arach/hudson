import {
  assertHudsonVoiceSameOriginRequest,
  jsonHudsonVoiceError,
} from '@/app/lib/hudsonVoiceRuntime';
import { writeHudsonVoicePreferences } from '@/app/lib/hudsonVoicePreferences';

export const runtime = 'nodejs';

export async function PUT(request: Request) {
  try {
    assertHudsonVoiceSameOriginRequest(request);
    const body = await request.json().catch(() => ({}));
    const deviceId = readDeviceId(body);
    const preferences = writeHudsonVoicePreferences({
      preferredInputDeviceId: deviceId,
    });
    return Response.json({
      devices: preferences.preferredInputDeviceId
        ? [{
            id: preferences.preferredInputDeviceId,
            name: 'Selected Hudson Voice input',
            isSelected: true,
            isDefault: false,
            source: 'hudson-preferences',
          }]
        : [],
      selectedDeviceId: preferences.preferredInputDeviceId,
      defaultDeviceId: null,
      source: 'hudson-preferences',
      settings: preferences,
    });
  } catch (error) {
    return jsonHudsonVoiceError(error);
  }
}

function readDeviceId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const value = record.deviceId ?? record.inputDeviceId;
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
