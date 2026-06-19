import {
  assertHudsonVoiceSameOriginRequest,
  jsonHudsonVoiceError,
} from '@/app/lib/hudsonVoiceRuntime';
import { buildHudsonVoiceDeviceList } from '@/app/lib/hudsonVoiceDeviceCache';
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
    const { devices, defaultDeviceId, source } = buildHudsonVoiceDeviceList(preferences.preferredInputDeviceId);

    return Response.json({
      devices,
      selectedDeviceId: preferences.preferredInputDeviceId,
      defaultDeviceId,
      source,
      settings: preferences,
      input: {
        selectedDeviceId: preferences.preferredInputDeviceId,
        selectedDeviceName: devices.find(device => device.id === preferences.preferredInputDeviceId)?.name ?? null,
        defaultDeviceId,
      },
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
