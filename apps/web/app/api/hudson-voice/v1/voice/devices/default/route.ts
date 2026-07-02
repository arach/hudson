import {
  assertHudsonVoiceSameOriginRequest,
  jsonHudsonVoiceError,
  readHudsonVoiceRuntimeCapability,
} from '@/app/lib/hudsonVoiceRuntime';

export const runtime = 'nodejs';

export async function PUT(request: Request) {
  try {
    assertHudsonVoiceSameOriginRequest(request);
    readHudsonVoiceRuntimeCapability();
    const body = await request.json().catch(() => ({}));
    const deviceId = body && typeof body === 'object' && 'deviceId' in body
      ? (body as { deviceId?: unknown }).deviceId
      : undefined;
    return Response.json({
      devices: [],
      selectedDeviceId: typeof deviceId === 'string' ? deviceId : null,
    });
  } catch (error) {
    return jsonHudsonVoiceError(error);
  }
}
