import {
  assertHudsonVoiceSameOriginRequest,
  callHudsonVoiceRuntimeRpc,
  jsonHudsonVoiceError,
  normalizeHudsonVoiceRuntimeHealth,
  readHudsonVoiceRuntimeCapability,
} from '@/app/lib/hudsonVoiceRuntime';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    assertHudsonVoiceSameOriginRequest(request);
    const runtimeCapability = readHudsonVoiceRuntimeCapability();
    const health = await callHudsonVoiceRuntimeRpc('health');
    return Response.json(normalizeHudsonVoiceRuntimeHealth(health, runtimeCapability));
  } catch (error) {
    return jsonHudsonVoiceError(error);
  }
}
