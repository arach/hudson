import {
  assertHudsonVoiceSameOriginRequest,
  jsonHudsonVoiceError,
} from '@/app/lib/hudsonVoiceRuntime';
import { readHudsonVoicePreferences } from '@/app/lib/hudsonVoicePreferences';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    assertHudsonVoiceSameOriginRequest(request);
    const preferences = readHudsonVoicePreferences();
    const selectedDeviceId = preferences.preferredInputDeviceId;
    return Response.json({
      devices: selectedDeviceId
        ? [{
            id: selectedDeviceId,
            name: 'Selected Hudson Voice input',
            isSelected: true,
            isDefault: false,
            source: 'hudson-preferences',
          }]
        : [],
      selectedDeviceId,
      defaultDeviceId: null,
      source: 'hudson-preferences',
      input: {
        selectedDeviceId,
        selectedDeviceName: selectedDeviceId ? 'Selected Hudson Voice input' : null,
      },
      settings: preferences,
    });
  } catch (error) {
    return jsonHudsonVoiceError(error);
  }
}
