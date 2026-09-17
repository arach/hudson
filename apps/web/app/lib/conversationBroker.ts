import 'server-only';
import { buildGPTLiveDelegation, createGPTLiveWebRTCSession, validateGPTLiveConfig, type ConversationConfig } from '@hudsonkit/ai/conversation';
import { rejectUntrustedLocalRequest } from './localRequestGuard';
import { loadHudsonLocalSecrets } from './localSecretVault';
import { countWordsTool } from '../apps/hudson-voice/voice-tools';

// Next's Node adapter can normalize Request.url to localhost while preserving
// the browser-facing authority in Host. Validate that actual authority with the
// existing loopback guard; never trust forwarded-host or broaden allowed origins.
function browserRequest(request: Request): Request {
  const url = new URL(request.url);
  const host = request.headers.get('host');
  if (host) {
    const authority = new URL(`${url.protocol}//${host}`);
    if (authority.username || authority.password || authority.pathname !== '/' || authority.search || authority.hash) throw new Error('Invalid authority');
    url.host = authority.host;
  }
  return new Request(url, { headers: request.headers });
}
const BODY_LIMIT = 65_536;
const SESSION_SECONDS = 90;
const INSTRUCTIONS = 'You are Hudson Voice, a concise spoken assistant. The only tool available is count_words, which counts supplied text locally. You have no browser, filesystem, search, or code execution access. Do not claim to have performed actions that are unavailable. Keep spoken answers brief.';
export interface BrokerDependencies {
  environment(): Record<string, string | undefined>;
  key(): string | undefined;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  now(): number;
  timeoutMs: number;
}
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { 'cache-control': 'no-store' } }); }
/** Local portal only; production hosts need an authenticated, per-user broker. */
export function createConversationBroker(deps: BrokerDependencies) {
  let attempts: number[] = [];
  function setup() {
    const env = deps.environment();
    const config: ConversationConfig = { provider: 'openai-gpt-live', model: env.GPT_LIVE_MODEL?.trim() || 'gpt-live-1',
      inputSampleRate: 24000, instructions: INSTRUCTIONS,
      ...(env.GPT_LIVE_VOICE?.trim() ? { voice: env.GPT_LIVE_VOICE.trim() } : {}),
      options: { delegationModel: env.GPT_LIVE_DELEGATION_MODEL?.trim() || '' },
    };
    const key = deps.key()?.trim();
    const ready = !!key && !!config.options?.delegationModel && !validateGPTLiveConfig(config);
    return { key, config, ready };
  }
  return {
    async status(request: Request) {
      let local: Request;
      try { local = browserRequest(request); } catch { return json({ error: 'Invalid request host.' }, 403); }
      const rejected = rejectUntrustedLocalRequest(local); if (rejected) return rejected;
      try {
        const { config, ready } = setup();
        return json({ ready, config, sessionLimitSeconds: SESSION_SECONDS,
          message: ready ? 'Ready to connect.' : 'Set OPENAI_API_KEY and GPT_LIVE_DELEGATION_MODEL on the Hudson server, then check again.' });
      } catch { return json({ ready: false, sessionLimitSeconds: SESSION_SECONDS, message: 'Server credentials could not be loaded. Check the local Hudson vault.' }); }
    },
    async session(request: Request) {
      let local: Request;
      try { local = browserRequest(request); } catch { return json({ error: 'Invalid request host.' }, 403); }
      const rejected = rejectUntrustedLocalRequest(local); if (rejected) return rejected;
      if (request.headers.get('origin') !== new URL(local.url).origin) return json({ error: 'A same-origin browser request is required.' }, 403);
      if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return json({ error: 'JSON is required.' }, 415);
      if (Number(request.headers.get('content-length') ?? 0) > BODY_LIMIT) return json({ error: 'Request is too large.' }, 413);
      let body: unknown;
      const reader = request.body?.getReader();
      if (!reader) return json({ error: 'SDP is required.' }, 400);
      const chunks: Uint8Array[] = []; let length = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          length += value.byteLength;
          if (length > BODY_LIMIT) { await reader.cancel(); return json({ error: 'Request is too large.' }, 413); }
          chunks.push(value);
        }
        const bytes = new Uint8Array(length); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      } catch { return json({ error: 'Invalid JSON request.' }, 400); }
      finally { reader.releaseLock(); }
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !('sdp' in body) || typeof body.sdp !== 'string' || !body.sdp.trim()) return json({ error: 'Only a nonempty SDP offer is accepted.' }, 400);
      try {
        const { key, config, ready } = setup();
        if (!ready || !key) return json({ error: 'Voice server setup is incomplete.' }, 503);
        const now = deps.now(); attempts = attempts.filter(time => now - time < 60_000);
        if (attempts.length >= 3) return json({ error: 'Connection limit reached. Wait one minute before retrying.' }, 429);
        attempts.push(now);
        const abort = new AbortController();
        const cancelled = () => abort.abort(); request.signal.addEventListener('abort', cancelled, { once: true });
        if (request.signal.aborted) abort.abort();
        const timer = setTimeout(() => abort.abort(), deps.timeoutMs);
        try {
          const session: Record<string, unknown> = { model: config.model, instructions: config.instructions,
            delegation: buildGPTLiveDelegation(config, [countWordsTool]) };
          if (config.voice) session.audio = { output: { voice: config.voice } };
          const answer = await createGPTLiveWebRTCSession({ apiKey: key, offerSdp: body.sdp, session,
            fetchImpl: (url, init) => deps.fetch(url, { ...init, signal: abort.signal }),
          });
          return json({ sdp: answer.answerSdp, sessionId: answer.sessionId });
        } finally { clearTimeout(timer); request.signal.removeEventListener('abort', cancelled); }
      } catch { return json({ error: 'The voice provider could not open a session. Check server setup and retry.' }, 502); }
    },
  };
}
export const conversationBroker = createConversationBroker({
  environment: () => process.env,
  key: () => process.env.OPENAI_API_KEY || loadHudsonLocalSecrets().OPENAI_API_KEY,
  fetch: (...args) => fetch(...args), now: Date.now, timeoutMs: 20_000,
});
