// ---------------------------------------------------------------------------
// Adapter implementations
//
// PR #2 — pi-ai (in-process via @earendil-works/pi-ai)
// PR #3 — pi-coding-agent (wraps hudson-relay) — TBD
// PR #4 — vercel-ai (wraps Vercel AI SDK streamText)
// ---------------------------------------------------------------------------

export { createPiAiBackend, type PiAiConfig, type PiAiMeta, type PiAiBackendOptions } from './pi-ai';
export {
  createVercelAiBackend,
  type VercelAiConfig,
  type VercelAiMeta,
  type VercelAiBackendOptions,
  type VercelAiBackend,
  type VercelAiUIFinishEvent,
  type VercelAiUIRequest,
} from './vercel-ai';
