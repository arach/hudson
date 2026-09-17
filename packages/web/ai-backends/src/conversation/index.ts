// ---------------------------------------------------------------------------
// @hudsonkit/ai/conversation — two-way spoken assistant sessions for the web.
// Distinct from live speech-to-text. Providers: OpenAI GPT-Live (WebSocket
// via server or host relay, WebRTC via host SDP broker) and Gemini Live
// (ephemeral-token browser path, API-key server path).
// ---------------------------------------------------------------------------

export {
  ConversationError,
  isBrowserEnvironment,
  defaultSocketFactory,
  type AssistantAudioChunk,
  type ConversationConfig,
  type ConversationErrorCode,
  type ConversationEvent,
  type ConversationSession,
  type Delegation,
  type InteractionStatus,
  type ResultScheduling,
  type SocketFactory,
  type SocketInit,
  type ThinkingLevel,
  type ToolBehavior,
  type ToolCall,
  type ToolDeclaration,
  type ToolOutput,
  type ToolResult,
  type WireSocket,
} from './types';

export {
  ToolFailure,
  createToolDispatcher,
  type ToolAuthorizer,
  type ToolDispatcher,
  type ToolHandler,
  type ToolValidator,
} from './dispatcher';

export {
  GEMINI_LIVE_PROVIDER_ID,
  connectGeminiLive,
  isExtendedThinkingModel,
  validateGeminiLiveConfig,
  type GeminiLiveCredential,
  type GeminiLiveOptions,
} from './gemini-live';

export {
  GPT_LIVE_PROVIDER_ID,
  GPT_LIVE_SOCKET_URL,
  buildGPTLiveDelegation,
  connectGPTLive,
  connectGPTLiveWebRTC,
  validateGPTLiveConfig,
  type GPTLiveOptions,
  type GPTLiveTransport,
  type GPTLiveWebRTCOptions,
  type RTCDataChannelLike,
  type RTCPeerConnectionLike,
} from './openai-live';

export {
  createConversationModelCatalog,
  fetchGPTLiveModels,
  fetchGeminiLiveModels,
  type CapabilitySupport,
  type ConversationModel,
  type ConversationModelCatalog,
  type ModelCatalogEntry,
} from './models';

export {
  createGPTLiveWebRTCSession,
  mintGeminiEphemeralToken,
  type EphemeralTokenGrant,
  type GPTLiveWebRTCAnswer,
} from './broker';

export {
  CONVERSATION_SETTINGS_FORMAT,
  CONVERSATION_SETTINGS_MAX_BYTES,
  CONVERSATION_SETTINGS_VERSION,
  importConversationSettingsFile,
  parseConversationSettingsDocument,
  sampleGPTLiveImportDocument,
  sampleGeminiImportDocument,
  type StagedConversationSettings,
} from './import';

export {
  illustrativeSavedState,
  sampleGPTLiveSettings,
  sampleGeminiExtendedThinkingSettings,
  sampleGeminiLiveSettings,
  validateConversationSettings,
} from './samples/settings';

export {
  startBrowserConversation,
  startWebRTCEventHost,
  type BrowserConversationHost,
  type WebRTCEventHost,
} from './samples/browser-host';

export {
  createGPTLiveSessionRoute,
  createGeminiTokenRoute,
  type SampleRouteAuth,
  type SampleRouteRequest,
  type SampleRouteResponse,
} from './samples/server-routes';
