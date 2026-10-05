// ---------------------------------------------------------------------------
// @hudsonkit/ai/scout — inference through the agent harnesses on this machine
// (Codex, Claude Code, Pi, Grok, Kimi, Cursor, OpenCode), on the accounts
// they are signed in with. Server-only. Uses the optional
// @openscout/agent-sessions peer for every harness except Claude.
// ---------------------------------------------------------------------------

export {
  createScoutBackend,
  composeInput,
  HARNESS_TRANSPORTS,
  type ScoutConfig,
  type ScoutMeta,
  type ScoutBackend,
  type ScoutBackendOptions,
  type ScoutLocalModule,
  type ScoutLocalClient,
  type ScoutLocalTurnResult,
} from './adapters/scout';

export {
  SCOUT_HARNESSES,
  HARNESS_BINARIES,
  HARNESS_LABELS,
  resolveOpenCodeBin,
  type ScoutHarness,
} from './scout/harnesses';

export {
  listHarnessModels,
  codexModels,
  claudeModels,
  opencodeModels,
  parseOpenCodeModels,
  parseOpenCodeAuthProviders,
  fromCodexModels,
  type HarnessModel,
  type ListHarnessModelsOptions,
  type ListHarnessModelsResult,
} from './scout/models';

export { runClaudeTurn, parseClaudeOutput, claudeArgs, type ClaudeTurnOptions, type ClaudeTurnResult } from './scout/claude';
