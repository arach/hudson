import { EventChannel, overflowError } from './channel';
import {
  ConversationError,
  defaultSocketFactory,
  isBrowserEnvironment,
  type ConversationConfig,
  type ConversationSession,
  type SocketFactory,
  type ToolDeclaration,
  type ToolResult,
  type WireSocket,
} from './types';
import { assertPCMChunk, createMessagePump, fromBase64, record, socketReady, toBase64 } from './wire';

// ---------------------------------------------------------------------------
// OpenAI GPT-Live over WebSocket, per the current /v1/live/sessions product.
// This is not the legacy Realtime API; do not reuse its event names.
//
// Wire summary (voice-websockets, live-delegation):
// - client: session.start, session.instructions.append {content},
//   session.input_audio.append {audio}, session.close,
//   session.commentary.append {content, delegation_id},
//   response.item.create {item: function_call_output}, response.create
// - server: session.started, session.input_transcript.delta,
//   session.output_transcript.delta, session.output_audio.delta {delta},
//   session.delegation.created, response.event {delegation_id, event},
//   session.closed {usage}
// GPT-Live manages listen/speak timing; there is no input commit loop and no
// output-audio-done event. Speech interruption never cancels backend work.
// response.item.create / response.create address the current Responses
// context and carry no delegation_id.
// ---------------------------------------------------------------------------

export const GPT_LIVE_PROVIDER_ID = 'openai-gpt-live';
export const GPT_LIVE_SOCKET_URL = 'wss://api.openai.com/v1/live/sessions';

export type GPTLiveTransport =
  /** Browser-safe: a host relay terminates auth server-side. */
  | { kind: 'relay'; url: string }
  /** Server-side only: the key rides the handshake header, never a browser. */
  | { kind: 'server'; apiKey: string; url?: string };

export interface GPTLiveOptions {
  config: ConversationConfig;
  transport: GPTLiveTransport;
  tools?: ToolDeclaration[];
  socketFactory?: SocketFactory;
  setupTimeoutMs?: number;
  closeTimeoutMs?: number;
  /** Cancels a pending open/setup; the socket is cleaned up. */
  signal?: AbortSignal;
  /** Test seam; defaults to real environment detection. */
  browserEnvironment?: boolean;
}

export function validateGPTLiveConfig(config: ConversationConfig): string | null {
  if (config.provider !== GPT_LIVE_PROVIDER_ID) return 'The selected provider is not GPT-Live.';
  if (config.model.trim().length === 0) return 'Choose a model before connecting.';
  if (config.thinkingLevel !== undefined) return 'GPT-Live does not take a thinking level.';
  if (![16_000, 24_000].includes(config.inputSampleRate)) {
    return 'GPT-Live PCM sessions use 24000 or 16000 samples per second.';
  }
  return null;
}

/**
 * Delegation configuration is validated before any socket exists.
 * Rules, not guesses:
 * - Authored `delegation` JSON that does not parse is an error.
 * - Responses delegation requires the host-configured backend model
 *   (`delegation.responses.model` or the `delegationModel` option); no model
 *   identifier is ever invented.
 * - Declared tools merge into an authored responses branch only when it
 *   declares none of its own; conflicting tool sources are an error, never a
 *   silent overwrite.
 */
export function buildGPTLiveDelegation(
  config: ConversationConfig,
  tools: ToolDeclaration[],
): Record<string, unknown> | null {
  const options = config.options ?? {};
  let delegation: Record<string, unknown>;
  if (options.delegation !== undefined) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(options.delegation);
    } catch {
      parsed = null;
    }
    const object = record(parsed);
    if (!object) {
      throw new ConversationError('invalid-configuration', 'The delegation option is not a JSON object.');
    }
    delegation = { ...object };
  } else if (tools.length > 0) {
    const model = options.delegationModel?.trim();
    if (!model) {
      throw new ConversationError(
        'invalid-configuration',
        'Declared tools need a Responses backend model (delegationModel option).',
      );
    }
    delegation = { type: 'responses', responses: { model } };
  } else {
    return null;
  }
  if (delegation.type !== 'responses') return delegation;
  const responses = { ...(record(delegation.responses) ?? {}) };
  if (typeof responses.model !== 'string' || responses.model.length === 0) {
    throw new ConversationError(
      'invalid-configuration',
      'Responses delegation requires a backend model before connecting.',
    );
  }
  if (tools.length > 0) {
    if (responses.tools !== undefined) {
      throw new ConversationError(
        'invalid-configuration',
        'Tools are declared both on the session and inside the delegation option; declare them once.',
      );
    }
    responses.tools = tools.map((tool) => {
      const declared: Record<string, unknown> = { type: 'function', name: tool.name };
      if (tool.description) declared.description = tool.description;
      if (tool.parameters) declared.parameters = tool.parameters;
      return declared;
    });
  }
  delegation.responses = responses;
  return delegation;
}

export async function connectGPTLive(options: GPTLiveOptions): Promise<ConversationSession> {
  const problem = validateGPTLiveConfig(options.config);
  if (problem) throw new ConversationError('invalid-configuration', problem);
  const tools = options.tools ?? [];
  const delegation = buildGPTLiveDelegation(options.config, tools);
  const browser = options.browserEnvironment ?? isBrowserEnvironment();
  const factory = options.socketFactory ?? defaultSocketFactory;
  let socket: WireSocket;
  if (options.transport.kind === 'server') {
    if (browser) {
      throw new ConversationError(
        'credential-boundary',
        'A long-lived OpenAI API key never ships to a browser; connect through a host relay instead.',
      );
    }
    socket = factory(options.transport.url ?? GPT_LIVE_SOCKET_URL, {
      headers: { Authorization: `Bearer ${options.transport.apiKey}` },
    });
  } else {
    socket = factory(options.transport.url);
  }
  const session = new GPTLiveSession(socket, options.config, delegation, options.closeTimeoutMs ?? 5_000, 'ws');
  await session.start(options.setupTimeoutMs ?? 10_000, options.signal);
  return session;
}

// ---------------------------------------------------------------------------
// WebRTC transport (browser): audio rides negotiated media tracks and JSON
// events ride the "oai-events" data channel. The browser never holds a
// credential — it sends its SDP offer to a host backend endpoint, which
// performs the authenticated /v1/live/sessions exchange and returns only the
// answer SDP.
// ---------------------------------------------------------------------------

export interface RTCDataChannelLike {
  send(data: string): void;
  close?(): void;
  addEventListener(
    type: 'open' | 'message' | 'error' | 'close',
    listener: (event: { data?: unknown }) => void,
  ): void;
  readyState?: string;
}

export interface RTCPeerConnectionLike {
  createDataChannel(label: string): RTCDataChannelLike;
  addTrack(track: unknown, stream: unknown): void;
  createOffer(): Promise<{ sdp?: string }>;
  setLocalDescription(description: { type: string; sdp?: string }): Promise<void>;
  setRemoteDescription(description: { type: string; sdp: string }): Promise<void>;
  addEventListener(type: 'track', listener: (event: { track: unknown }) => void): void;
  close(): void;
}

export interface GPTLiveWebRTCOptions {
  config: ConversationConfig;
  tools?: ToolDeclaration[];
  /**
   * Exchanges the browser SDP offer for the provider answer via the host
   * backend. The session body is included so the backend can forward it; the
   * backend owns the API key.
   */
  exchange: (request: {
    offerSdp: string;
    session: Record<string, unknown>;
  }) => Promise<{ answerSdp: string; sessionId?: string }>;
  /** Microphone media stream tracks to publish. */
  microphone?: { getAudioTracks(): unknown[] };
  /** Called with the assistant's remote audio track; attach it to playback. */
  onRemoteAudioTrack?: (track: unknown) => void;
  createPeerConnection: () => RTCPeerConnectionLike;
  setupTimeoutMs?: number;
  closeTimeoutMs?: number;
  signal?: AbortSignal;
}

export async function connectGPTLiveWebRTC(options: GPTLiveWebRTCOptions): Promise<ConversationSession> {
  const problem = validateGPTLiveConfig(options.config);
  if (problem) throw new ConversationError('invalid-configuration', problem);
  const tools = options.tools ?? [];
  const delegation = buildGPTLiveDelegation(options.config, tools);
  const setupTimeoutMs = options.setupTimeoutMs ?? 10_000;
  // One deadline covers offer, exchange, remote description, and session
  // acknowledgement; the abort signal interrupts any of those phases.
  const deadline = Date.now() + setupTimeoutMs;
  const remaining = () => Math.max(1, deadline - Date.now());
  const peer = options.createPeerConnection();
  const channel = peer.createDataChannel('oai-events');
  const socket: WireSocket = {
    send: (data) => channel.send(data),
    close: () => {
      channel.close?.();
      peer.close();
    },
    addEventListener: (type, listener) => channel.addEventListener(type, listener),
    get readyState() {
      return channel.readyState === 'open' ? 1 : 0;
    },
  };
  const session = new GPTLiveSession(
    socket, options.config, delegation, options.closeTimeoutMs ?? 5_000, 'webrtc');
  // Session listeners attach before the SDP answer is applied, so an early
  // session.started on the data channel cannot be lost.
  const starting = session.start(remaining(), options.signal);
  starting.catch(() => {});
  try {
    if (options.onRemoteAudioTrack) {
      peer.addEventListener('track', (event) => options.onRemoteAudioTrack?.(event.track));
    }
    if (options.microphone) {
      for (const track of options.microphone.getAudioTracks()) {
        peer.addTrack(track, options.microphone);
      }
    }
    const offer = await withPhaseDeadline(peer.createOffer(), remaining(), options.signal);
    if (!offer.sdp) throw new ConversationError('connection-failed', 'The browser produced no offer SDP.');
    await withPhaseDeadline(
      peer.setLocalDescription({ type: 'offer', sdp: offer.sdp }), remaining(), options.signal);
    const sessionBody: Record<string, unknown> = { model: options.config.model };
    if (options.config.instructions) sessionBody.instructions = options.config.instructions;
    if (options.config.voice) sessionBody.audio = { output: { voice: options.config.voice } };
    if (delegation) sessionBody.delegation = delegation;
    const answer = await withPhaseDeadline(
      options.exchange({ offerSdp: offer.sdp, session: sessionBody }), remaining(), options.signal);
    await withPhaseDeadline(
      peer.setRemoteDescription({ type: 'answer', sdp: answer.answerSdp }), remaining(), options.signal);
    await starting;
    return session;
  } catch (error) {
    await session.close().catch(() => {});
    peer.close();
    throw error;
  }
}

function withPhaseDeadline<T>(work: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ConversationError('cancelled', 'The session open was cancelled.'));
      return;
    }
    const timer = setTimeout(
      () => reject(new ConversationError('setup-rejected', 'Session setup did not finish in time.')),
      ms,
    );
    const onAbort = () => {
      clearTimeout(timer);
      reject(new ConversationError('cancelled', 'The session open was cancelled.'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    work.then(
      (value) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(error instanceof ConversationError
          ? error
          : new ConversationError('connection-failed', 'Session setup failed.'));
      },
    );
  });
}

interface ResponsesDelegationState {
  currentResponseId: string | null;
  pendingCalls: Set<string>;
  seenCalls: Set<string>;
  boundaryReached: boolean;
  outputsSentThisRound: number;
  continuedThisRound: boolean;
}

class GPTLiveSession implements ConversationSession {
  private readonly channel = new EventChannel();
  private started = false;
  private closed = false;
  private generation = 0;
  private sequence = 0;
  /**
   * Backend work proceeds in rounds: response.created opens a round,
   * response.completed/done bounds it, and response.create is sent once per
   * round after the boundary AND every announced call of that round has a
   * result. Duplicate created events and duplicate call deliveries are
   * idempotent; stale completions for earlier responses are ignored.
   */
  private readonly responsesDelegations = new Map<string, ResponsesDelegationState>();
  private readonly clientDelegations = new Set<string>();
  private readyResolve: ((acknowledged: boolean) => void) | null = null;
  private closeResolve: ((confirmed: boolean) => void) | null = null;
  private closePromise: Promise<void> | null = null;

  constructor(
    private readonly socket: WireSocket,
    private readonly config: ConversationConfig,
    private readonly delegation: Record<string, unknown> | null,
    private readonly closeTimeoutMs: number,
    private readonly transport: 'ws' | 'webrtc',
  ) {}

  get events() {
    return this.channel.events;
  }

  async start(setupTimeoutMs: number, signal?: AbortSignal): Promise<void> {
    this.socket.addEventListener('message', createMessagePump(
      (message) => this.handle(message),
      (failure) => {
        if (!this.closed) this.finish(failure);
      },
    ));
    this.socket.addEventListener('close', () => {
      if (!this.closed) {
        this.finish(new ConversationError('connection-failed', 'The connection closed unexpectedly.'));
      }
    });
    this.socket.addEventListener('error', () => {
      if (!this.closed) {
        this.finish(new ConversationError('connection-failed', 'The connection failed.'));
      }
    });
    let cancelled = false;
    const acknowledged = await new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
        resolve(value);
      };
      const onAbort = () => {
        cancelled = true;
        settle(false);
      };
      this.readyResolve = settle;
      const timer = setTimeout(() => settle(false), setupTimeoutMs);
      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener('abort', onAbort);
      // Over WebRTC the session was configured during the SDP exchange; the
      // data channel only waits for session.started.
      void socketReady(this.socket, setupTimeoutMs)
        .then(() => {
          if (this.transport === 'ws') {
            this.socket.send(JSON.stringify({ type: 'session.start', session: this.sessionBody() }));
          }
        })
        .catch(() => settle(false));
    });
    this.readyResolve = null;
    if (!acknowledged || !this.started) {
      const failure = cancelled
        ? new ConversationError('cancelled', 'The session open was cancelled.')
        : new ConversationError('setup-rejected', 'The provider did not acknowledge the session in time.');
      this.finish(failure);
      throw failure;
    }
  }

  private sessionBody(): Record<string, unknown> {
    const audio: Record<string, unknown> = {
      format: { type: 'audio/pcm', rate: this.config.inputSampleRate },
    };
    if (this.config.voice) audio.output = { voice: this.config.voice };
    const session: Record<string, unknown> = { model: this.config.model, audio };
    if (this.config.instructions) session.instructions = this.config.instructions;
    if (this.delegation) session.delegation = this.delegation;
    return session;
  }

  async sendAudio(chunk: Uint8Array): Promise<void> {
    this.requireOpenAndStarted();
    if (this.transport === 'webrtc') {
      throw new ConversationError(
        'unsupported',
        'Over WebRTC, audio rides the negotiated media tracks, not data-channel events.',
      );
    }
    assertPCMChunk(chunk);
    this.socket.send(JSON.stringify({ type: 'session.input_audio.append', audio: toBase64(chunk) }));
  }

  /** GPT-Live manages listen/speak timing; there is no end-of-input message. */
  async finishAudio(): Promise<void> {
    this.requireOpenAndStarted();
  }

  async appendInstruction(text: string): Promise<void> {
    this.requireOpenAndStarted();
    this.socket.send(JSON.stringify({
      type: 'session.instructions.append',
      content: text,
      delegation_id: null,
    }));
  }

  interruptPlayback(): number {
    this.generation += 1;
    return this.generation;
  }

  async sendToolResult(result: ToolResult): Promise<void> {
    this.requireOpenAndStarted();
    if (result.scheduling !== undefined) {
      throw new ConversationError('invalid-configuration', 'GPT-Live does not take result scheduling.');
    }
    const delegationId = result.delegationId;
    if (!delegationId) {
      throw new ConversationError(
        'invalid-configuration',
        'GPT-Live tool results need their delegation ID.',
      );
    }
    const output = result.output.ok
      ? JSON.stringify(result.output.value)
      : JSON.stringify({ error: result.output.error });
    const responses = this.responsesDelegations.get(delegationId);
    if (responses) {
      // Reserve synchronously so a concurrent duplicate result for the same
      // call cannot send twice.
      if (!responses.pendingCalls.delete(result.callId)) {
        throw new ConversationError('unknown-tool-call', `Unknown tool call ${result.callId}.`);
      }
      responses.outputsSentThisRound += 1;
      this.socket.send(JSON.stringify({
        type: 'response.item.create',
        item: { type: 'function_call_output', call_id: result.callId, output },
      }));
      this.continueResponsesIfComplete(delegationId);
    } else if (this.clientDelegations.has(delegationId)) {
      // Client delegation announced only an opaque ID; the host returns
      // spoken content it reconstructed from transcript and app state.
      this.socket.send(JSON.stringify({
        type: 'session.commentary.append',
        content: output,
        delegation_id: delegationId,
      }));
    } else {
      throw new ConversationError('unknown-tool-call', `Unknown tool call ${result.callId}.`);
    }
  }

  /**
   * Idempotent graceful close: the waiter is registered before session.close
   * is sent so a fast session.closed cannot be missed, and concurrent callers
   * share one close attempt. An unconfirmed close fails the stream instead of
   * pretending the provider confirmed.
   */
  close(): Promise<void> {
    this.closePromise ??= (async () => {
      if (this.closed) return;
      const confirmed = await new Promise<boolean>((resolve) => {
        this.closeResolve = resolve;
        try {
          this.socket.send(JSON.stringify({ type: 'session.close' }));
        } catch {
          resolve(false);
        }
        setTimeout(() => resolve(false), this.closeTimeoutMs);
      });
      this.closeResolve = null;
      this.finish(confirmed
        ? undefined
        : new ConversationError('close-unconfirmed', 'The provider never confirmed the close.'));
    })();
    return this.closePromise;
  }

  private handle(message: Record<string, unknown> | null): void {
    if (!message || this.closed) return;
    switch (message.type) {
      case 'session.started': {
        this.started = true;
        const body = record(message.session);
        this.push({
          type: 'ready',
          sessionId: typeof body?.id === 'string' ? body.id : undefined,
        });
        this.readyResolve?.(true);
        return;
      }
      case 'session.output_audio.delta': {
        if (typeof message.delta !== 'string') return;
        this.sequence += 1;
        this.push({
          type: 'assistantAudio',
          chunk: {
            data: fromBase64(message.delta),
            sampleRate: this.config.inputSampleRate,
            generation: this.generation,
            sequence: this.sequence,
          },
        });
        return;
      }
      case 'session.input_transcript.delta':
        if (typeof message.delta === 'string') {
          this.push({ type: 'userTranscriptDelta', text: message.delta });
        }
        return;
      case 'session.output_transcript.delta':
        if (typeof message.delta === 'string') {
          this.push({ type: 'assistantTranscriptDelta', text: message.delta });
        }
        return;
      case 'session.delegation.created': {
        const delegation = record(message.delegation);
        const id = typeof delegation?.id === 'string' ? delegation.id : null;
        if (!id) return;
        if (delegation?.target === 'client') {
          this.clientDelegations.add(id);
          this.push({ type: 'delegationStarted', delegation: { id, target: 'client' } });
        } else {
          if (!this.responsesDelegations.has(id)) this.responsesDelegations.set(id, freshRound());
          this.push({ type: 'delegationStarted', delegation: { id, target: 'responses' } });
        }
        return;
      }
      case 'response.event': {
        const delegationId = typeof message.delegation_id === 'string' ? message.delegation_id : null;
        const event = record(message.event);
        if (delegationId && event) this.handleDelegated(event, delegationId);
        return;
      }
      case 'session.closed': {
        const rawUsage = record(message.usage);
        let usage: Record<string, number> | undefined;
        if (rawUsage) {
          usage = {};
          for (const [key, value] of Object.entries(rawUsage)) {
            if (typeof value === 'number') usage[key] = value;
          }
        }
        this.push({ type: 'closed', usage });
        if (this.closeResolve) {
          this.closeResolve(true);
          this.closeResolve = null;
        } else {
          this.finish();
        }
        return;
      }
      case 'error':
        // Fixed copy: raw provider payloads stay out of host-facing text.
        this.finish(new ConversationError('provider-error', 'The provider reported an error.'));
        return;
      default:
        return;
    }
  }

  /**
   * Custom-function calls arrive nested in response.event envelopes and still
   * run through host dispatch and authorization.
   */
  private handleDelegated(event: Record<string, unknown>, delegationId: string): void {
    if (!this.responsesDelegations.has(delegationId)) {
      this.responsesDelegations.set(delegationId, freshRound());
      this.push({ type: 'delegationStarted', delegation: { id: delegationId, target: 'responses' } });
    }
    const state = this.responsesDelegations.get(delegationId)!;
    switch (event.type) {
      case 'response.created': {
        const responseId = typeof record(event.response)?.id === 'string'
          ? (record(event.response)!.id as string)
          : null;
        // Duplicate creation of the same response is idempotent; it must not
        // reset a round that already announced calls.
        if (responseId !== null && state.currentResponseId === responseId) return;
        state.currentResponseId = responseId;
        state.pendingCalls = new Set();
        state.boundaryReached = false;
        state.outputsSentThisRound = 0;
        state.continuedThisRound = false;
        return;
      }
      case 'response.output_item.done': {
        const item = record(event.item);
        if (item?.type !== 'function_call') return;
        const callId = typeof item.call_id === 'string' ? item.call_id : null;
        const name = typeof item.name === 'string' ? item.name : null;
        if (!callId || !name || state.seenCalls.has(callId)) return;
        state.seenCalls.add(callId);
        state.pendingCalls.add(callId);
        // The wire contract carries arguments as a JSON string. A missing or
        // non-string payload is wire-invalid and stays invalid — never {} and
        // never an accepted object — so the dispatcher rejects it. A string
        // that fails to parse is preserved for the same rejection.
        let args: unknown;
        if (typeof item.arguments === 'string') {
          try {
            args = JSON.parse(item.arguments) as unknown;
          } catch {
            args = item.arguments;
          }
        } else {
          args = undefined;
        }
        this.push({ type: 'toolCall', call: { id: callId, name, args, delegationId } });
        return;
      }
      case 'response.completed':
      case 'response.done': {
        // A stale completion for an earlier response must not bound the
        // current round.
        const responseId = typeof record(event.response)?.id === 'string'
          ? (record(event.response)!.id as string)
          : null;
        if (responseId !== null && state.currentResponseId !== null
          && responseId !== state.currentResponseId) return;
        state.boundaryReached = true;
        this.continueResponsesIfComplete(delegationId);
        return;
      }
      default:
        return;
    }
  }

  private continueResponsesIfComplete(delegationId: string): void {
    const state = this.responsesDelegations.get(delegationId);
    if (!state || !state.boundaryReached || state.pendingCalls.size > 0
      || state.outputsSentThisRound === 0 || state.continuedThisRound) return;
    state.continuedThisRound = true;
    this.socket.send(JSON.stringify({ type: 'response.create' }));
  }

  private requireOpenAndStarted(): void {
    if (this.closed) throw new ConversationError('session-closed', 'The session already ended.');
    if (!this.started) throw new ConversationError('not-started', 'Wait for setup acknowledgement.');
  }

  private push(event: Parameters<EventChannel['push']>[0]): void {
    if (!this.channel.push(event)) this.finish(overflowError());
  }

  private finish(error?: Error): void {
    if (this.closed) return;
    this.closed = true;
    this.readyResolve?.(false);
    this.readyResolve = null;
    this.closeResolve?.(false);
    this.closeResolve = null;
    this.channel.finish(error);
    try {
      this.socket.close();
    } catch {
      // Closing an already-dead socket is fine.
    }
  }
}

function freshRound(): ResponsesDelegationState {
  return {
    currentResponseId: null,
    pendingCalls: new Set(),
    seenCalls: new Set(),
    boundaryReached: false,
    outputsSentThisRound: 0,
    continuedThisRound: false,
  };
}
