import 'server-only';
import type {
  IntentCategory,
  IntentParameter,
  ServerIntent,
} from 'hudsonkit';
import {
  appendAgentSpanEnd,
  appendAgentSpanStart,
  makeTraceId,
} from './agent-log';

export interface IntentMeta {
  /** Stable id used as the catalog key (e.g. `logo.compile`). */
  id: string;
  /** Human-readable title. */
  title: string;
  /** Natural-language description for LLM/voice matching. */
  description: string;
  /** Catalog category; defaults to `'tool'`. */
  category?: IntentCategory;
  /** Synonyms for fuzzy matching. */
  keywords?: string[];
  /** Typed parameter schema — same shape as AppIntent.params. Required for
   *  agents to enumerate what to pass; supply even for primitive args. */
  params?: IntentParameter[];
  /** Module path the agent should import from, relative to repo root. */
  importPath: string;
  /** Named export the agent should import. */
  exportName: string;
  /** Optional owner app id; defaults to the prefix before the first `.` in `id`. */
  appId?: string;
  /** Markdown agentic body — describes how to fulfill this intent. */
  body?: string;
  /** Source file location, optional override (otherwise inferred from stack). */
  source?: { file: string; line?: number };
}

export interface IntentRegistryEntry {
  meta: IntentMeta;
  fn: (...args: unknown[]) => unknown;
}

interface IntentRegistration extends IntentRegistryEntry {
  source: { file: string; line?: number } | undefined;
}

const registry = new Map<string, IntentRegistration>();
const warnedDuplicates = new Set<string>();

// ---------------------------------------------------------------------------
// Source-location capture — best-effort, parses the first non-intent.ts frame
// off Error.stack. Used both for duplicate-id detection and as a navigation
// hint in the catalog. Treat as ergonomic; never throw if it fails.
// ---------------------------------------------------------------------------
function captureCallerSource(): { file: string; line?: number } | undefined {
  const stack = new Error().stack;
  if (!stack) return undefined;
  const lines = stack.split('\n').slice(1);
  for (const raw of lines) {
    if (raw.includes('/lib/intent.ts') || raw.includes('/lib/intent.js')) continue;
    if (raw.includes('node:internal/')) continue;
    const match =
      raw.match(/\((?:file:\/\/)?([^():]+):(\d+):\d+\)/) ||
      raw.match(/at\s+(?:file:\/\/)?([^():\s]+):(\d+):\d+/);
    if (match) return { file: match[1], line: Number(match[2]) };
  }
  return undefined;
}

function inferAppId(id: string): string | undefined {
  const dot = id.indexOf('.');
  if (dot > 0) return id.slice(0, dot);
  return undefined;
}

function detectDuplicateRegistration(id: string, source: { file: string; line?: number } | undefined): void {
  const existing = registry.get(id);
  if (!existing) return;
  const existingSrc = existing.source;
  // Same source file → HMR replacement, expected and silent.
  if (existingSrc && source && existingSrc.file === source.file) return;
  // Different source file → real collision.
  const key = `${id}|${existingSrc?.file ?? '?'}|${source?.file ?? '?'}`;
  if (warnedDuplicates.has(key)) return;
  warnedDuplicates.add(key);
  // eslint-disable-next-line no-console
  console.warn(
    `[intent] duplicate id "${id}" registered in two files:\n  ` +
      `existing: ${existingSrc?.file ?? '(unknown)'}\n  ` +
      `incoming: ${source?.file ?? '(unknown)'}\n` +
      `  The incoming registration wins. Rename one of the intents.`,
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register an intent and return an instrumented wrapper around `fn`.
 *
 * Each invocation:
 *   1. Generates a fresh `traceId`.
 *   2. Writes a `kind: 'span'` event with `status: 'active'`.
 *   3. Awaits `fn(...args)`.
 *   4. Writes a closing `kind: 'span'` event with `status: 'ok'` (success)
 *      or `'error'` (failure, with the error message). Rethrows on failure.
 *
 * Note: the wrapper always returns a Promise. Don't wrap sync helpers that
 * existing callers rely on synchronously — instrument an async caller instead.
 */
export function intent<TArgs extends unknown[], TResult>(
  meta: IntentMeta,
  fn: (...args: TArgs) => TResult | Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  const source = meta.source ?? captureCallerSource();
  detectDuplicateRegistration(meta.id, source);

  const stored: IntentRegistration = {
    meta: { ...meta, source: meta.source ?? source },
    fn: fn as IntentRegistration['fn'],
    source,
  };
  registry.set(meta.id, stored);

  const appId = meta.appId ?? inferAppId(meta.id);

  const wrapped = async (...args: TArgs): Promise<TResult> => {
    const traceId = makeTraceId();
    const startedAt = Date.now();
    await appendAgentSpanStart({
      name: meta.id,
      traceId,
      source: 'intent',
      playbook: meta.id,
      appId,
      args: argsForLog(args, meta.params),
    });
    try {
      const result = await fn(...args);
      await appendAgentSpanEnd({
        name: meta.id,
        traceId,
        startedAt,
        status: 'ok',
        source: 'intent',
        playbook: meta.id,
        appId,
      });
      return result;
    } catch (err) {
      await appendAgentSpanEnd({
        name: meta.id,
        traceId,
        startedAt,
        status: 'error',
        source: 'intent',
        playbook: meta.id,
        appId,
        error: err,
      });
      throw err;
    }
  };

  return wrapped;
}

/** Map runtime args onto declared param names where possible, otherwise
 *  fall back to a numbered structure. The redactor downstream handles secrets. */
function argsForLog(args: unknown[], params?: IntentParameter[]): Record<string, unknown> | undefined {
  if (args.length === 0) return undefined;
  if (params && params.length > 0) {
    const out: Record<string, unknown> = {};
    for (let i = 0; i < params.length; i++) {
      if (i >= args.length) break;
      out[params[i].name] = args[i];
    }
    return out;
  }
  if (args.length === 1) {
    if (args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      return args[0] as Record<string, unknown>;
    }
    return { value: args[0] };
  }
  return Object.fromEntries(args.map((value, index) => [`arg${index}`, value]));
}

export function listIntents(): IntentRegistryEntry[] {
  return Array.from(registry.values()).map(({ meta, fn }) => ({ meta, fn }));
}

export function getIntent(id: string): IntentRegistryEntry | undefined {
  const entry = registry.get(id);
  return entry ? { meta: entry.meta, fn: entry.fn } : undefined;
}

/** Convert a registry entry to the public ServerIntent catalog shape. */
export function intentMetaToServerIntent(meta: IntentMeta): ServerIntent {
  return {
    id: meta.id,
    title: meta.title,
    description: meta.description,
    category: meta.category ?? 'tool',
    keywords: meta.keywords ?? [],
    params: meta.params,
    importPath: meta.importPath,
    exportName: meta.exportName,
    appId: meta.appId ?? inferAppId(meta.id),
    body: meta.body,
    source: meta.source,
  };
}

/** For tests + HMR safety hatches. Not part of the runtime API. */
export function _resetIntentRegistry(): void {
  registry.clear();
  warnedDuplicates.clear();
}
