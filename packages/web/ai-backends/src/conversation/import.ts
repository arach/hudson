import { ConversationError, type ConversationConfig, type ThinkingLevel } from './types';
import { record } from './wire';
import { validateConversationSettings } from './samples/settings';

// ---------------------------------------------------------------------------
// Settings file import: a versioned, secret-free, portable JSON document
// shared byte-for-byte with the native implementation.
//
// Guarantees:
// - Secret-free by construction: the schema has no secret-bearing field and
//   unknown keys at any level are strict errors. Options are an explicit
//   version-1 allowlist (`delegationModel` only) so authored delegation JSON
//   cannot smuggle tools, headers, or tokens through an import. A
//   defense-in-depth heuristic additionally rejects documents whose string
//   values look like known secret shapes.
// - All string bounds are measured in UTF-8 bytes on both platforms so the
//   same document is accepted or rejected identically everywhere.
// - No consent, ever: import STAGES a configuration for the host's existing
//   explicit save path; nothing becomes active here and no network or
//   provider call is made.
// - Atomic: parsing and validation either return a fully-formed staged value
//   or throw; a failed import cannot have touched prior settings, typed
//   secrets, or stored credentials.
// - Unknown or unsupported inputs (format, version, keys, combinations) are
//   rejected with the reason, never imported best-effort.
// ---------------------------------------------------------------------------

export const CONVERSATION_SETTINGS_FORMAT = 'hudson-conversation-settings';
export const CONVERSATION_SETTINGS_VERSION = 1;
/** Documents larger than this are rejected before parsing. */
export const CONVERSATION_SETTINGS_MAX_BYTES = 65_536;

export interface StagedConversationSettings {
  configuration: ConversationConfig;
  /** Opaque name into host credential storage; never a secret value. */
  credentialReference?: string;
  credentialKind?: 'apiKey' | 'ephemeralToken';
}

const TOP_LEVEL_KEYS = new Set(['format', 'version', 'configuration', 'credentialReference', 'credentialKind']);
const CONFIGURATION_KEYS = new Set([
  'provider', 'model', 'instructions', 'voice', 'inputSampleRate', 'thinkingLevel', 'options',
]);
const THINKING_LEVELS: ThinkingLevel[] = ['low', 'medium', 'high'];
/**
 * Version-1 options allowlist. Authored delegation JSON is deliberately not
 * importable; it is configured in the app where its own validation applies.
 */
const ALLOWED_OPTION_KEYS = new Set(['delegationModel']);
const SECRET_SHAPES = [/^sk-/, /^AIza/, /^ya29\./, /^Bearer /, /-----BEGIN/];

function invalid(message: string): ConversationError {
  return new ConversationError('invalid-configuration', message);
}

function requireString(value: unknown, field: string, maxBytes: number, minBytes = 0): string {
  if (typeof value !== 'string') throw invalid(`${field} must be a string.`);
  const byteLength = new TextEncoder().encode(value).byteLength;
  if (byteLength < minBytes) throw invalid(`${field} must not be empty.`);
  if (byteLength > maxBytes) throw invalid(`${field} exceeds ${maxBytes} UTF-8 bytes.`);
  for (const shape of SECRET_SHAPES) {
    if (shape.test(value)) {
      throw invalid(`${field} looks like a secret value; settings documents carry no keys or tokens.`);
    }
  }
  return value;
}

function rejectUnknownKeys(object: Record<string, unknown>, allowed: Set<string>, where: string): void {
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) {
      throw invalid(`${where} carries the unknown field "${key}"; unknown fields are not imported.`);
    }
  }
}

/**
 * Parse and validate one settings document. Returns a staged value the host
 * feeds to its existing, explicit save path — or throws without side effects.
 */
export function parseConversationSettingsDocument(text: string): StagedConversationSettings {
  if (new TextEncoder().encode(text).byteLength > CONVERSATION_SETTINGS_MAX_BYTES) {
    throw invalid(`Settings documents are limited to ${CONVERSATION_SETTINGS_MAX_BYTES} bytes.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw invalid('The file is not valid JSON.');
  }
  const root = record(parsed);
  if (!root) throw invalid('The document must be a JSON object.');
  rejectUnknownKeys(root, TOP_LEVEL_KEYS, 'The document');
  if (root.format !== CONVERSATION_SETTINGS_FORMAT) {
    throw invalid(`The document is not a ${CONVERSATION_SETTINGS_FORMAT} file.`);
  }
  if (root.version !== CONVERSATION_SETTINGS_VERSION) {
    throw new ConversationError(
      'unsupported',
      `Settings document version ${String(root.version)} is not supported; this importer reads version ${CONVERSATION_SETTINGS_VERSION}.`,
    );
  }
  const rawConfiguration = record(root.configuration);
  if (!rawConfiguration) throw invalid('The document must carry a configuration object.');
  rejectUnknownKeys(rawConfiguration, CONFIGURATION_KEYS, 'The configuration');

  const configuration: ConversationConfig = {
    provider: requireString(rawConfiguration.provider, 'provider', 128, 1),
    model: requireString(rawConfiguration.model, 'model', 256, 1),
    inputSampleRate: 0,
  };
  const rate = rawConfiguration.inputSampleRate;
  if (typeof rate !== 'number' || !Number.isInteger(rate) || rate < 1 || rate > 384_000) {
    throw invalid('inputSampleRate must be an integer between 1 and 384000.');
  }
  configuration.inputSampleRate = rate;
  if (rawConfiguration.instructions !== undefined) {
    configuration.instructions = requireString(rawConfiguration.instructions, 'instructions', 8_192);
  }
  if (rawConfiguration.voice !== undefined) {
    configuration.voice = requireString(rawConfiguration.voice, 'voice', 128);
  }
  if (rawConfiguration.thinkingLevel !== undefined) {
    const level = rawConfiguration.thinkingLevel;
    if (typeof level !== 'string' || !THINKING_LEVELS.includes(level as ThinkingLevel)) {
      throw invalid('thinkingLevel must be low, medium, or high.');
    }
    configuration.thinkingLevel = level as ThinkingLevel;
  }
  if (rawConfiguration.options !== undefined) {
    const rawOptions = record(rawConfiguration.options);
    if (!rawOptions) throw invalid('options must be an object of strings.');
    const options: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawOptions)) {
      if (key === 'delegation') {
        throw invalid(
          'Authored delegation JSON is not importable in version 1; set delegationModel and configure delegation in the app.',
        );
      }
      if (!ALLOWED_OPTION_KEYS.has(key)) {
        throw invalid(`options carries the unsupported key "${key}"; version 1 imports only delegationModel.`);
      }
      options[key] = requireString(value, `options.${key}`, 2_048);
    }
    configuration.options = options;
  }

  const staged: StagedConversationSettings = { configuration };
  // credentialReference and credentialKind travel as a pair so neither
  // platform inherits a default kind for a named credential: the same
  // document means the same credential shape everywhere.
  const hasReference = root.credentialReference !== undefined;
  const hasKind = root.credentialKind !== undefined;
  if (hasReference && !hasKind) {
    throw invalid('credentialReference needs credentialKind (apiKey or ephemeralToken) beside it.');
  }
  if (hasKind && !hasReference) {
    throw invalid('credentialKind without credentialReference names no credential.');
  }
  if (hasReference && hasKind) {
    staged.credentialReference = requireString(root.credentialReference, 'credentialReference', 256, 1);
    if (root.credentialKind !== 'apiKey' && root.credentialKind !== 'ephemeralToken') {
      throw invalid('credentialKind must be apiKey or ephemeralToken.');
    }
    staged.credentialKind = root.credentialKind;
  }

  // Provider rules come from the connectors' own validators — the same code
  // a live connect enforces — so an unsupported combination cannot import.
  const problems = validateConversationSettings(configuration);
  if (problems.length > 0) {
    throw invalid(problems.join(' '));
  }
  return staged;
}

/**
 * Browser helper: import from a File (or any object with `text()`), enforcing
 * the size bound before the content is read where the size is known.
 */
export async function importConversationSettingsFile(file: {
  size?: number;
  text(): Promise<string>;
}): Promise<StagedConversationSettings> {
  if (typeof file.size === 'number' && file.size > CONVERSATION_SETTINGS_MAX_BYTES) {
    throw invalid(`Settings documents are limited to ${CONVERSATION_SETTINGS_MAX_BYTES} bytes.`);
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw invalid('The file could not be read.');
  }
  return parseConversationSettingsDocument(text);
}

/** A valid GPT-Live document, usable as an example and in fixtures. */
export const sampleGPTLiveImportDocument = {
  format: CONVERSATION_SETTINGS_FORMAT,
  version: CONVERSATION_SETTINGS_VERSION,
  configuration: {
    provider: 'openai-gpt-live',
    model: 'gpt-live-1',
    instructions: 'You are a concise spoken assistant.',
    voice: 'alloy',
    inputSampleRate: 24_000,
    options: { delegationModel: 'gpt-5.2' },
  },
  credentialReference: 'openai-conversation-key',
  credentialKind: 'apiKey',
} as const;

/** A valid Gemini extended-thinking document. */
export const sampleGeminiImportDocument = {
  format: CONVERSATION_SETTINGS_FORMAT,
  version: CONVERSATION_SETTINGS_VERSION,
  configuration: {
    provider: 'gemini-live-conversation',
    model: 'gemini-3.8-live-extended-thinking',
    voice: 'Kore',
    inputSampleRate: 16_000,
    thinkingLevel: 'medium',
  },
  credentialReference: 'gemini-conversation-key',
  credentialKind: 'apiKey',
} as const;
