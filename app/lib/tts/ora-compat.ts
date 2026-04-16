import { createHash } from 'node:crypto';

export type HudsonOraAudioFormat = 'mp3' | 'wav' | 'aac' | 'opus' | 'aiff';
export type HudsonOraProvider = 'system' | 'openai' | 'elevenlabs' | 'groq';

export type HudsonOraMetadataValue = string | number | boolean | null;

export type HudsonOraMetadataMap = Record<string, HudsonOraMetadataValue>;

export type HudsonOraSynthesisPriority = 'quality' | 'balanced' | 'responsiveness';

export type HudsonOraSynthesisDelivery = 'buffered' | 'streaming' | 'auto';

export type HudsonOraSynthesisCacheStrategy = 'full-audio' | 'progressive';

export type HudsonOraSynthesisPreferences = {
  priority?: HudsonOraSynthesisPriority;
  delivery?: HudsonOraSynthesisDelivery;
  bitrateKbps?: number;
  sampleRateHz?: number;
};

export type HudsonOraResolvedSynthesisPlan = {
  priority: HudsonOraSynthesisPriority;
  delivery: Exclude<HudsonOraSynthesisDelivery, 'auto'>;
  format: HudsonOraAudioFormat;
  bitrateKbps: number;
  sampleRateHz: number;
  cacheStrategy: HudsonOraSynthesisCacheStrategy;
};

export type HudsonOraWorkerAudioAsset = {
  base64?: string;
  url?: string;
  mimeType?: string;
};

export type HudsonOraModelOption = {
  id: string;
  label: string;
  provider: HudsonOraProvider;
  description?: string;
};

export type HudsonOraProviderOption = {
  id: HudsonOraProvider;
  label: string;
  available: boolean;
  reason?: string;
  defaultModel: string;
  models: HudsonOraModelOption[];
  supportsVoiceSelection: boolean;
  supportsRate: boolean;
  supportsInstructions: boolean;
};

export type HudsonOraVoice = {
  id: string;
  label: string;
  provider: HudsonOraProvider;
  locale?: string;
  previewText?: string;
  metadata?: HudsonOraMetadataMap;
};

export type HudsonOraWorkerHealth = {
  ok: boolean;
  provider: HudsonOraProvider;
  providers: HudsonOraProviderOption[];
  defaultProvider: HudsonOraProvider;
  models: HudsonOraModelOption[];
  voices: HudsonOraVoice[];
  capabilities: {
    streaming: boolean;
    boundaries: boolean;
    providerSwitching: boolean;
  };
  error?: string;
};

export type HudsonOraWorkerSynthesisRequest = {
  text: string;
  provider?: HudsonOraProvider;
  model?: string;
  voice?: string;
  rate?: number;
  instructions?: string;
  format?: HudsonOraAudioFormat;
  preferences?: HudsonOraSynthesisPreferences;
  plan?: Partial<HudsonOraResolvedSynthesisPlan>;
  metadata?: HudsonOraMetadataMap;
};

export type HudsonOraWorkerSynthesisResponse = {
  requestId: string;
  cacheKey: string;
  provider: HudsonOraProvider;
  model: string;
  voice: string;
  rate: number;
  format: HudsonOraAudioFormat;
  cached: boolean;
  audio?: HudsonOraWorkerAudioAsset;
  audioBase64?: string;
  audioUrl?: string;
  mimeType?: string;
  durationMs: number;
  metadata?: HudsonOraMetadataMap;
};

export type HudsonSayVoice = {
  id: string;
  locale?: string;
  sample?: string;
};

export function resolveHudsonOraMimeType(format: HudsonOraAudioFormat): string {
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

export function createHudsonOraCacheKey(request: HudsonOraWorkerSynthesisRequest): string {
  return createHash('sha256')
    .update(JSON.stringify({
      provider: request.provider ?? 'system',
      model: request.model ?? 'default',
      text: request.text,
      voice: request.voice ?? 'default',
      rate: request.rate ?? 1,
      format: request.format ?? request.plan?.format ?? 'mp3',
      instructions: request.instructions ?? '',
    }))
    .digest('hex');
}

export function toHudsonOraBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export function parseHudsonSayVoices(output: string): HudsonSayVoice[] {
  const voices: HudsonSayVoice[] = [];

  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(/^(.+?)\s{2,}([a-z]{2}_[A-Z]{2})\s+#\s(.+)$/);
    if (!match) continue;

    voices.push({
      id: match[1]?.trim() ?? '',
      locale: match[2]?.trim(),
      sample: match[3]?.trim(),
    });
  }

  return voices;
}

export function toHudsonOraVoice(voice: HudsonSayVoice): HudsonOraVoice {
  return {
    id: voice.id,
    label: voice.locale ? `${voice.id} (${voice.locale.replace('_', '-')})` : voice.id,
    provider: 'system',
    ...(voice.locale ? { locale: voice.locale.replace('_', '-') } : {}),
    ...(voice.sample ? { previewText: voice.sample } : {}),
    metadata: {
      sample: voice.sample ?? null,
    },
  };
}

export function parseHudsonAfinfoDuration(output: string): number {
  const match = output.match(/estimated duration:\s+([0-9.]+)\s+sec/i);
  if (!match) return 0;
  return Math.round(Number(match[1]) * 1000);
}

export function rateToHudsonSayWordsPerMinute(rate?: number): number | null {
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    return null;
  }

  return Math.max(80, Math.min(360, Math.round(175 * rate)));
}

export function buildHudsonOraSynthesisResponse(args: {
  request: HudsonOraWorkerSynthesisRequest;
  requestId: string;
  provider: HudsonOraProvider;
  model: string;
  voice: string;
  audioData: Uint8Array;
  durationMs: number;
  format?: HudsonOraAudioFormat;
  mimeType?: string;
  metadata?: HudsonOraMetadataMap;
}): HudsonOraWorkerSynthesisResponse {
  const format = args.format ?? 'aiff';
  const mimeType = args.mimeType ?? resolveHudsonOraMimeType(format);
  const audioBase64 = toHudsonOraBase64(args.audioData);

  return {
    requestId: args.requestId,
    cacheKey: createHudsonOraCacheKey(args.request),
    provider: args.provider,
    model: args.model,
    voice: args.voice,
    rate: args.request.rate ?? 1,
    format,
    cached: false,
    audio: {
      base64: audioBase64,
      mimeType,
    },
    audioBase64,
    mimeType,
    durationMs: args.durationMs,
    ...(args.metadata ? { metadata: args.metadata } : {}),
  };
}
