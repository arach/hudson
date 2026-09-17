import { ConversationError, type FetchLike } from '../types';
import { mintGeminiEphemeralToken, createGPTLiveWebRTCSession } from '../broker';

// ---------------------------------------------------------------------------
// Sample backend routes (framework-neutral: request in, response out). These
// show the REQUIRED shape around the broker helpers: the route authenticates
// the caller first, and the SERVER decides model, session configuration, and
// token constraints — none of that comes from request input. Wire them into
// Bun.serve / express / next as thin adapters.
// ---------------------------------------------------------------------------

export interface SampleRouteRequest {
  /** Bearer token or session cookie the host's own auth understands. */
  authorization?: string;
  /** Parsed JSON body. */
  body?: Record<string, unknown>;
}

export interface SampleRouteResponse {
  status: number;
  body: Record<string, unknown>;
}

export interface SampleRouteAuth {
  /** Host-owned check; return false for anonymous or invalid callers. */
  authenticate(authorization: string | undefined): Promise<boolean> | boolean;
}

/**
 * POST /api/conversation/gemini-token — mint a short-lived Gemini Live token
 * for the authenticated caller. The model is fixed server-side and the token
 * is locked to it.
 */
export function createGeminiTokenRoute(options: {
  auth: SampleRouteAuth;
  apiKey: string;
  /** Server-chosen model the token is constrained to. */
  model: string;
  fetchImpl?: FetchLike;
}): (request: SampleRouteRequest) => Promise<SampleRouteResponse> {
  return async (request) => {
    if (!(await options.auth.authenticate(request.authorization))) {
      return { status: 401, body: { error: 'Not authenticated.' } };
    }
    try {
      const grant = await mintGeminiEphemeralToken({
        apiKey: options.apiKey,
        model: options.model,
        uses: 1,
        fetchImpl: options.fetchImpl,
      });
      return { status: 200, body: { token: grant.token, expireTime: grant.expireTime ?? null } };
    } catch (error) {
      const message = error instanceof ConversationError ? error.message : 'Token minting failed.';
      return { status: 502, body: { error: message } };
    }
  };
}

/**
 * POST /api/conversation/gpt-live-session — exchange the browser's SDP offer
 * for a GPT-Live answer. The session configuration (model, instructions,
 * delegation) is composed server-side; the browser contributes ONLY its SDP.
 */
export function createGPTLiveSessionRoute(options: {
  auth: SampleRouteAuth;
  apiKey: string;
  /** Server-owned session configuration for /v1/live/sessions. */
  session: Record<string, unknown>;
  fetchImpl?: FetchLike;
}): (request: SampleRouteRequest) => Promise<SampleRouteResponse> {
  return async (request) => {
    if (!(await options.auth.authenticate(request.authorization))) {
      return { status: 401, body: { error: 'Not authenticated.' } };
    }
    const offerSdp = request.body?.sdp;
    if (typeof offerSdp !== 'string' || offerSdp.length === 0) {
      return { status: 400, body: { error: 'The request body needs the browser offer sdp.' } };
    }
    try {
      const answer = await createGPTLiveWebRTCSession({
        apiKey: options.apiKey,
        offerSdp,
        session: options.session,
        fetchImpl: options.fetchImpl,
      });
      return { status: 200, body: { sdp: answer.answerSdp, sessionId: answer.sessionId ?? null } };
    } catch (error) {
      const message = error instanceof ConversationError ? error.message : 'Session exchange failed.';
      return { status: 502, body: { error: message } };
    }
  };
}
