import {
  createHudsonTextDocument,
  type DocumentLanguage,
  type HudsonTextDocument,
  type TextDocumentKind,
} from 'hudsonkit';

export interface CodeDocumentSource {
  appId?: string;
  objectType?: string;
  objectId?: string;
  portId?: string;
  [key: string]: unknown;
}

export interface HudsonCodeDocument extends HudsonTextDocument {
  source?: CodeDocumentSource;
  metadata?: Record<string, unknown>;
  updatedAt: number;
  savedAt?: number;
}

export interface CodeDocumentPayload {
  id?: string;
  title?: string;
  uri?: string;
  filename?: string;
  mediaType?: string;
  language?: DocumentLanguage;
  kind?: TextDocumentKind;
  value?: unknown;
  content?: unknown;
  code?: unknown;
  sourceCode?: unknown;
  readOnly?: boolean;
  source?: CodeDocumentSource;
  metadata?: Record<string, unknown>;
}

export interface CoerceCodeDocumentOptions {
  idPrefix?: string;
  title?: string;
  mediaType?: string;
  language?: DocumentLanguage;
  kind?: TextDocumentKind;
  readOnly?: boolean;
  source?: CodeDocumentSource;
  now?: number;
}

const DOCUMENT_LANGUAGES = new Set<DocumentLanguage>([
  'typescript',
  'javascript',
  'json',
  'css',
  'html',
  'shell',
  'plain',
  'markdown',
]);

const DOCUMENT_KINDS = new Set<TextDocumentKind>(['text', 'markdown', 'code', 'raw']);

export const EMPTY_JSON_DOCUMENT = '{\n  "hudson": true\n}';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asLanguage(value: unknown): DocumentLanguage | undefined {
  return typeof value === 'string' && DOCUMENT_LANGUAGES.has(value as DocumentLanguage)
    ? value as DocumentLanguage
    : undefined;
}

function asKind(value: unknown): TextDocumentKind | undefined {
  return typeof value === 'string' && DOCUMENT_KINDS.has(value as TextDocumentKind)
    ? value as TextDocumentKind
    : undefined;
}

function asSource(value: unknown): CodeDocumentSource | undefined {
  return isRecord(value) ? { ...value } : undefined;
}

function asMetadata(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? { ...value } : undefined;
}

function rawDocumentValue(input: Record<string, unknown>): unknown {
  if ('value' in input) return input.value;
  if ('content' in input) return input.content;
  if ('code' in input) return input.code;
  if ('sourceCode' in input) return input.sourceCode;
  return undefined;
}

export function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_key, nested) => {
      if (typeof nested === 'object' && nested !== null) {
        if (seen.has(nested)) return '[Circular]';
        seen.add(nested);
      }
      return nested;
    }, 2);
  } catch (error) {
    return String(error instanceof Error ? error.message : value);
  }
}

function valueToDocumentText(value: unknown): string {
  if (typeof value === 'string') return value;
  return safeStringify(value);
}

function makeIncomingId(prefix: string, now: number): string {
  return `${prefix}-${now.toString(36)}`;
}

export function createScratchCodeDocument(now = 0): HudsonCodeDocument {
  return coerceCodeDocumentFromInput({
    id: 'scratch-json',
    title: 'scratch.json',
    uri: 'hudson://code-editor/scratch.json',
    mediaType: 'application/json',
    language: 'json',
    kind: 'code',
    value: EMPTY_JSON_DOCUMENT,
  }, { now, idPrefix: 'scratch' });
}

export function coerceCodeDocumentFromInput(
  data: unknown,
  options: CoerceCodeDocumentOptions = {},
): HudsonCodeDocument {
  const now = options.now ?? Date.now();
  const prefix = options.idPrefix ?? 'incoming';

  if (isRecord(data) && rawDocumentValue(data) !== undefined) {
    const text = valueToDocumentText(rawDocumentValue(data));
    const title = asString(data.title) ?? asString(data.filename) ?? options.title ?? 'object.json';
    const document = createHudsonTextDocument({
      id: asString(data.id) ?? asString(data.uri) ?? makeIncomingId(prefix, now),
      title,
      uri: asString(data.uri),
      filename: asString(data.filename) ?? title,
      mediaType: asString(data.mediaType) ?? options.mediaType,
      language: asLanguage(data.language) ?? options.language,
      kind: asKind(data.kind) ?? options.kind,
      value: text,
      readOnly: asBoolean(data.readOnly) ?? options.readOnly,
    });

    return {
      ...document,
      source: asSource(data.source) ?? options.source,
      metadata: asMetadata(data.metadata),
      updatedAt: now,
      savedAt: now,
    };
  }

  if (typeof data === 'string') {
    const title = options.title ?? (options.language === 'json' ? 'piped.json' : 'piped.txt');
    const document = createHudsonTextDocument({
      id: makeIncomingId(prefix, now),
      title,
      filename: title,
      mediaType: options.mediaType ?? (options.language === 'json' ? 'application/json' : 'text/plain'),
      language: options.language,
      kind: options.kind,
      value: data,
      readOnly: options.readOnly,
    });

    return {
      ...document,
      source: options.source,
      updatedAt: now,
      savedAt: now,
    };
  }

  const title = options.title ?? 'object.json';
  const document = createHudsonTextDocument({
    id: makeIncomingId(prefix, now),
    title,
    filename: title,
    mediaType: options.mediaType ?? 'application/json',
    language: options.language ?? 'json',
    kind: options.kind ?? 'code',
    value: valueToDocumentText(data),
    readOnly: options.readOnly,
  });

  return {
    ...document,
    source: options.source,
    updatedAt: now,
    savedAt: now,
  };
}

export function serializeCodeDocument(document: HudsonCodeDocument): CodeDocumentPayload {
  return {
    id: document.id,
    title: document.title,
    uri: document.uri,
    mediaType: document.mediaType,
    language: document.language,
    kind: document.kind,
    value: document.value,
    readOnly: document.readOnly,
    source: document.source,
    metadata: document.metadata,
  };
}

export function parseCodeDocumentJson(document: HudsonCodeDocument): unknown | null {
  try {
    return JSON.parse(document.value);
  } catch {
    return null;
  }
}

export function getCodeDocumentParseError(document: HudsonCodeDocument | null): string | null {
  if (!document || document.language !== 'json') return null;
  try {
    JSON.parse(document.value);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid JSON';
  }
}
