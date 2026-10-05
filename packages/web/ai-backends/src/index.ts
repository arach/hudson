// ---------------------------------------------------------------------------
// @hudsonkit/ai — public API
//
// The root entry must stay importable when neither optional peer
// (@earendil-works/pi-ai, ai) is installed: types and provider-neutral
// helpers only. Anything that touches a peer lives on a subpath:
//   * '@hudsonkit/ai/pi-ai'     — createPiAiBackend, credential resolvers,
//                                 listAvailableModels
//   * '@hudsonkit/ai/vercel-ai' — createVercelAiBackend
//   * '@hudsonkit/ai/scout'     — createScoutBackend, listHarnessModels
//                                 (local agent harnesses; server-only)
// ---------------------------------------------------------------------------

// Core types
export type {
  Backend,
  BackendCapabilities,
  DispatchRequest,
  DispatchResult,
  StreamEvent,
  Message,
  ContentPart,
  AppIntent,
} from './types';

// Capability helpers
export {
  supportsStreaming,
  supportsSessions,
  requiresRelay,
  requiresAuth,
  checkStatus,
  unavailableAffordance,
} from './capabilities';

// Credential resolution (resolver implementations live in './pi-ai')
export type { CredentialResolver } from './credentials';

// Available models (listAvailableModels lives in './pi-ai')
export type { AvailableModel, ListAvailableModelsOptions } from './models';

// Dispatch helper
export { aggregateStream } from './dispatch';

// Adapter types (factories live on their subpaths)
export type {
  PiAiConfig,
  PiAiMeta,
  PiAiBackendOptions,
  PiAiBackend,
  PiAiUIRequest,
  PiAiUIMessage,
  PiAiUIMessagePart,
  PiAiCompiledToolset,
  HudsonTool,
} from './adapters/pi-ai';
export type {
  VercelAiConfig,
  VercelAiMeta,
  VercelAiBackendOptions,
  VercelAiBackend,
  VercelAiUIFinishEvent,
  VercelAiUIRequest,
} from './adapters/vercel-ai';
export type { ScoutConfig, ScoutMeta, ScoutBackendOptions, ScoutBackend } from './adapters/scout';
export type { ScoutHarness } from './scout/harnesses';
export type { HarnessModel, ListHarnessModelsOptions, ListHarnessModelsResult } from './scout/models';

// Toolset types + registry (also available via '@hudsonkit/ai/toolsets')
export type { ToolsetDefinition } from './toolsets/types';
export type { ToolsetRegistry } from './toolsets/registry';
export { createToolsetRegistry, buildIntentsToolset, defaultRegistry, INTENTS_SYSTEM_PROMPT } from './toolsets/registry';
