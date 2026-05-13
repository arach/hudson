// ---------------------------------------------------------------------------
// @hudson/ai-backends — public API
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

// Credential resolution
export type { CredentialResolver } from './credentials';
export { hudVaultResolver } from './credentials';

// Dispatch helper
export { aggregateStream } from './dispatch';

// Adapters
export { createPiAiBackend, type PiAiConfig, type PiAiMeta, type PiAiBackendOptions } from './adapters/pi-ai';
export {
  createVercelAiBackend,
  type VercelAiConfig,
  type VercelAiMeta,
  type VercelAiBackendOptions,
  type VercelAiBackend,
  type VercelAiUIFinishEvent,
  type VercelAiUIRequest,
} from './adapters/vercel-ai';

// Toolset types + registry (also available via '@hudson/ai-backends/toolsets')
export type { ToolsetDefinition } from './toolsets/types';
export type { ToolsetRegistry } from './toolsets/registry';
export { createToolsetRegistry, buildIntentsToolset, defaultRegistry, INTENTS_SYSTEM_PROMPT } from './toolsets/registry';
