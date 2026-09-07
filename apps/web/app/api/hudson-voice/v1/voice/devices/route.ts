import {
  assertHudsonVoiceSameOriginRequest,
  jsonHudsonVoiceError,
  readHudsonVoiceRuntimeCapability,
} from '@/app/lib/hudsonVoiceRuntime';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    assertHudsonVoiceSameOriginRequest(request);
    readHudsonVoiceRuntimeCapability();
    return Response.json({ devices: [] });
  } catch (error) {
    return jsonHudsonVoiceError(error);
  }
}
