// ---------------------------------------------------------------------------
// JSON Explorer — Domain Types
// ---------------------------------------------------------------------------

export type JsonNodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export interface JsonNode {
  key: string;
  path: string;
  type: JsonNodeType;
  value: unknown;
  childCount?: number;
}

export const TYPE_COLORS: Record<JsonNodeType, string> = {
  object: 'text-cyan-400/70',
  array: 'text-blue-400/70',
  string: 'text-amber-300/70',
  number: 'text-emerald-300/70',
  boolean: 'text-blue-300/70',
  null: 'text-neutral-500',
};

export const TYPE_BADGES: Record<JsonNodeType, string> = {
  object: 'bg-cyan-500/10 text-cyan-400/60',
  array: 'bg-blue-500/10 text-blue-400/60',
  string: 'bg-amber-500/10 text-amber-300/60',
  number: 'bg-emerald-500/10 text-emerald-300/60',
  boolean: 'bg-blue-500/10 text-blue-300/60',
  null: 'bg-neutral-500/10 text-neutral-400/60',
};

export function getNodeType(value: unknown): JsonNodeType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

export function getChildCount(value: unknown): number | undefined {
  if (Array.isArray(value)) return value.length;
  if (value !== null && typeof value === 'object') return Object.keys(value as object).length;
  return undefined;
}

export function getPreview(value: unknown, maxLen = 60): string {
  if (value === null) return 'null';
  if (typeof value === 'string') {
    return value.length > maxLen ? `"${value.slice(0, maxLen - 3)}..."` : `"${value}"`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') return `{${Object.keys(value as object).length} keys}`;
  return String(value);
}
