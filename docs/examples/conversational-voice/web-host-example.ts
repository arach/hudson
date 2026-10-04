// Web host wiring for a conversational voice session, end to end.
//
// Type-checked against @hudsonkit/ai/conversation. Every symbol here is a real
// export, so this file cannot drift from the API the way prose can.
//
// Importing this module performs no I/O: everything below is a declaration.
// Calling it is another matter, and the functions differ — `connectGeminiLive`
// and `connectGPTLiveWebRTC` open a provider connection, `browserCredentials`
// and `listGeminiModels` make HTTP requests, and `runBrowserHost` takes over a
// microphone. The settings and dispatcher helpers are pure. Each function says
// which it is.
//
// No provider secret appears here. The browser never holds one — see
// `browserCredentials` below.

import {
  ConversationError,
  importConversationSettingsFile,
  type StagedConversationSettings,
  ToolFailure,
  createConversationModelCatalog,
  createToolDispatcher,
  createGPTLiveSessionRoute,
  buildGPTLiveDelegation,
  type SampleRouteAuth,
  fetchGeminiLiveModels,
  isExtendedThinkingModel,
  connectGPTLiveWebRTC,
  connectGeminiLive,
  startBrowserConversation,
  startWebRTCEventHost,
  validateConversationSettings,
  validateGPTLiveConfig,
  validateGeminiLiveConfig,
  type BrowserConversationHost,
  type WebRTCEventHost,
  type ConversationConfig,
  type ConversationSession,
  type ToolCall,
  type RTCPeerConnectionLike,
  type ToolDeclaration,
  type ToolDispatcher,
} from '@hudsonkit/ai/conversation';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * Bind a real browser file input, text preview, and explicit Save button.
 * Save persists host preferences only: it must not activate a session or
 * overwrite the broker's server-owned configuration or smoke-test policy.
 * The backend independently authorizes any later use of saved preferences.
 * Return value removes listeners when the settings view is disposed.
 */
export function bindSettingsFileImport(options: {
  input: HTMLInputElement;
  preview: HTMLElement;
  saveButton: HTMLButtonElement;
  status: HTMLElement;
  save: (staged: StagedConversationSettings) => Promise<void>;
}): () => void {
  const { input, preview, saveButton, status } = options;
  let staged: StagedConversationSettings | undefined;
  let revision = 0;
  let disposed = false;
  let saving = false;
  input.type = 'file';
  input.accept = '.json,application/json';
  input.multiple = false;
  saveButton.type = 'button';
  saveButton.textContent = 'Save';
  saveButton.disabled = true;

  const onChange = async (_event: Event): Promise<void> => {
    if (saving || disposed) return;
    const current = ++revision;
    staged = undefined;
    preview.textContent = '';
    saveButton.disabled = true;
    const file = input.files?.item(0);
    if (!file) { status.textContent = 'No file selected.'; return; }
    status.textContent = 'Reading settings…';
    try {
      const imported = await importConversationSettingsFile(file);
      if (disposed || current !== revision) return;
      staged = imported;
      // Treat imported text as data, never HTML.
      preview.textContent = JSON.stringify(imported, null, 2);
      status.textContent = 'Review these settings, then choose Save. Nothing is active.';
      saveButton.disabled = false;
    } catch {
      if (!disposed && current === revision) {
        status.textContent = 'Settings could not be imported. Select a valid settings document.';
      }
    }
  };

  const onSave = async (_event: MouseEvent): Promise<void> => {
    if (!staged || saving || disposed) return;
    saving = true;
    input.disabled = true;
    saveButton.disabled = true;
    try {
      await options.save(structuredClone(staged));
      if (!disposed) {
        staged = undefined;
        status.textContent = 'Preferences saved. No session was started.';
      }
    } catch {
      if (!disposed) status.textContent = 'Save failed. Review the preview and retry.';
    } finally {
      saving = false;
      if (!disposed) {
        input.disabled = false;
        saveButton.disabled = !staged;
      }
    }
  };

  input.addEventListener('change', onChange);
  saveButton.addEventListener('click', onSave);
  return () => {
    disposed = true;
    ++revision;
    staged = undefined;
    input.removeEventListener('change', onChange);
    saveButton.removeEventListener('click', onSave);
    saveButton.disabled = true;
    // An already-started host save is not cancelled by disposing this view.
  };
}

/**
 * A saved configuration. `options` is the provider-specific map: GPT-Live reads
 * `delegation` (a full authored delegation JSON object) and `delegationModel`
 * (the Responses backend model used when the session synthesizes delegation for
 * declared tools). Supply one or the other when declaring tools on GPT-Live —
 * the adapter will not guess a model.
 */
export const gptLiveSettings: ConversationConfig = {
  provider: 'openai-gpt-live',
  model: 'gpt-live-1',
  instructions: 'You are a concise voice assistant. Keep answers short.',
  inputSampleRate: 24000,
  options: { delegationModel: 'gpt-5.2' },
};

export const geminiLiveSettings: ConversationConfig = {
  provider: 'gemini-live-conversation',
  model: 'gemini-3.8-live',
  instructions: 'You are a concise voice assistant. Keep answers short.',
  inputSampleRate: 16000,
};

/**
 * Validate before connecting. `validateConversationSettings` returns a list of
 * problems — empty means valid. The per-provider validators return a single
 * message or `null`; they do not throw, so treat a non-null return as the
 * rejection rather than wrapping the call in try/catch.
 *
 * Gemini's validator also takes the tool declarations, because its rules are
 * partly about tools: extended thinking rejects blocking declarations. Pass the
 * tools you will actually declare, or validation checks a case you are not
 * going to run.
 */
export function describeSettingsProblems(
  config: ConversationConfig,
  tools: ToolDeclaration[] = [],
): string[] {
  const problems = validateConversationSettings(config);
  const providerProblem =
    config.provider === 'openai-gpt-live'
      ? validateGPTLiveConfig(config)
      : config.provider === 'gemini-live-conversation'
        ? validateGeminiLiveConfig(config, tools)
        : null;
  if (providerProblem !== null) problems.push(providerProblem);
  return problems;
}

/**
 * Extended thinking is a different model with a different tool contract:
 * non-blocking declarations only, and result scheduling is unsupported. Use
 * this to branch a settings UI rather than hard-coding model identifiers.
 */
export function requiresNonBlockingTools(config: ConversationConfig): boolean {
  return isExtendedThinkingModel(config.model);
}

/**
 * Model lists come from provider discovery with refresh, not a hand-maintained
 * allowlist. A saved identifier discovery no longer returns is preserved as an
 * unavailable entry rather than being substituted, and a failed refresh keeps
 * the previous list rather than erasing it.
 *
 * Server-side only: `fetchGeminiLiveModels` asserts it is not in a browser,
 * because discovery needs an API key and ephemeral tokens only open sessions.
 * Call this from a backend route and send the result to the client.
 */
export async function listGeminiModels(apiKey: string, savedModel?: string) {
  const catalog = createConversationModelCatalog({
    provider: 'gemini-live-conversation',
    fetchModels: () => fetchGeminiLiveModels({ apiKey }),
  });
  await catalog.refresh();
  return catalog.entries(savedModel);
}

// ---------------------------------------------------------------------------
// A local, harmless tool
// ---------------------------------------------------------------------------

/**
 * Pure and local: it reads its arguments and computes an answer. No network, no
 * storage, no shared mutable state — nothing a provider could steer into an
 * effect. Provider messages are data; handlers are host code selected by name.
 */
const COUNT_WORDS = 'count_words';

/**
 * The declaration advertised to the provider at connect. Registering a handler
 * on the dispatcher is **not** enough: a provider only calls tools it was told
 * about during setup, so this must be passed to `connectGeminiLive` /
 * `connectGPTLiveWebRTC` as well.
 *
 * `nonBlocking` works on both Gemini models, and extended thinking requires it.
 */
export const countWordsDeclaration: ToolDeclaration = {
  name: COUNT_WORDS,
  description: 'Count the words in a piece of text.',
  parameters: {
    type: 'object',
    properties: { text: { type: 'string', description: 'Text to count words in.' } },
    required: ['text'],
  },
  behavior: 'nonBlocking',
};

/**
 * A validator runs before authorization and before the handler. Returning a
 * string rejects the call with that message; `null` accepts it.
 *
 * Rejection text reaches the model, so it should name the problem without
 * leaking host internals.
 */
function validateCountWords(call: ToolCall): string | null {
  const args = call.args;
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    return 'Arguments must be a JSON object.';
  }
  const text = (args as Record<string, unknown>).text;
  if (text === undefined) return "Argument 'text' is required.";
  if (typeof text !== 'string') return "Argument 'text' must be a string.";
  if (text.length > 10_000) {
    return `Argument 'text' is limited to 10000 characters; received ${text.length}.`;
  }
  return null;
}

/**
 * Build a dispatcher with the tool registered and a host authorization gate.
 *
 * Scope one dispatcher to one conversation: its call-ID history is what makes
 * effects at-most-once, so a new session needs a new dispatcher.
 *
 * Throwing `ToolFailure` is the only way a handler's own message reaches the
 * model; every other thrown value becomes the fixed string "The tool failed."
 * That is deliberate — it keeps stack traces and internal errors out of
 * provider context.
 */
export function makeDispatcher(): ToolDispatcher {
  const dispatcher = createToolDispatcher({
    authorize: (call) => call.name === COUNT_WORDS,
  });
  dispatcher.register(
    COUNT_WORDS,
    async (call) => {
      const text = (call.args as { text: string }).text;
      if (text.trim().length === 0) {
        throw new ToolFailure("Argument 'text' had no words to count.");
      }
      return { words: text.split(/\s+/u).filter(Boolean).length };
    },
    { validate: validateCountWords },
  );
  return dispatcher;
}

// ---------------------------------------------------------------------------
// Credential boundary
// ---------------------------------------------------------------------------

/**
 * The browser never holds a long-lived provider key. Two shapes, both brokered
 * by a host backend:
 *
 * - Gemini Live: the backend mints a short-lived ephemeral token
 *   (`mintGeminiEphemeralToken`, exposed through `createGeminiTokenRoute`) and
 *   the browser connects with it.
 * - GPT-Live WebRTC: the backend creates the session and exchanges the
 *   browser's SDP offer for an answer (`createGPTLiveWebRTCSession`, exposed
 *   through `createGPTLiveSessionRoute`). There is no token for the browser to
 *   hold at all.
 *
 * Both route helpers live in `@hudsonkit/ai/conversation` and are server-only:
 * they hold the provider key, so they must never be imported into browser code.
 * This function stays on the client side of that line — it fetches a grant from
 * your own backend and never sees a provider key.
 */
export async function browserCredentials(endpoint: string): Promise<string> {
  const response = await fetch(endpoint, { method: 'POST' });
  if (!response.ok) {
    throw new ConversationError(
      'credential-boundary',
      'The session broker refused to issue a credential.',
    );
  }
  const grant = (await response.json()) as { token?: string };
  if (!grant.token) {
    throw new ConversationError('credential-boundary', 'The broker returned no session credential.');
  }
  return grant.token;
}

// ---------------------------------------------------------------------------
// Connecting
// ---------------------------------------------------------------------------

/**
 * Gemini Live from a browser. Performs I/O: opens the provider WebSocket.
 *
 * The credential is an ephemeral token fetched from your backend — passing
 * `{ kind: 'apiKey' }` from a browser is refused outright with a
 * `credential-boundary` error, not merely discouraged.
 *
 * Note the tools argument: the declaration is advertised here, at setup. A
 * dispatcher registration alone would never be called.
 */
export async function connectGemini(
  config: ConversationConfig,
  brokerEndpoint: string,
): Promise<ConversationSession> {
  const token = await browserCredentials(brokerEndpoint);
  return connectGeminiLive({
    config,
    credential: { kind: 'ephemeralToken', token },
    tools: [countWordsDeclaration],
  });
}

/**
 * GPT-Live over WebRTC. Performs I/O: negotiates a peer connection and opens
 * the session.
 *
 * The browser never holds a credential at all here. It creates an SDP offer,
 * and `exchange` posts it to your authenticated backend route — built with
 * `createGPTLiveSessionRoute`, which holds the API key server-side — receiving
 * the provider's answer. Send your own session cookie or bearer header on that
 * request; the provider key stays on the server.
 *
 * Assistant speech arrives as a remote media track rather than as audio chunks,
 * so `onRemoteAudioTrack` must attach it to something that plays. Nothing is
 * audible until you do.
 */
export async function connectGPTLiveOverWebRTC(options: {
  config: ConversationConfig;
  sessionRouteUrl: string;
  microphone: MediaStream;
  attachRemoteTrack: (track: unknown) => void;
  createPeerConnection: () => RTCPeerConnectionLike;
}): Promise<ConversationSession> {
  return connectGPTLiveWebRTC({
    config: options.config,
    tools: [countWordsDeclaration],
    createPeerConnection: options.createPeerConnection,
    microphone: options.microphone,
    onRemoteAudioTrack: options.attachRemoteTrack,
    exchange: async (request) => {
      const response = await fetch(options.sessionRouteUrl, {
        method: 'POST',
        // Your own auth, not the provider's. The backend route holds the key.
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sdp: request.offerSdp }),
      });
      if (!response.ok) {
        throw new ConversationError(
          'credential-boundary',
          'The session broker refused the SDP exchange.',
        );
      }
      const answer = await response.json() as { sdp?: unknown; sessionId?: unknown };
      if (typeof answer.sdp !== 'string' || !answer.sdp) {
        throw new ConversationError('connection-failed', 'The broker returned no answer SDP.');
      }
      return {
        answerSdp: answer.sdp,
        sessionId: typeof answer.sessionId === 'string' ? answer.sessionId : undefined,
      };
    },
  });
}

/**
 * SERVER ONLY: mount the returned handler on the same route the browser uses.
 * The host authenticates its own user and chooses this configuration on the
 * server. Do not populate `config` from a browser request. Both sides advertise
 * the same harmless tool; the browser contributes only its SDP offer.
 * Pass the actual request cookie/bearer value to the handler's `authorization`.
 */
export function makeGPTLiveBackendRoute(options: {
  apiKey: string;
  config: ConversationConfig;
  auth: SampleRouteAuth;
}) {
  const problem = validateGPTLiveConfig(options.config);
  if (problem) throw new ConversationError('invalid-configuration', problem);
  const session: Record<string, unknown> = { model: options.config.model };
  if (options.config.instructions) session.instructions = options.config.instructions;
  if (options.config.voice) session.audio = { output: { voice: options.config.voice } };
  const delegation = buildGPTLiveDelegation(options.config, [countWordsDeclaration]);
  if (delegation) session.delegation = delegation;
  return createGPTLiveSessionRoute({ apiKey: options.apiKey, auth: options.auth, session });
}

// ---------------------------------------------------------------------------
// Browser host — WebSocket path only
// ---------------------------------------------------------------------------

/**
 * Wire an **already-connected** session to microphone capture, playback, and
 * the local tool dispatcher. Performs I/O: it captures from the microphone and
 * schedules audio.
 *
 * This is the PCM path — the WebSocket transports, where assistant speech
 * arrives as `assistantAudio` chunks this host schedules. It is not for the
 * WebRTC path, where audio rides media tracks; use `runWebRTCHost` there.
 *
 * The caller owns the `MediaStream`: its tracks are not stopped here, because
 * a host usually reuses the stream across sessions. `maxQueuedSeconds` bounds
 * how far ahead assistant speech may be scheduled; chunks beyond the bound are
 * dropped and counted by `droppedChunks()`.
 *
 * Transcript callbacks are invoked as deltas arrive. Keep them cheap, and do
 * not assume ordering between the two streams.
 */
export async function runBrowserHost(options: {
  session: ConversationSession;
  microphone: MediaStream;
  config: ConversationConfig;
  onUserTranscript?: (delta: string) => void;
  onAssistantTranscript?: (delta: string) => void;
}): Promise<BrowserConversationHost> {
  return startBrowserConversation({
    session: options.session,
    dispatcher: makeDispatcher(),
    microphone: options.microphone,
    inputSampleRate: options.config.inputSampleRate,
    maxQueuedSeconds: 30,
    onUserTranscript: options.onUserTranscript,
    onAssistantTranscript: options.onAssistantTranscript,
    onError: (error) => {
      // Failures surface. A silent assistant on a live billing session is not
      // an acceptable steady state, so do not swallow this.
      console.error('conversation host error', error);
    },
  });
}

/**
 * Barge-in, effect 1 only: stop local playback and drop stale queued audio.
 *
 * It sends nothing to the provider and does nothing whatsoever to tools. In-
 * flight tool calls keep running and **their results are still delivered** —
 * suppression happens during teardown or when the *provider* withdraws calls via
 * `toolCallsCancelled`, which routes to `dispatcher.cancel(ids)`. Barge-in is
 * not a cancel of anything but audio.
 *
 * Neither provider documents a client-initiated cancel of the response itself,
 * and delegated backend work is the host's to stop.
 */
export function userInterrupted(host: BrowserConversationHost): void {
  host.bargeIn();
}

/** Stop capture, close the session gracefully, release audio resources. */
export async function stop(host: BrowserConversationHost): Promise<void> {
  await host.stop();
}

// ---------------------------------------------------------------------------
// WebRTC host — barge-in needs a concrete audible effect
// ---------------------------------------------------------------------------

/**
 * Over WebRTC the microphone was published at connect time and assistant
 * speech arrives as a remote media track the host attaches to an audio
 * element. This host wires events and tools only — it does not schedule audio.
 *
 * That changes barge-in. On the WebSocket path, advancing the playback
 * generation drops queued chunks and the assistant actually goes quiet. Over
 * WebRTC there is no queue to drop: the track keeps playing, so **the
 * generation marker alone silences nothing**. `muteRemoteAudio` is required
 * for exactly this reason — it is the concrete stop, wired to pausing or
 * muting the element playing the remote track.
 *
 * Muting is a local, honest effect: the provider keeps its own turn handling,
 * and nothing unmutes on its own. The caller decides when to call
 * `resumeRemoteAudio()`, typically once the user stops speaking. Passing
 * `unmuteRemoteAudio` is what makes that resume possible; omit it and
 * `resumeRemoteAudio()` has nothing to undo the mute with.
 */
export function runWebRTCHost(options: {
  session: ConversationSession;
  audioElement: { pause(): void; play(): Promise<void>; muted: boolean };
  onAssistantTranscript?: (delta: string) => void;
}): WebRTCEventHost {
  return startWebRTCEventHost({
    session: options.session,
    dispatcher: makeDispatcher(),
    muteRemoteAudio: () => {
      options.audioElement.muted = true;
    },
    unmuteRemoteAudio: () => {
      options.audioElement.muted = false;
    },
    onAssistantTranscript: options.onAssistantTranscript,
    onError: (error) => {
      console.error('conversation host error', error);
    },
  });
}
