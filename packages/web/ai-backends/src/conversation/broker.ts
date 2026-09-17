import { ConversationError, isBrowserEnvironment, type FetchLike } from './types';
import { record } from './wire';

// ---------------------------------------------------------------------------
// Credential brokerage: the host backend holds long-lived provider secrets
// and hands browsers only short-lived grants. Nothing in this module runs in
// a browser — every function refuses when DOM globals exist. Two grant
// shapes exist:
// - Gemini: a short-lived ephemeral token the browser uses as a session key.
// - GPT-Live WebRTC: the backend performs the SDP exchange; the browser
//   never sees a credential at all, only the answer SDP.
//
// These helpers are NOT an endpoint. The backend route that calls them must
// authenticate the caller and decide the model, session configuration, and
// token constraints server-side — never from unauthenticated request input.
// The sample host wiring shows that shape.
// ---------------------------------------------------------------------------

function assertServerSide(what: string): void {
  if (isBrowserEnvironment()) {
    throw new ConversationError(
      'credential-boundary',
      `${what} holds a provider API key and runs on the host backend, never in a browser.`,
    );
  }
}

export interface EphemeralTokenGrant {
  /** Pass to `connectGeminiLive` as `{ kind: 'ephemeralToken', token }`. */
  token: string;
  /** ISO timestamp after which new messages are refused. */
  expireTime?: string;
  /** ISO timestamp after which the token cannot start a new session. */
  newSessionExpireTime?: string;
}

/**
 * Mint a Gemini Live ephemeral token (POST /v1beta/auth_tokens). Lock the
 * token to a model where possible; tokens are only as safe as the backend
 * authentication in front of this call.
 */
export async function mintGeminiEphemeralToken(options: {
  apiKey: string;
  model?: string;
  uses?: number;
  expireSeconds?: number;
  newSessionExpireSeconds?: number;
  host?: string;
  fetchImpl?: FetchLike;
}): Promise<EphemeralTokenGrant> {
  assertServerSide('Minting Gemini ephemeral tokens');
  const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  const host = options.host ?? 'generativelanguage.googleapis.com';
  const now = Date.now();
  const body: Record<string, unknown> = {
    uses: options.uses ?? 1,
    expireTime: new Date(now + (options.expireSeconds ?? 60 * 5) * 1000).toISOString(),
    newSessionExpireTime: new Date(now + (options.newSessionExpireSeconds ?? 60) * 1000).toISOString(),
  };
  if (options.model) {
    body.liveConnectConstraints = { model: `models/${options.model}` };
  }
  const response = await fetchImpl(`https://${host}/v1beta/auth_tokens`, {
    method: 'POST',
    headers: { 'x-goog-api-key': options.apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new ConversationError('credential-boundary', 'Minting the ephemeral token did not succeed.');
  }
  const payload = record(await response.json());
  const name = typeof payload?.name === 'string' ? payload.name : null;
  if (!name) {
    throw new ConversationError('credential-boundary', 'The token response carried no token name.');
  }
  return {
    token: name,
    expireTime: typeof payload?.expireTime === 'string' ? payload.expireTime : undefined,
    newSessionExpireTime:
      typeof payload?.newSessionExpireTime === 'string' ? payload.newSessionExpireTime : undefined,
  };
}

export interface GPTLiveWebRTCAnswer {
  sessionId?: string;
  answerSdp: string;
}

/**
 * Perform the GPT-Live WebRTC session exchange on the backend
 * (POST /v1/live/sessions with the browser's SDP offer). The browser sends
 * its offer to the host endpoint that calls this; only the answer SDP goes
 * back — never the API key.
 */
export async function createGPTLiveWebRTCSession(options: {
  apiKey: string;
  offerSdp: string;
  session: Record<string, unknown>;
  baseUrl?: string;
  fetchImpl?: FetchLike;
}): Promise<GPTLiveWebRTCAnswer> {
  assertServerSide('The GPT-Live session exchange');
  const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  const response = await fetchImpl(`${options.baseUrl ?? 'https://api.openai.com'}/v1/live/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${options.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      session: options.session,
      transport: { type: 'webrtc', sdp: options.offerSdp },
    }),
  });
  if (!response.ok) {
    throw new ConversationError('connection-failed', 'The GPT-Live session exchange did not succeed.');
  }
  const payload = record(await response.json());
  const transport = record(payload?.transport);
  const sdp = typeof transport?.sdp === 'string' ? transport.sdp : null;
  if (!sdp) {
    throw new ConversationError('connection-failed', 'The session exchange returned no answer SDP.');
  }
  const session = record(payload?.session);
  return {
    answerSdp: sdp,
    sessionId: typeof session?.id === 'string' ? session.id : undefined,
  };
}
