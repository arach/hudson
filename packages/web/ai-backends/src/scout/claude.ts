// ---------------------------------------------------------------------------
// Claude one-shot turns through the Claude Code CLI.
//
// @openscout/agent-sessions/local covers codex, pi, grok, kimi, cursor and
// opencode, but not Claude. Until it does, Claude turns run `claude -p` with
// no tools and no MCP servers, so a turn is plain inference on the account
// Claude Code is signed in with.
// ---------------------------------------------------------------------------

import { spawn } from 'node:child_process';

export interface ClaudeTurnOptions {
  input: string;
  systemPrompt?: string;
  model?: string;
  /** Claude Code `--effort` level. */
  effort?: string;
  cwd: string;
  timeoutMs: number;
  signal?: AbortSignal;
  /** Binary to run. Defaults to `claude` on PATH. */
  bin?: string;
}

export interface ClaudeTurnResult {
  text: string;
  sessionId?: string;
  usage?: { input: number; output: number; cost?: number };
}

interface ClaudeResultEvent {
  type?: string;
  is_error?: boolean;
  result?: string;
  session_id?: string;
  total_cost_usd?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export function claudeArgs(opts: ClaudeTurnOptions): string[] {
  const args = ['-p', '--output-format', 'json', '--tools', '', '--strict-mcp-config', '--no-session-persistence'];
  if (opts.model) args.push('--model', opts.model);
  if (opts.effort) args.push('--effort', opts.effort);
  if (opts.systemPrompt) args.push('--system-prompt', opts.systemPrompt);
  return args;
}

/** Read the `result` event out of `claude -p --output-format json` stdout. */
export function parseClaudeOutput(stdout: string): ClaudeTurnResult {
  const parsed: unknown = JSON.parse(stdout);
  const events = (Array.isArray(parsed) ? parsed : [parsed]) as ClaudeResultEvent[];
  const result = [...events].reverse().find((e) => e?.type === 'result');
  if (!result) throw new Error('claude returned no result event');
  if (result.is_error) throw new Error(result.result || 'claude reported an error');

  const u = result.usage;
  return {
    text: result.result ?? '',
    sessionId: result.session_id,
    usage: u
      ? {
          input: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
          output: u.output_tokens ?? 0,
          cost: result.total_cost_usd,
        }
      : undefined,
  };
}

export function runClaudeTurn(opts: ClaudeTurnOptions): Promise<ClaudeTurnResult> {
  return new Promise((resolve, reject) => {
    // The prompt goes on stdin, so long inputs never hit argv limits.
    const child = spawn(opts.bin ?? 'claude', claudeArgs(opts), {
      cwd: opts.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
      fn();
    };
    const onAbort = () => {
      child.kill();
      finish(() => reject(new Error('claude turn aborted')));
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(() => reject(new Error(`claude turn timed out after ${opts.timeoutMs}ms`)));
    }, opts.timeoutMs);

    if (opts.signal?.aborted) return onAbort();
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (err) => finish(() => reject(err)));
    child.on('close', (code) => {
      finish(() => {
        try {
          resolve(parseClaudeOutput(stdout));
        } catch (err) {
          const detail = stderr.trim() || (err instanceof Error ? err.message : String(err));
          reject(new Error(`claude exited ${code}: ${detail}`));
        }
      });
    });
    child.stdin.end(opts.input);
  });
}
