// ---------------------------------------------------------------------------
// Conversational voice contract — web counterpart of HudsonConversation.
//
// Two-way spoken assistant sessions: user audio in, assistant speech out,
// interruptions, and provider tool calls dispatched to host-supplied local
// tools. Distinct from live speech-to-text; nothing here routes through the
// transcription stack.
// ---------------------------------------------------------------------------

export type ThinkingLevel = 'low' | 'medium' | 'high';

export type ToolBehavior = 'blocking' | 'nonBlocking';

/** How an out-of-band result enters the conversation, where supported. */
export type ResultScheduling = 'interrupt' | 'whenIdle' | 'silent';

export interface ConversationConfig {
  /** Adapter identity, e.g. `openai-gpt-live` or `gemini-live-conversation`. */
  provider: string;
  model: string;
  instructions?: string;
  voice?: string;
  /** Capture rate for mono PCM16 little-endian input. */
  inputSampleRate: number;
  /**
   * Only models that document configurable thinking accept this; setting it
   * elsewhere is a configuration error, never silently dropped.
   */
  thinkingLevel?: ThinkingLevel;
  /**
   * Provider-specific string options. GPT-Live reads `delegation` (an
   * authored delegation JSON object) and `delegationModel` (backend model for
   * synthesized Responses delegation when tools are declared).
   */
  options?: Record<string, string>;
}

export interface ToolDeclaration {
  name: string;
  description?: string;
  /** JSON Schema object for the arguments. */
  parameters?: Record<string, unknown>;
  behavior?: ToolBehavior;
}

export interface ToolCall {
  /** Provider call ID. Results must echo it verbatim. */
  id: string;
  name: string;
  /**
   * Raw provider-supplied arguments. Data, never executable code. A valid
   * call carries a JSON object; an invalid provider shape is preserved as-is
   * so the dispatcher rejects it — it is never coerced into an empty object,
   * which would turn invalid input into a valid zero-argument invocation.
   * An omitted arguments payload is a zero-argument call and arrives as `{}`.
   */
  args: unknown;
  /** Present when the call arrived inside a delegated-work envelope. */
  delegationId?: string;
}

export type ToolOutput =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

export interface ToolResult {
  callId: string;
  name: string;
  output: ToolOutput;
  scheduling?: ResultScheduling;
  delegationId?: string;
}

/**
 * Whether the model is ready for input or still reasoning/executing tools in
 * the background. Independent of utterance boundaries: a completed utterance
 * must not clear in-progress background work.
 */
export type InteractionStatus = 'idle' | 'inProgress';

export interface AssistantAudioChunk {
  /** Mono PCM16 little-endian samples. */
  data: Uint8Array;
  sampleRate: number;
  /**
   * Playback stream identity. After an interruption the generation advances;
   * hosts drop queued or arriving chunks from older generations instead of
   * playing stale speech.
   */
  generation: number;
  sequence: number;
}

export interface Delegation {
  id: string;
  /**
   * `client` delegations carry an opaque ID only — the host reconstructs the
   * request from transcript and its own state, never from provider-supplied
   * arguments.
   */
  target: 'responses' | 'client';
}

export type ConversationEvent =
  | { type: 'ready'; sessionId?: string }
  | { type: 'userTranscriptDelta'; text: string }
  | { type: 'assistantTranscriptDelta'; text: string }
  | { type: 'assistantAudio'; chunk: AssistantAudioChunk }
  /** The provider interrupted its own speech; older audio is stale. */
  | { type: 'interrupted'; generation: number }
  /** End of the current assistant utterance. Not end of background work. */
  | { type: 'turnComplete' }
  | { type: 'interactionStatus'; status: InteractionStatus }
  | { type: 'toolCall'; call: ToolCall }
  /** The provider withdrew these calls; suppress their pending results. */
  | { type: 'toolCallsCancelled'; ids: string[] }
  | { type: 'delegationStarted'; delegation: Delegation }
  /** Terminal. Emitted exactly once on graceful close. */
  | { type: 'closed'; usage?: Record<string, number> };

/**
 * One open two-way spoken session.
 *
 * Interruption comes in three distinct effects that are never conflated:
 * 1. Local playback stop — `interruptPlayback()` advances the playback
 *    generation so hosts drop queued speech. It sends nothing to the provider.
 * 2. Provider speech interruption — reported by the provider as an
 *    `interrupted` event, or steered with `appendInstruction` where supported.
 * 3. Delegated backend work — never cancelled implicitly by either of the
 *    above. The host cancels its own tool effects through its own state, and
 *    the provider withdraws calls via `toolCallsCancelled`.
 */
export interface ConversationSession {
  /** Bounded event stream. Ends after `closed` or throws on failure. */
  readonly events: AsyncIterable<ConversationEvent>;
  /** Append one chunk of user PCM16 audio in the configured input rate. */
  sendAudio(chunk: Uint8Array): Promise<void>;
  /** Signal the end of user audio where the provider distinguishes it. */
  finishAudio(): Promise<void>;
  /**
   * Append steering instructions mid-session where the provider supports it.
   * Steering can interrupt current speech; it does not cancel backend work.
   */
  appendInstruction(text: string): Promise<void>;
  /** Local barge-in. Returns the new playback generation. */
  interruptPlayback(): number;
  /** Return a host tool result, echoing the provider call ID. */
  sendToolResult(result: ToolResult): Promise<void>;
  /** Graceful close; the event stream finishes afterwards. */
  close(): Promise<void>;
}

export type ConversationErrorCode =
  | 'cancelled'
  | 'invalid-configuration'
  | 'credential-boundary'
  | 'connection-failed'
  | 'setup-rejected'
  | 'provider-error'
  | 'not-started'
  | 'session-closed'
  | 'invalid-audio-chunk'
  | 'unknown-tool-call'
  | 'event-overflow'
  | 'close-unconfirmed'
  | 'discovery-failed'
  | 'unsupported';

export class ConversationError extends Error {
  readonly code: ConversationErrorCode;
  constructor(code: ConversationErrorCode, message: string) {
    super(message);
    this.name = 'ConversationError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Transport abstraction so provider clients are fixture-testable and hosts
// can supply Node sockets that carry handshake headers.
// ---------------------------------------------------------------------------

export interface WireSocket {
  send(data: string): void;
  close(): void;
  addEventListener(
    type: 'open' | 'message' | 'error' | 'close',
    listener: (event: { data?: unknown }) => void,
  ): void;
  /** WebSocket readyState; injected transports that are already open report 1. */
  readyState?: number;
}

export interface SocketInit {
  /**
   * Handshake headers. Browser WebSockets cannot carry them; a factory that
   * ignores requested headers must throw instead of silently dropping auth.
   */
  headers?: Record<string, string>;
}

export type SocketFactory = (url: string, init?: SocketInit) => WireSocket;

/** Structural fetch so hosts and tests can inject a transport. */
export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/** True in a browser-like environment where DOM globals exist. */
export function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/** Default factory: plain WebSocket; refuses header-carrying handshakes. */
export const defaultSocketFactory: SocketFactory = (url, init) => {
  if (init?.headers && Object.keys(init.headers).length > 0) {
    throw new ConversationError(
      'credential-boundary',
      'This environment cannot send handshake headers; use a host relay or ephemeral credential.',
    );
  }
  return new WebSocket(url) as unknown as WireSocket;
};
