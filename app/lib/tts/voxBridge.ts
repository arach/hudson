export const HUDSON_VOX_DEFAULT_MODEL = 'avspeech:system';
export const HUDSON_VOX_DEFAULT_PROVIDER = 'vox';
export const HUDSON_VOX_BASE_URL = process.env.VOX_COMPANION_URL ?? 'http://127.0.0.1:43115';

export type HudsonVoxAudioFormat = 'mp3' | 'wav' | 'aac' | 'opus' | 'aiff';
export type HudsonVoxMetadataValue = string | number | boolean | null;
export type HudsonVoxMetadataMap = Record<string, HudsonVoxMetadataValue>;

export interface HudsonVoxModelOption {
  id: string;
  label: string;
  provider: typeof HUDSON_VOX_DEFAULT_PROVIDER;
  description?: string;
}

export interface HudsonVoxProviderOption {
  id: typeof HUDSON_VOX_DEFAULT_PROVIDER;
  label: string;
  available: boolean;
  reason?: string;
  defaultModel: string;
  models: HudsonVoxModelOption[];
  supportsVoiceSelection: boolean;
  supportsRate: boolean;
  supportsInstructions: boolean;
}

export interface HudsonVoxVoice {
  id: string;
  label: string;
  provider: typeof HUDSON_VOX_DEFAULT_PROVIDER;
  locale?: string;
  previewText?: string;
  metadata?: HudsonVoxMetadataMap;
}

export interface HudsonVoxVoiceCatalog {
  defaultProvider: typeof HUDSON_VOX_DEFAULT_PROVIDER;
  provider: typeof HUDSON_VOX_DEFAULT_PROVIDER;
  model: string;
  providers: HudsonVoxProviderOption[];
  models: HudsonVoxModelOption[];
  voices: HudsonVoxVoice[];
}

export interface HudsonVoxHealth extends HudsonVoxVoiceCatalog {
  ok: boolean;
  service: 'Hudson';
  voiceProvider: 'Vox';
  capabilities: {
    streaming: boolean;
    boundaries: boolean;
    providerSwitching: boolean;
    localTts: boolean;
    localAsr: boolean;
  };
  bridge?: unknown;
}

export interface HudsonVoxSpeechRequest {
  text: string;
  provider?: string;
  model?: string;
  voice?: string;
  rate?: number;
  instructions?: string;
  format?: HudsonVoxAudioFormat;
  metadata?: HudsonVoxMetadataMap;
}

export interface HudsonVoxSpeechResponse {
  requestId: string;
  provider: typeof HUDSON_VOX_DEFAULT_PROVIDER;
  model: string;
  voice: string;
  rate: number;
  format: HudsonVoxAudioFormat;
  cached: false;
  audio?: {
    base64: string;
    mimeType: string;
  };
  audioBase64?: string;
  mimeType: string;
  durationMs: number;
  metadata: HudsonVoxMetadataMap;
}

interface VoxVoiceRecord {
  id?: unknown;
  name?: unknown;
  label?: unknown;
  locale?: unknown;
  language?: unknown;
  sample?: unknown;
  previewText?: unknown;
  modelId?: unknown;
}

interface VoxSynthesisResult {
  audioBase64?: unknown;
  contentType?: unknown;
  format?: unknown;
  modelId?: unknown;
  voiceId?: unknown;
  audioBytes?: unknown;
  elapsedMs?: unknown;
  metrics?: {
    audioDurationMs?: unknown;
  };
}

let voiceCatalogCache: { fetchedAt: number; catalog: HudsonVoxVoiceCatalog } | null = null;
const VOICE_CATALOG_CACHE_TTL_MS = 30_000;

function voxUrl(path: string) {
  return new URL(path, HUDSON_VOX_BASE_URL);
}

function toMetadataValue(value: unknown): HudsonVoxMetadataValue | undefined {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value;
  }
  return undefined;
}

function normalizeModelId(model?: string) {
  if (!model || model === 'system') return HUDSON_VOX_DEFAULT_MODEL;
  return model;
}

function resolveVoxClientId(metadata?: HudsonVoxMetadataMap) {
  const explicit = metadata?.clientId;
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();
  const surface = metadata?.surface;
  if (typeof surface === 'string' && surface.trim()) return `hudson-${surface.trim()}`;
  return 'hudson-web';
}

export function clearHudsonVoxVoiceCache() {
  voiceCatalogCache = null;
}

export function resolveHudsonVoxMimeType(format: HudsonVoxAudioFormat): string {
  switch (format) {
    case 'aiff':
      return 'audio/aiff';
    case 'wav':
      return 'audio/wav';
    case 'aac':
      return 'audio/aac';
    case 'opus':
      return 'audio/opus';
    case 'mp3':
    default:
      return 'audio/mpeg';
  }
}

export function parseHudsonVoxNdjson(text: string): unknown[] {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function pickVoxSynthesisResult(chunks: unknown[]): VoxSynthesisResult {
  for (let index = chunks.length - 1; index >= 0; index -= 1) {
    const chunk = chunks[index];
    if (!chunk || typeof chunk !== 'object') continue;
    const record = chunk as Record<string, unknown>;
    if (record.error) {
      throw new Error(typeof record.error === 'string' ? record.error : 'Vox synthesis failed.');
    }
    if (record.result && typeof record.result === 'object') {
      return record.result as VoxSynthesisResult;
    }
  }

  throw new Error('Vox did not return a synthesis result.');
}

function normalizeHudsonVoxVoice(voice: VoxVoiceRecord): HudsonVoxVoice | null {
  const id = typeof voice.id === 'string' ? voice.id : null;
  if (!id) return null;

  const label = typeof voice.label === 'string'
    ? voice.label
    : typeof voice.name === 'string'
      ? voice.name
      : id;
  const locale = typeof voice.locale === 'string'
    ? voice.locale
    : typeof voice.language === 'string'
      ? voice.language
      : undefined;
  const previewText = typeof voice.previewText === 'string'
    ? voice.previewText
    : typeof voice.sample === 'string'
      ? voice.sample
      : undefined;
  const metadata: HudsonVoxMetadataMap = {};
  const modelId = toMetadataValue(voice.modelId);
  if (modelId !== undefined) metadata.modelId = modelId;

  return {
    id,
    label,
    provider: HUDSON_VOX_DEFAULT_PROVIDER,
    locale,
    previewText,
    metadata: Object.keys(metadata).length ? metadata : undefined,
  };
}

function createVoxModelOptions(voices: HudsonVoxVoice[], model: string): HudsonVoxModelOption[] {
  const ids = new Set<string>([normalizeModelId(model)]);
  for (const voice of voices) {
    const modelId = voice.metadata?.modelId;
    if (typeof modelId === 'string' && modelId) ids.add(modelId);
  }

  return Array.from(ids).map(id => ({
    id,
    label: id === HUDSON_VOX_DEFAULT_MODEL ? 'Vox System' : id,
    provider: HUDSON_VOX_DEFAULT_PROVIDER,
    description: id === HUDSON_VOX_DEFAULT_MODEL
      ? 'Local synthesis through Vox and the macOS speech backend.'
      : 'Local synthesis model exposed by Vox.',
  }));
}

function createUnavailableCatalog(model: string, reason: string): HudsonVoxVoiceCatalog {
  const normalizedModel = normalizeModelId(model);
  const models = createVoxModelOptions([], normalizedModel);
  return {
    defaultProvider: HUDSON_VOX_DEFAULT_PROVIDER,
    provider: HUDSON_VOX_DEFAULT_PROVIDER,
    model: normalizedModel,
    providers: [{
      id: HUDSON_VOX_DEFAULT_PROVIDER,
      label: 'Vox',
      available: false,
      reason,
      defaultModel: HUDSON_VOX_DEFAULT_MODEL,
      models,
      supportsVoiceSelection: true,
      supportsRate: true,
      supportsInstructions: true,
    }],
    models,
    voices: [],
  };
}

export function buildHudsonVoxSpeechResponse(args: {
  request: HudsonVoxSpeechRequest;
  result: VoxSynthesisResult;
  requestId?: string;
}): HudsonVoxSpeechResponse {
  const requestedFormat = args.request.format ?? 'aac';
  const resultFormat = typeof args.result.format === 'string'
    ? args.result.format as HudsonVoxAudioFormat
    : requestedFormat;
  const mimeType = typeof args.result.contentType === 'string'
    ? args.result.contentType.split(';', 1)[0]?.trim() || resolveHudsonVoxMimeType(resultFormat)
    : resolveHudsonVoxMimeType(resultFormat);
  const audioBase64 = typeof args.result.audioBase64 === 'string' ? args.result.audioBase64 : undefined;
  const durationMs = typeof args.result.metrics?.audioDurationMs === 'number'
    ? Math.round(args.result.metrics.audioDurationMs)
    : 0;
  const metadata: HudsonVoxMetadataMap = {
    backend: 'vox',
    vox: true,
  };
  if (typeof args.result.audioBytes === 'number') metadata.audioBytes = args.result.audioBytes;
  if (typeof args.result.elapsedMs === 'number') metadata.elapsedMs = args.result.elapsedMs;

  return {
    requestId: args.requestId ?? `vox_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    provider: HUDSON_VOX_DEFAULT_PROVIDER,
    model: typeof args.result.modelId === 'string' ? args.result.modelId : normalizeModelId(args.request.model),
    voice: typeof args.result.voiceId === 'string' ? args.result.voiceId : args.request.voice ?? '',
    rate: args.request.rate ?? 1,
    format: resultFormat,
    cached: false,
    audio: audioBase64 ? { base64: audioBase64, mimeType } : undefined,
    audioBase64,
    mimeType,
    durationMs,
    metadata,
  };
}

export async function synthesizeHudsonVoxSpeech(request: HudsonVoxSpeechRequest): Promise<HudsonVoxSpeechResponse> {
  const response = await fetch(voxUrl('/speak'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: resolveVoxClientId(request.metadata),
      text: request.text,
      modelId: normalizeModelId(request.model),
      voiceId: request.voice || undefined,
      format: request.format ?? 'aac',
      speed: request.rate ?? 1,
      instructions: request.instructions || undefined,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Vox synthesis failed (${response.status}).`);
  }

  return buildHudsonVoxSpeechResponse({
    request,
    result: pickVoxSynthesisResult(parseHudsonVoxNdjson(text)),
  });
}

export async function listHudsonVoxVoiceCatalog(args?: {
  model?: string;
  forceRefresh?: boolean;
}): Promise<HudsonVoxVoiceCatalog> {
  const model = normalizeModelId(args?.model);
  if (
    !args?.forceRefresh
    && voiceCatalogCache
    && Date.now() - voiceCatalogCache.fetchedAt < VOICE_CATALOG_CACHE_TTL_MS
    && voiceCatalogCache.catalog.model === model
  ) {
    return voiceCatalogCache.catalog;
  }

  const response = await fetch(voxUrl('/voices'));
  if (!response.ok) {
    throw new Error(`Vox voice catalog unavailable (${response.status}).`);
  }

  const payload = await response.json() as { voices?: VoxVoiceRecord[] };
  const voices = (payload.voices ?? [])
    .map(normalizeHudsonVoxVoice)
    .filter((voice): voice is HudsonVoxVoice => Boolean(voice));
  const models = createVoxModelOptions(voices, model);
  const catalog: HudsonVoxVoiceCatalog = {
    defaultProvider: HUDSON_VOX_DEFAULT_PROVIDER,
    provider: HUDSON_VOX_DEFAULT_PROVIDER,
    model,
    providers: [{
      id: HUDSON_VOX_DEFAULT_PROVIDER,
      label: 'Vox',
      available: true,
      defaultModel: HUDSON_VOX_DEFAULT_MODEL,
      models,
      supportsVoiceSelection: true,
      supportsRate: true,
      supportsInstructions: true,
    }],
    models,
    voices,
  };

  voiceCatalogCache = { fetchedAt: Date.now(), catalog };
  return catalog;
}

export async function getHudsonVoxHealth(): Promise<HudsonVoxHealth> {
  const [catalog, capabilitiesResponse] = await Promise.all([
    listHudsonVoxVoiceCatalog(),
    fetch(voxUrl('/capabilities')),
  ]);
  const bridge = capabilitiesResponse.ok ? await capabilitiesResponse.json() : null;
  const features = bridge && typeof bridge === 'object'
    ? (bridge as { features?: Record<string, unknown> }).features
    : undefined;

  return {
    ...catalog,
    ok: true,
    service: 'Hudson',
    voiceProvider: 'Vox',
    capabilities: {
      streaming: true,
      boundaries: false,
      providerSwitching: false,
      localTts: features?.local_tts === true,
      localAsr: features?.live_asr === true || features?.batch_asr === true,
    },
    bridge,
  };
}

export function createHudsonVoxUnavailableHealth(error: unknown): HudsonVoxHealth {
  const catalog = createUnavailableCatalog(
    HUDSON_VOX_DEFAULT_MODEL,
    error instanceof Error ? error.message : 'Vox companion is unavailable.',
  );
  return {
    ...catalog,
    ok: false,
    service: 'Hudson',
    voiceProvider: 'Vox',
    capabilities: {
      streaming: false,
      boundaries: false,
      providerSwitching: false,
      localTts: false,
      localAsr: false,
    },
  };
}
