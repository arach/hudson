import {
  assertHudsonVoiceSameOriginRequest,
  jsonHudsonVoiceError,
} from '@/app/lib/hudsonVoiceRuntime';
import { buildHudsonVoiceDeviceList } from '@/app/lib/hudsonVoiceDeviceCache';
import { readHudsonVoicePreferences } from '@/app/lib/hudsonVoicePreferences';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    assertHudsonVoiceSameOriginRequest(request);
    const preferences = readHudsonVoicePreferences();
    const selectedDeviceId = preferences.preferredInputDeviceId;
    const { devices, defaultDeviceId, source } = buildHudsonVoiceDeviceList(selectedDeviceId);

    return Response.json({
      devices,
      selectedDeviceId,
      defaultDeviceId,
      source,
      input: {
        selectedDeviceId,
        selectedDeviceName: devices.find(device => device.id === selectedDeviceId)?.name ?? null,
        defaultDeviceId,
      },
      settings: preferences,
    });
  } catch (error) {
    return jsonHudsonVoiceError(error);
  }
}
