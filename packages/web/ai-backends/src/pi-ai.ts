// ---------------------------------------------------------------------------
// @hudsonkit/ai/pi-ai — everything that requires the optional
// @earendil-works/pi-ai peer. Mirrors the ./vercel-ai subpath so the root
// entry stays importable when neither peer is installed.
// ---------------------------------------------------------------------------

export {
  createPiAiBackend,
  type PiAiConfig,
  type PiAiMeta,
  type PiAiBackendOptions,
  type PiAiBackend,
  type PiAiUIRequest,
  type PiAiUIMessage,
  type PiAiUIMessagePart,
  type PiAiCompiledToolset,
  type HudsonTool,
} from './adapters/pi-ai';

// Credential resolvers (envCredentialResolver uses pi-ai's provider→env map)
export type { CredentialResolver } from './credentials';
export { hudVaultResolver, envCredentialResolver } from './credentials';

// Available models (pi-ai registry filtered to held credentials)
export { listAvailableModels } from './models';
export type { AvailableModel, ListAvailableModelsOptions } from './models';
