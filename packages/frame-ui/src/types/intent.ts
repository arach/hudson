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
  /** Flat lookup: commandId → { appId, intent } */
  index: Record<string, { appId: string; intent: AppIntent }>;
}
