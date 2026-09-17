import { ConversationError, isBrowserEnvironment, type FetchLike } from './types';
import { GEMINI_LIVE_PROVIDER_ID } from './gemini-live';
import { GPT_LIVE_PROVIDER_ID } from './openai-live';
import { record } from './wire';

// ---------------------------------------------------------------------------
// Host-facing model lists built from provider discovery, with refresh and
// honest handling of saved identifiers discovery no longer returns. No
// hand-maintained UI allowlists and no guessed identifiers: discovery proves
// an identifier exists; capabilities are claimed only with documentation.
// ---------------------------------------------------------------------------

export type CapabilitySupport = 'supported' | 'unsupported' | 'unknown';

export interface ConversationModel {
  provider: string;
  id: string;
  displayName: string;
  toolCalling: CapabilitySupport;
  configurableThinking: CapabilitySupport;
  /** Provider-documented caveats a settings surface should show verbatim. */
  notes?: string;
  /** False for a saved identifier absent from current discovery. */
  discovered: boolean;
}

export interface ModelCatalogEntry {
  model: ConversationModel;
  available: boolean;
}

export interface ConversationModelCatalog {
  /**
   * Fetch again. Failures propagate; the previous catalog is kept so a
   * failed refresh does not erase known models.
   */
  refresh(): Promise<void>;
  /**
   * Current entries plus, when `savedId` is missing from discovery, one
   * unavailable entry that preserves the saved choice.
   */
  entries(savedId?: string): ModelCatalogEntry[];
  lastRefreshed(): Date | null;
}

export function createConversationModelCatalog(options: {
  provider: string;
  fetchModels: () => Promise<ConversationModel[]>;
}): ConversationModelCatalog {
  let cached: ConversationModel[] = [];
  let fetchedAt: Date | null = null;
  return {
    async refresh() {
      cached = await options.fetchModels();
      fetchedAt = new Date();
    },
    entries(savedId) {
      const entries: ModelCatalogEntry[] = cached.map((model) => ({ model, available: true }));
      if (savedId && !cached.some((model) => model.id === savedId)) {
        entries.push({
          available: false,
          model: {
            provider: options.provider,
            id: savedId,
            displayName: savedId,
            toolCalling: 'unknown',
            configurableThinking: 'unknown',
            notes: 'Saved model not present in the current provider catalog. Compatibility is unverified.',
            discovered: false,
          },
        });
      }
      return entries;
    },
    lastRefreshed() {
      return fetchedAt;
    },
  };
}

function assertServerSide(what: string): void {
  if (isBrowserEnvironment()) {
    throw new ConversationError(
      'credential-boundary',
      `${what} needs a provider API key and runs on the host backend, never in a browser.`,
    );
  }
}

/**
 * GPT-Live discovery: the account model list filtered to GPT-Live
 * identifiers. The prefix filter is provider-documented naming, recorded as
 * unverified in the acceptance audit; an empty result stays empty.
 */
export async function fetchGPTLiveModels(options: {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
}): Promise<ConversationModel[]> {
  assertServerSide('GPT-Live model discovery');
  const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  const response = await fetchImpl(`${options.baseUrl ?? 'https://api.openai.com'}/v1/models`, {
    headers: { Authorization: `Bearer ${options.apiKey}` },
  });
  if (!response.ok) {
    throw new ConversationError('discovery-failed', 'The OpenAI model list request did not succeed.');
  }
  const body = record(await response.json());
  const rows = Array.isArray(body?.data) ? body.data : null;
  if (!rows) {
    throw new ConversationError('discovery-failed', 'The OpenAI model list request did not succeed.');
  }
  const models: ConversationModel[] = [];
  for (const raw of rows) {
    const row = record(raw);
    const id = typeof row?.id === 'string' ? row.id : null;
    // Transcription-only models share the prefix but cannot speak or run tools.
    if (!id || !id.startsWith('gpt-live') || id.startsWith('gpt-live-transcribe')) continue;
    models.push({
      provider: GPT_LIVE_PROVIDER_ID,
      id,
      displayName: id,
      toolCalling: 'supported',
      configurableThinking: 'unsupported',
      notes: 'Delegated backend work continues independently of speech interruption.',
      discovered: true,
    });
  }
  return models;
}

/**
 * Gemini Live discovery: the v1beta model list filtered to models that
 * support bidiGenerateContent, following pagination to the end. A later page
 * failure fails the refresh; a partial list is never returned.
 */
export async function fetchGeminiLiveModels(options: {
  apiKey: string;
  host?: string;
  fetchImpl?: FetchLike;
}): Promise<ConversationModel[]> {
  assertServerSide('Gemini Live model discovery');
  const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  const host = options.host ?? 'generativelanguage.googleapis.com';
  const models: ConversationModel[] = [];
  const seenIds = new Set<string>();
  const seenTokens = new Set<string>();
  let pageToken: string | null = null;
  do {
    const url = new URL(`https://${host}/v1beta/models`);
    url.searchParams.set('pageSize', '200');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetchImpl(url.toString(), {
      headers: { 'x-goog-api-key': options.apiKey },
    });
    if (!response.ok) {
      throw new ConversationError('discovery-failed', 'The Gemini model list request did not succeed.');
    }
    const body = record(await response.json());
    if (!body || !Array.isArray(body.models)) {
      throw new ConversationError('discovery-failed', 'The Gemini model list response was malformed.');
    }
    for (const raw of body.models) {
      const row = record(raw);
      const name = typeof row?.name === 'string' ? row.name : null;
      const methods = Array.isArray(row?.supportedGenerationMethods)
        ? row.supportedGenerationMethods : [];
      if (!name || !methods.includes('bidiGenerateContent')) continue;
      const id = name.startsWith('models/') ? name.slice('models/'.length) : name;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      models.push(geminiModel(id, typeof row?.displayName === 'string' ? row.displayName : id));
    }
    pageToken = typeof body?.nextPageToken === 'string' ? body.nextPageToken : null;
    if (pageToken) {
      if (seenTokens.has(pageToken)) {
        throw new ConversationError('discovery-failed', 'The Gemini model list repeated a page.');
      }
      seenTokens.add(pageToken);
    }
  } while (pageToken);
  return models;
}

/**
 * Capability metadata only for models whose behavior is documented;
 * discovery alone proves an identifier exists, not what it supports.
 */
function geminiModel(id: string, displayName: string): ConversationModel {
  if (id === 'gemini-3.8-live') {
    return {
      provider: GEMINI_LIVE_PROVIDER_ID, id, displayName,
      toolCalling: 'supported', configurableThinking: 'unsupported',
      notes: 'Audio response modality is required and proactive audio is always enabled.',
      discovered: true,
    };
  }
  if (id === 'gemini-3.8-live-extended-thinking') {
    return {
      provider: GEMINI_LIVE_PROVIDER_ID, id, displayName,
      toolCalling: 'supported', configurableThinking: 'supported',
      notes: 'Reasons while speaking. Tools must be non-blocking; result scheduling is unsupported.',
      discovered: true,
    };
  }
  return {
    provider: GEMINI_LIVE_PROVIDER_ID, id, displayName,
    toolCalling: 'unknown', configurableThinking: 'unknown',
    discovered: true,
  };
}
