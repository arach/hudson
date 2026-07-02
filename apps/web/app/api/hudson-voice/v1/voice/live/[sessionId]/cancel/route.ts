import {
  assertHudsonVoiceSameOriginRequest,
  callHudsonVoiceRuntimeRpc,
  jsonHudsonVoiceError,
} from '@/app/lib/hudsonVoiceRuntime';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    assertHudsonVoiceSameOriginRequest(request);
    const { sessionId } = await params;
    const body = await request.json().catch(() => ({}));
    const clientId = body && typeof body === 'object' && 'clientId' in body
      ? (body as { clientId?: unknown }).clientId
      : undefined;
    await callHudsonVoiceRuntimeRpc('transcribe.cancelSession', {
      sessionId,
      clientId: typeof clientId === 'string' ? clientId : 'hudsonkit',
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return jsonHudsonVoiceError(error);
  }
}
