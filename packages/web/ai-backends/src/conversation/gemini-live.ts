import { EventChannel, overflowError } from './channel';
import {
  ConversationError,
  defaultSocketFactory,
  isBrowserEnvironment,
  type ConversationConfig,
  type ConversationSession,
  type InteractionStatus,
  type SocketFactory,
  type ToolDeclaration,
  type ToolResult,
  type WireSocket,
} from './types';
import { assertPCMChunk, createMessagePump, fromBase64, record, socketReady, toBase64 } from './wire';

// ---------------------------------------------------------------------------
// Gemini Live conversational sessions over BidiGenerateContent. Distinct from
// the transcription-only Gemini adapters.
//
// Model rules enforced here rather than silently adjusted:
// - gemini-3.8-live: no thinking level; tool results may carry scheduling;
//   blocking tool declarations are allowed and serialized explicitly.
// - gemini-3.8-live-extended-thinking: thinking level low/medium/high only;
//   tools must be non-blocking; result scheduling is unsupported and rejected.
// turnComplete marks the end of one utterance only; interactionStatus
// (IDLE / IN_PROGRESS, in either wire placement) reports background work.
// ---------------------------------------------------------------------------

export const GEMINI_LIVE_PROVIDER_ID = 'gemini-live-conversation';
const EXTENDED_THINKING_SUFFIX = 'extended-thinking';

export function isExtendedThinkingModel(model: string): boolean {
  return model.endsWith(EXTENDED_THINKING_SUFFIX);
}

export type GeminiLiveCredential =
  /**
   * Short-lived token minted by a host backend — the only credential a
   * browser may hold. Browser WebSockets cannot carry handshake headers, so
   * the token rides the documented access_token query parameter of the
   * Constrained endpoint; it is short-lived by construction.
   */
  | { kind: 'ephemeralToken'; token: string }
  /** Long-lived API key. Server-side only; refused in browsers. */
  | { kind: 'apiKey'; apiKey: string };

export interface GeminiLiveOptions {
  config: ConversationConfig;
  credential: GeminiLiveCredential;
  tools?: ToolDeclaration[];
  socketFactory?: SocketFactory;
  host?: string;
  setupTimeoutMs?: number;
  /** Cancels a pending open/setup; the socket is cleaned up. */
  signal?: AbortSignal;
  /** Test seam; defaults to real environment detection. */
  browserEnvironment?: boolean;
}

export function validateGeminiLiveConfig(
  config: ConversationConfig,
  tools: ToolDeclaration[],
): string | null {
  if (config.provider !== GEMINI_LIVE_PROVIDER_ID) return 'The selected provider is not Gemini Live.';
  if (config.model.trim().length === 0) return 'Choose a model before connecting.';
  if (config.inputSampleRate !== 16_000) {
    return 'Gemini Live input audio is 16000 samples per second PCM16.';
  }
  if (isExtendedThinkingModel(config.model)) {
    if (tools.some((tool) => tool.behavior === 'blocking')) {
      return 'Extended thinking requires non-blocking tools; blocking mode returns a hard provider error.';
    }
  } else if (config.thinkingLevel !== undefined) {
    return 'This model does not take a thinking level. Choose the extended-thinking model instead.';
  }
  return null;
}

export async function connectGeminiLive(options: GeminiLiveOptions): Promise<ConversationSession> {
  const tools = options.tools ?? [];
  const problem = validateGeminiLiveConfig(options.config, tools);
  if (problem) throw new ConversationError('invalid-configuration', problem);
  const browser = options.browserEnvironment ?? isBrowserEnvironment();
  if (browser && options.credential.kind === 'apiKey') {
    throw new ConversationError(
      'credential-boundary',
      'A long-lived Gemini API key never ships to a browser; mint an ephemeral token on the host backend.',
    );
  }
  const host = options.host ?? 'generativelanguage.googleapis.com';
  const factory = options.socketFactory ?? defaultSocketFactory;
  let socket: WireSocket;
  if (options.credential.kind === 'ephemeralToken') {
    const url =
      `wss://${host}/ws/google.ai.generativelanguage.v1beta.GenerativeService.` +
      `BidiGenerateContentConstrained?access_token=${encodeURIComponent(options.credential.token)}`;
    socket = factory(url);
  } else {
    // Server-side: the key rides a handshake header, never the URL.
    const url =
      `wss://${host}/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`;
    socket = factory(url, { headers: { 'x-goog-api-key': options.credential.apiKey } });
  }
  const session = new GeminiLiveSession(socket, options.config, tools);
  await session.start(options.setupTimeoutMs ?? 10_000, options.signal);
  return session;
}

class GeminiLiveSession implements ConversationSession {
  private readonly channel = new EventChannel();
  private started = false;
  private closed = false;
  private generation = 0;
  private sequence = 0;
  /** Calls awaiting a host result (id → declared name). */
  private readonly pendingCalls = new Map<string, string>();
  /** Every call ID ever announced; repeats are not re-dispatched. */
  private readonly knownCalls = new Set<string>();
  private readyResolve: ((acknowledged: boolean) => void) | null = null;
  private closePromise: Promise<void> | null = null;
  private readonly extendedThinking: boolean;

  constructor(
    private readonly socket: WireSocket,
    private readonly config: ConversationConfig,
    private readonly tools: ToolDeclaration[],
  ) {
    this.extendedThinking = isExtendedThinkingModel(config.model);
  }

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
      void socketReady(this.socket, setupTimeoutMs)
        .then(() => this.socket.send(JSON.stringify({ setup: this.setupMessage() })))
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

  private setupMessage(): Record<string, unknown> {
    const generationConfig: Record<string, unknown> = { responseModalities: ['AUDIO'] };
    if (this.config.thinkingLevel) {
      generationConfig.thinkingConfig = { thinkingLevel: this.config.thinkingLevel.toUpperCase() };
    }
    if (this.config.voice) {
      generationConfig.speechConfig = {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: this.config.voice } },
      };
    }
    const setup: Record<string, unknown> = {
      model: `models/${this.config.model}`,
      generationConfig,
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    };
    if (this.config.instructions) {
      setup.systemInstruction = { parts: [{ text: this.config.instructions }] };
    }
    if (this.tools.length > 0) {
      setup.tools = [{
        functionDeclarations: this.tools.map((tool) => {
          const declaration: Record<string, unknown> = { name: tool.name };
          if (tool.description) declaration.description = tool.description;
          if (tool.parameters) declaration.parameters = tool.parameters;
          // The provider default is NON_BLOCKING; both behaviors serialize
          // explicitly. Blocking on extended thinking was rejected already.
          declaration.behavior = tool.behavior === 'blocking' ? 'BLOCKING' : 'NON_BLOCKING';
          return declaration;
        }),
      }];
    }
    return setup;
  }

  async sendAudio(chunk: Uint8Array): Promise<void> {
    this.requireOpenAndStarted();
    assertPCMChunk(chunk);
    this.socket.send(JSON.stringify({
      realtimeInput: {
        audio: {
          data: toBase64(chunk),
          mimeType: `audio/pcm;rate=${this.config.inputSampleRate}`,
        },
      },
    }));
  }

  async finishAudio(): Promise<void> {
    this.requireOpenAndStarted();
    this.socket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
  }

  /**
   * Gemini Live steering is conversation content, not a dedicated
   * instruction channel; sessions reject it rather than pretending.
   */
  async appendInstruction(_text: string): Promise<void> {
    this.requireOpenAndStarted();
    throw new ConversationError(
      'unsupported',
      'Gemini Live does not take appended instructions mid-session.',
    );
  }

  interruptPlayback(): number {
    this.generation += 1;
    return this.generation;
  }

  async sendToolResult(result: ToolResult): Promise<void> {
    this.requireOpenAndStarted();
    // Validate everything before reserving: an invalid result must not
    // consume the pending call it failed to answer.
    const pendingName = this.pendingCalls.get(result.callId);
    if (pendingName === undefined || pendingName !== result.name) {
      throw new ConversationError('unknown-tool-call', `Unknown tool call ${result.callId}.`);
    }
    if (this.extendedThinking && result.scheduling !== undefined) {
      throw new ConversationError(
        'invalid-configuration',
        'Extended thinking does not take function-result scheduling.',
      );
    }
    this.pendingCalls.delete(result.callId);
    let response: Record<string, unknown>;
    if (result.output.ok) {
      response = record(result.output.value) ?? { output: result.output.value };
    } else {
      response = { error: result.output.error };
    }
    if (result.scheduling) {
      response = {
        ...response,
        scheduling:
          result.scheduling === 'interrupt' ? 'INTERRUPT'
          : result.scheduling === 'whenIdle' ? 'WHEN_IDLE'
          : 'SILENT',
      };
    }
    this.socket.send(JSON.stringify({
      toolResponse: {
        functionResponses: [{ id: result.callId, name: result.name, response }],
      },
    }));
  }

  /**
   * BidiGenerateContent has no close confirmation message; graceful close is
   * a socket close after a final `closed` event.
   */
  close(): Promise<void> {
    this.closePromise ??= (async () => {
      if (this.closed) return;
      this.push({ type: 'closed' });
      this.finish();
    })();
    return this.closePromise;
  }

  private handle(message: Record<string, unknown> | null): void {
    if (!message || this.closed) return;
    if (message.error !== undefined) {
      // Fixed copy: raw provider payloads stay out of host-facing text.
      this.finish(new ConversationError('provider-error', 'The provider reported an error.'));
      return;
    }
    if (message.setupComplete !== undefined) {
      this.started = true;
      this.push({ type: 'ready' });
      this.readyResolve?.(true);
      return;
    }
    if (message.goAway !== undefined) {
      this.finish(new ConversationError('provider-error', 'The provider is ending the session.'));
      return;
    }
    // interactionStatus appears both nested in serverContent and at the top
    // level; both placements are authoritative.
    const topStatus = this.interactionStatus(message.interactionStatus);
    if (topStatus) this.push({ type: 'interactionStatus', status: topStatus });
    const toolCall = record(message.toolCall);
    const calls = toolCall ? (toolCall.functionCalls as unknown[] | undefined) : undefined;
    if (Array.isArray(calls)) {
      for (const raw of calls) {
        const call = record(raw);
        const id = typeof call?.id === 'string' ? call.id : null;
        const name = typeof call?.name === 'string' ? call.name : null;
        if (!id || !name || this.knownCalls.has(id)) continue;
        this.knownCalls.add(id);
        this.pendingCalls.set(id, name);
        // Omitted args is a zero-argument call; a present-but-invalid shape
        // is preserved for dispatcher rejection, never coerced to {}.
        this.push({
          type: 'toolCall',
          call: { id, name, args: call?.args === undefined ? {} : call.args },
        });
      }
    }
    const cancellation = record(message.toolCallCancellation);
    const ids = cancellation ? (cancellation.ids as unknown[] | undefined) : undefined;
    if (Array.isArray(ids)) {
      const cancelled = ids.filter((id): id is string => typeof id === 'string');
      for (const id of cancelled) this.pendingCalls.delete(id);
      this.push({ type: 'toolCallsCancelled', ids: cancelled });
    }
    const content = record(message.serverContent);
    if (!content) return;
    const nestedStatus = this.interactionStatus(content.interactionStatus);
    if (nestedStatus) this.push({ type: 'interactionStatus', status: nestedStatus });
    const input = record(content.inputTranscription);
    if (typeof input?.text === 'string') this.push({ type: 'userTranscriptDelta', text: input.text });
    const output = record(content.outputTranscription);
    if (typeof output?.text === 'string') {
      this.push({ type: 'assistantTranscriptDelta', text: output.text });
    }
    const turn = record(content.modelTurn);
    const parts = turn ? (turn.parts as unknown[] | undefined) : undefined;
    if (Array.isArray(parts)) {
      for (const rawPart of parts) {
        const inline = record(record(rawPart)?.inlineData);
        if (typeof inline?.data !== 'string') continue;
        this.sequence += 1;
        this.push({
          type: 'assistantAudio',
          chunk: {
            data: fromBase64(inline.data),
            sampleRate: this.sampleRate(inline.mimeType),
            generation: this.generation,
            sequence: this.sequence,
          },
        });
      }
    }
    if (content.interrupted === true) {
      this.generation += 1;
      this.push({ type: 'interrupted', generation: this.generation });
    }
    // End of one utterance only: background-work state stays untouched and
    // the message handler keeps consuming interactionStatus and tool traffic.
    if (content.turnComplete === true) this.push({ type: 'turnComplete' });
  }

  private interactionStatus(raw: unknown): InteractionStatus | null {
    if (raw === 'IDLE') return 'idle';
    if (raw === 'IN_PROGRESS') return 'inProgress';
    return null;
  }

  private sampleRate(mimeType: unknown): number {
    if (typeof mimeType === 'string') {
      const match = /rate=(\d+)/.exec(mimeType);
      if (match) return Number(match[1]);
    }
    return 24_000;
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
    this.channel.finish(error);
    try {
      this.socket.close();
    } catch {
      // Closing an already-dead socket is fine.
    }
  }
}
