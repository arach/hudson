// ---------------------------------------------------------------------------
// Scout adapter — inference through the agent harnesses on this machine
//
// Runs a turn on a local harness (Codex, Claude Code, Pi, Grok, Kimi, Cursor,
// OpenCode) using the account that harness is signed in with. No API keys,
// no broker: turns go through @openscout/agent-sessions/local directly, and
// Claude through the Claude Code CLI (see ../scout/claude.ts).
//
// Server-only (spawns processes). Not streaming at the token level: a turn
// resolves whole, then yields text → usage → session → done.
//
// Sessions: with `warm: true` the backend keeps one live harness session per
// (conversationId, harness, model, cwd) so follow-up turns skip the cold start
// and keep the harness's own context. Without it every turn is one-shot.
// ---------------------------------------------------------------------------

import type { Backend, DispatchRequest, DispatchResult, Message, StreamEvent } from '../types';
import { aggregateStream } from '../dispatch';
import { runClaudeTurn, type ClaudeTurnOptions, type ClaudeTurnResult } from '../scout/claude';
import { HARNESS_BINARIES, HARNESS_LABELS, which, type ScoutHarness } from '../scout/harnesses';

// ---------------------------------------------------------------------------
// Config + meta types
// ---------------------------------------------------------------------------

export interface ScoutConfig {
  harness: ScoutHarness;
  /** Harness model id. Omit to run the harness default. */
  model?: string;
  /** Reasoning effort, where the harness takes one (codex, claude). */
  reasoningEffort?: string;
  /** Overrides `req.system`. */
  systemPrompt?: string;
  /** Working directory for the harness. Falls back to `req.cwd`, then the backend default. */
  cwd?: string;
  timeoutMs?: number;
  /** Keep a live session per conversation for follow-up turns. Not used for claude. */
  warm?: boolean;
}

export interface ScoutMeta {
  harness: ScoutHarness;
  transport: string;
  model?: string;
  /** Whether the turn reused a live session. */
  reused: boolean;
  durationMs: number;
}

/** The slice of @openscout/agent-sessions/local this adapter uses. */
export interface ScoutLocalModule {
  completeLocalAgentTurn(opts: {
    harness: string;
    cwd: string;
    systemPrompt?: string;
    input: string;
    model?: string;
    reasoningEffort?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
  }): Promise<ScoutLocalTurnResult>;
  createLocalAgentClient(opts: {
    harness: string;
    cwd: string;
    systemPrompt?: string;
    sessionId?: string;
    warmth?: 'warm' | 'lazy';
    model?: string;
    reasoningEffort?: string;
    timeoutMs?: number;
  }): Promise<ScoutLocalClient>;
}

export interface ScoutLocalTurnResult {
  text: string;
  transport: string;
  session: { id: string; nativeId?: string; reused: boolean; warm: boolean };
  usage?: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number; totalTokens?: number };
}

export interface ScoutLocalClient {
  turn(input: { input: string; systemPrompt?: string; model?: string; timeoutMs?: number; signal?: AbortSignal }): Promise<ScoutLocalTurnResult>;
  close(): Promise<void>;
  isAlive?(): boolean;
}

export interface ScoutBackendOptions {
  /** Default working directory. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Default per-turn timeout. Defaults to 120s. */
  timeoutMs?: number;
  /** Swap the agent-sessions module (tests, or a pinned build). */
  loadLocal?: () => Promise<ScoutLocalModule>;
  /** Swap the Claude runner (tests). */
  runClaude?: (opts: ClaudeTurnOptions) => Promise<ClaudeTurnResult>;
  /** Swap PATH lookup (tests). */
  which?: (bin: string) => string | null;
}

export interface ScoutBackend extends Backend<ScoutConfig, ScoutMeta> {
  dispatch(req: DispatchRequest<ScoutConfig>): Promise<DispatchResult<ScoutMeta>>;
  /** Close every warm session. Call on host shutdown. */
  closeSessions(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 120_000;

/** The transports each local harness may answer on, preferred first. */
export const HARNESS_TRANSPORTS: Record<Exclude<ScoutHarness, 'claude'>, readonly string[]> = {
  codex: ['codex_app_server'],
  pi: ['pi_rpc'],
  grok: ['grok_acp'],
  kimi: ['kimi_acp'],
  cursor: ['cursor_acp'],
  // agent-sessions picks V2 when `opencode2` is installed, ACP otherwise.
  opencode: ['opencode_v2', 'opencode_acp'],
};

function messageText(m: Message): string {
  if (typeof m.content === 'string') return m.content;
  return m.content
    .map((p) => ((p as { type?: string; text?: string }).type === 'text' ? (p as { text?: string }).text ?? '' : ''))
    .join('');
}

/**
 * A cold harness session has no memory of earlier turns, so prior messages
 * are folded into the input as a transcript. A warm session already holds
 * them, so it gets only the new input.
 */
export function composeInput(input: string, messages: Message[], includeHistory: boolean): string {
  if (!includeHistory) return input;
  const prior = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  if (prior.length === 0) return input;
  const transcript = prior.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${messageText(m)}`).join('\n\n');
  return `Conversation so far:\n\n${transcript}\n\nUser: ${input}`;
}

async function defaultLoadLocal(): Promise<ScoutLocalModule> {
  try {
    const specifier = '@openscout/agent-sessions/local';
    return (await import(/* @vite-ignore */ specifier)) as ScoutLocalModule;
  } catch (err) {
    throw new Error(
      `The scout backend needs @openscout/agent-sessions (>=0.2.78) installed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createScoutBackend(opts: ScoutBackendOptions = {}): ScoutBackend {
  const defaultCwd = opts.cwd ?? process.cwd();
  const defaultTimeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runClaude = opts.runClaude ?? runClaudeTurn;
  const lookup = opts.which ?? ((bin: string) => which(bin));

  let localModule: Promise<ScoutLocalModule> | undefined;
  const loadLocal = () => (localModule ??= (opts.loadLocal ?? defaultLoadLocal)().catch((err) => {
    localModule = undefined;
    throw err;
  }));

  const warm = new Map<string, Promise<ScoutLocalClient>>();

  async function warmClient(key: string, create: () => Promise<ScoutLocalClient>): Promise<{ client: ScoutLocalClient; fresh: boolean }> {
    const existing = warm.get(key);
    if (existing) {
      const client = await existing.catch(() => undefined);
      if (client && (client.isAlive?.() ?? true)) return { client, fresh: false };
      warm.delete(key);
    }
    const pending = create();
    warm.set(key, pending);
    try {
      return { client: await pending, fresh: true };
    } catch (err) {
      warm.delete(key);
      throw err;
    }
  }

  async function dropWarm(key: string) {
    const pending = warm.get(key);
    warm.delete(key);
    await pending?.then((c) => c.close()).catch(() => {});
  }

  async function runTurn(req: DispatchRequest<ScoutConfig>): Promise<{
    text: string;
    sessionRef?: string;
    usage?: { input: number; output: number; cost?: number };
    meta: ScoutMeta;
  }> {
    const config = req.config;
    const cwd = config.cwd ?? req.cwd ?? defaultCwd;
    const timeoutMs = config.timeoutMs ?? defaultTimeout;
    const systemPrompt = config.systemPrompt ?? req.system;
    const started = Date.now();

    if (config.harness === 'claude') {
      const r = await runClaude({
        input: composeInput(req.input, req.messages, true),
        systemPrompt,
        model: config.model,
        effort: config.reasoningEffort,
        cwd,
        timeoutMs,
        signal: req.signal,
      });
      return {
        text: r.text,
        sessionRef: r.sessionId,
        usage: r.usage,
        meta: { harness: 'claude', transport: 'claude_cli', model: config.model, reused: false, durationMs: Date.now() - started },
      };
    }

    const local = await loadLocal();
    let result: ScoutLocalTurnResult;
    if (config.warm) {
      const key = [req.conversationId, config.harness, config.model ?? '', config.reasoningEffort ?? '', cwd].join('\u0000');
      const { client, fresh } = await warmClient(key, () =>
        local.createLocalAgentClient({
          harness: config.harness,
          cwd,
          systemPrompt,
          sessionId: `hudson-${req.conversationId}`,
          warmth: 'warm',
          model: config.model,
          reasoningEffort: config.reasoningEffort,
          timeoutMs,
        }),
      );
      try {
        result = await client.turn({
          input: composeInput(req.input, req.messages, fresh),
          timeoutMs,
          signal: req.signal,
        });
      } catch (err) {
        await dropWarm(key);
        throw err;
      }
    } else {
      result = await local.completeLocalAgentTurn({
        harness: config.harness,
        cwd,
        systemPrompt,
        input: composeInput(req.input, req.messages, true),
        model: config.model,
        reasoningEffort: config.reasoningEffort,
        timeoutMs,
        signal: req.signal,
      });
    }

    // An agent-sessions build that doesn't know a harness can quietly run a
    // different one (0.2.78 sends `opencode` to Cursor). A reply from the
    // wrong harness is not an answer from the one that was asked.
    const expected = HARNESS_TRANSPORTS[config.harness];
    if (!expected.includes(result.transport)) {
      throw new Error(
        `${HARNESS_LABELS[config.harness]} turn ran on ${result.transport}, not ${expected.join(' or ')}; the installed @openscout/agent-sessions does not support this harness`,
      );
    }

    const u = result.usage;
    return {
      text: result.text,
      sessionRef: result.session.nativeId ?? result.session.id,
      usage:
        u && (u.inputTokens !== undefined || u.outputTokens !== undefined)
          ? { input: u.inputTokens ?? 0, output: u.outputTokens ?? 0 }
          : undefined,
      meta: {
        harness: config.harness,
        transport: result.transport,
        model: config.model,
        reused: result.session.reused,
        durationMs: Date.now() - started,
      },
    };
  }

  const backend: ScoutBackend = {
    id: 'scout',
    label: 'Scout',
    surface: 'chat',
    capabilities: {
      streaming: false,
      sessions: true,
      auth: 'oauth',
      relay: 'none',
      models: true,
    },

    async status(config: ScoutConfig) {
      const bins = HARNESS_BINARIES[config.harness];
      if (!bins) return { available: false, reason: `Unknown harness: ${String(config.harness)}` };
      if (!bins.some((bin) => lookup(bin))) {
        const names = bins.map((bin) => `\`${bin}\``).join(' or ');
        return { available: false, reason: `${HARNESS_LABELS[config.harness]} is not installed (no ${names} on PATH).` };
      }
      if (config.harness !== 'claude') {
        try {
          await loadLocal();
        } catch (err) {
          return { available: false, reason: err instanceof Error ? err.message : String(err) };
        }
      }
      return { available: true };
    },

    async *stream(req: DispatchRequest<ScoutConfig>): AsyncIterable<StreamEvent<ScoutMeta>> {
      let turn: Awaited<ReturnType<typeof runTurn>>;
      try {
        turn = await runTurn(req);
      } catch (err) {
        yield { type: 'error', message: err instanceof Error ? err.message : String(err), recoverable: false };
        return;
      }
      // An empty reply is a failure, not an answer: callers that diff or
      // replace text would otherwise treat it as "delete everything".
      if (!turn.text.trim()) {
        yield {
          type: 'error',
          message: `${HARNESS_LABELS[req.config.harness]} returned an empty reply`,
          recoverable: false,
        };
        return;
      }
      yield { type: 'text', delta: turn.text };
      if (turn.usage) yield { type: 'usage', ...turn.usage };
      if (turn.sessionRef) yield { type: 'session', sessionRef: turn.sessionRef };
      yield { type: 'done', meta: turn.meta };
    },

    dispatch(req: DispatchRequest<ScoutConfig>) {
      return aggregateStream(backend, req);
    },

    async closeSessions() {
      const keys = [...warm.keys()];
      await Promise.all(keys.map(dropWarm));
    },
  };

  return backend;
}
