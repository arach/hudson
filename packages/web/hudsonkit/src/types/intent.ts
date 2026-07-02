export type IntentCategory =
  | 'tool'
  | 'edit'
  | 'file'
  | 'view'
  | 'navigation'
  | 'toggle'
  | 'workspace'
  | 'settings';

export interface IntentParameter {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean';
  optional?: boolean;
  enum?: string[];
  default?: string | number | boolean;
}

export interface AppIntent {
  /** Must match a CommandOption.id from useCommands() — this is the execution bridge */
  commandId: string;
  /** Human-readable title: "Switch to Pen Tool" */
  title: string;
  /** Natural-language description for LLM/voice matching */
  description: string;
  category: IntentCategory;
  /** Synonyms for fuzzy/semantic matching */
  keywords: string[];
  params?: IntentParameter[];
  shortcut?: string;
  /** If true, intent requires confirmation before execution */
  dangerous?: boolean;
}

/**
 * A server-callable intent — a function in the codebase wrapped with `intent(...)`.
 *
 * Distinct from {@link AppIntent} because server intents have a different
 * execution model (no React closure; the agent imports and calls them) and
 * different metadata needs (`importPath`/`exportName` so agents know how to
 * reach the function, `body` for the agentic recipe). Lives on
 * `IntentCatalog.serverIntents`, never in `IntentCatalog.index` (which is
 * keyed for UI dispatch).
 */
export interface ServerIntent {
  /** Stable id, e.g. `docs.reindex`. */
  id: string;
  /** Human-readable title. */
  title: string;
  /** Natural-language description. */
  description: string;
  category: IntentCategory;
  keywords: string[];
  /** Typed parameter schema; same shape used by AppIntent UI intents. */
  params?: IntentParameter[];
  /** Where the function lives, relative to repo root (e.g. `apps/web/app/api/docs/intents`). */
  importPath: string;
  /** Named export to import (e.g. `reindexDocs`). */
  exportName: string;
  /** Owner app id when the intent belongs to an app, otherwise undefined. */
  appId?: string;
  /** Agentic body — markdown guidance for how to fulfill the intent. */
  body?: string;
  /** Source file location of the registration, when captured at register time. */
  source?: { file: string; line?: number };
}

export interface CatalogAppEntry {
  appId: string;
  appName: string;
  appDescription: string;
  intents: AppIntent[];
}

export interface IntentCatalog {
  version: 1;
  generatedAt: string;
  workspace: { id: string; name: string };
  shell: AppIntent[];
  apps: CatalogAppEntry[];
  /** Flat lookup of UI intents only: commandId → { appId, intent }.
   *  Server intents do not appear here — `useIntentExecutor` keys off this
   *  index and would warn on every entry without a matching React closure. */
  index: Record<string, { appId: string; intent: AppIntent }>;
  /** Server-callable intents registered via `intent(...)`. Separate from
   *  `apps[].intents` and `index` because they're not dispatchable from the UI. */
  serverIntents?: ServerIntent[];
}
