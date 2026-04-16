import { randomUUID } from 'node:crypto';
import { loadCredentials } from '@/app/api/ai/providers';
import {
  buildHudsonOraSynthesisResponse,
  resolveHudsonOraMimeType,
  type HudsonOraAudioFormat,
  type HudsonOraModelOption,
  type HudsonOraProvider,
  type HudsonOraProviderOption,
  type HudsonOraVoice,
  type HudsonOraWorkerHealth,
  type HudsonOraWorkerSynthesisRequest,
  type HudsonOraWorkerSynthesisResponse,
} from './ora-compat';
import {
  listHudsonOraSystemVoices,
  synthesizeHudsonOraSystemSpeech,
} from './hudsonOraSystem';

const ELEVENLABS_VOICE_CACHE_TTL_MS = 60_000;
const GROQ_MAX_INPUT_CHARS = 200;
const DEFAULT_PREVIEW_TEXT = 'Hello from Hudson. This is the current reply voice.';

const SYSTEM_MODEL_OPTIONS: HudsonOraModelOption[] = [
  {
    id: 'system',
    label: 'macOS System',
    provider: 'system',
    description: 'Local Apple voices via the macOS speech synthesizer.',
  },
];

const OPENAI_MODEL_OPTIONS: HudsonOraModelOption[] = [
  {
    id: 'gpt-4o-mini-tts',
    label: 'GPT-4o Mini TTS',
    provider: 'openai',
    description: 'OpenAI multi-style text-to-speech.',
  },
  {
    id: 'tts-1-hd',
    label: 'TTS-1 HD',
    provider: 'openai',
    description: 'Higher quality OpenAI speech synthesis.',
  },
  {
    id: 'tts-1',
    label: 'TTS-1',
    provider: 'openai',
    description: 'Lower latency OpenAI speech synthesis.',
  },
];

const ELEVENLABS_MODEL_OPTIONS: HudsonOraModelOption[] = [
  {
    id: 'eleven_multilingual_v2',
    label: 'Multilingual v2',
    provider: 'elevenlabs',
    description: 'Balanced quality across many languages.',
  },
  {
    id: 'eleven_flash_v2_5',
    label: 'Flash v2.5',
    provider: 'elevenlabs',
    description: 'Lower-latency ElevenLabs synthesis.',
  },
];

const GROQ_MODEL_OPTIONS: HudsonOraModelOption[] = [
  {
    id: 'canopylabs/orpheus-v1-english',
    label: 'Orpheus English',
    provider: 'groq',
    description: 'Expressive English TTS with vocal directions.',
  },
  {
    id: 'canopylabs/orpheus-arabic-saudi',
    label: 'Orpheus Arabic (Saudi)',
    provider: 'groq',
    description: 'Saudi Arabic speech synthesis.',
  },
];

const OPENAI_VOICES: HudsonOraVoice[] = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
].map(voice => ({
  id: voice,
  label: voice[0]?.toUpperCase() + voice.slice(1),
  provider: 'openai',
  locale: 'en-US',
  previewText: DEFAULT_PREVIEW_TEXT,
}));

const GROQ_ENGLISH_VOICES: HudsonOraVoice[] = [
  'austin',
  'hannah',
  'troy',
].map(voice => ({
  id: voice,
  label: voice[0]?.toUpperCase() + voice.slice(1),
  provider: 'groq',
  locale: 'en-US',
  previewText: DEFAULT_PREVIEW_TEXT,
}));

const GROQ_ARABIC_VOICES: HudsonOraVoice[] = [
  'layla',
  'salim',
].map(voice => ({
  id: voice,
  label: voice[0]?.toUpperCase() + voice.slice(1),
  provider: 'groq',
  locale: 'ar-SA',
  previewText: DEFAULT_PREVIEW_TEXT,
}));

type VoiceCatalogResponse = {
  defaultProvider: HudsonOraProvider;
  provider: HudsonOraProvider;
  model: string;
  providers: HudsonOraProviderOption[];
  models: HudsonOraModelOption[];
  voices: HudsonOraVoice[];
};

let elevenlabsVoiceCache:
  | {
      fetchedAt: number;
      voices: HudsonOraVoice[];
    }
  | null = null;

export function clearHudsonOraRegistryCache() {
  elevenlabsVoiceCache = null;
}

function getDefaultHudsonOraProvider(): HudsonOraProvider {
  return 'system';
}

function getHudsonOraModelOptions(provider: HudsonOraProvider): HudsonOraModelOption[] {
  switch (provider) {
    case 'openai':
      return OPENAI_MODEL_OPTIONS;
    case 'elevenlabs':
      return ELEVENLABS_MODEL_OPTIONS;
    case 'groq':
      return GROQ_MODEL_OPTIONS;
    case 'system':
    default:
      return SYSTEM_MODEL_OPTIONS;
  }
}

function isHudsonOraProviderAvailable(provider: HudsonOraProvider): {
  available: boolean;
  reason?: string;
} {
  const creds = loadCredentials();

  switch (provider) {
    case 'openai':
      return creds.openai
        ? { available: true }
        : { available: false, reason: 'Set OPENAI_API_KEY in Hudson Environment to enable OpenAI voices.' };
    case 'elevenlabs':
      return creds.elevenlabs
        ? { available: true }
        : { available: false, reason: 'Set ELEVENLABS_API_KEY in Hudson Environment to enable ElevenLabs voices.' };
    case 'groq':
      return creds.groq
        ? { available: true }
        : { available: false, reason: 'Set GROQ_API_KEY in Hudson Environment to enable Groq voices.' };
    case 'system':
    default:
      return { available: true };
  }
}

function getHudsonOraProviderOptions(): HudsonOraProviderOption[] {
  return ([
    {
      id: 'system',
      label: 'macOS System',
      supportsVoiceSelection: true,
      supportsRate: true,
      supportsInstructions: false,
    },
    {
      id: 'openai',
      label: 'OpenAI',
      supportsVoiceSelection: true,
      supportsRate: true,
      supportsInstructions: true,
    },
    {
      id: 'elevenlabs',
      label: 'ElevenLabs',
      supportsVoiceSelection: true,
      supportsRate: false,
      supportsInstructions: false,
    },
    {
      id: 'groq',
      label: 'Groq',
      supportsVoiceSelection: true,
      supportsRate: false,
      supportsInstructions: false,
    },
  ] as const).map(provider => {
    const availability = isHudsonOraProviderAvailable(provider.id);
    const models = getHudsonOraModelOptions(provider.id);
    return {
      ...provider,
      available: availability.available,
      ...(availability.reason ? { reason: availability.reason } : {}),
      defaultModel: models[0]?.id ?? 'system',
      models,
    };
  });
}

function resolveHudsonOraModel(provider: HudsonOraProvider, requestedModel?: string): string {
  const models = getHudsonOraModelOptions(provider);
  if (requestedModel && models.some(model => model.id === requestedModel)) {
    return requestedModel;
  }
  return models[0]?.id ?? 'system';
}

function truncateAtWordBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars).trim();
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > Math.floor(maxChars * 0.6) ? slice.slice(0, lastSpace) : slice)
    .replace(/[,:; -]+$/, '')
    .trim();
}

function truncateForGroqSpeech(text: string): string {
  return truncateAtWordBoundary(text, GROQ_MAX_INPUT_CHARS);
}

function resolveHudsonOraRequestedFormat(
  provider: HudsonOraProvider,
  requestedFormat?: HudsonOraAudioFormat,
): HudsonOraAudioFormat {
  switch (provider) {
    case 'openai':
      return requestedFormat && ['aac', 'mp3', 'opus', 'wav'].includes(requestedFormat)
        ? requestedFormat
        : 'mp3';
    case 'groq':
      return 'wav';
    case 'elevenlabs':
      return 'mp3';
    case 'system':
    default:
      return requestedFormat ?? 'aiff';
  }
}

function resolveHudsonOraResponseMimeType(
  format: HudsonOraAudioFormat,
  contentType: string | null,
): string {
  if (contentType) {
    return contentType.split(';', 1)[0]?.trim() || resolveHudsonOraMimeType(format);
  }
  if (format === 'aac') {
    return 'audio/mp4';
  }
  return resolveHudsonOraMimeType(format);
}

async function requireHudsonOraProviderKey(provider: Extract<HudsonOraProvider, 'openai' | 'elevenlabs' | 'groq'>): Promise<string> {
  const creds = loadCredentials();

  switch (provider) {
    case 'openai':
      if (creds.openai) return creds.openai;
      throw new Error('OPENAI_API_KEY is not configured.');
    case 'elevenlabs':
      if (creds.elevenlabs) return creds.elevenlabs;
      throw new Error('ELEVENLABS_API_KEY is not configured.');
    case 'groq':
      if (creds.groq) return creds.groq;
      throw new Error('GROQ_API_KEY is not configured.');
  }
}

async function listHudsonOraElevenLabsVoices(): Promise<HudsonOraVoice[]> {
  if (
    elevenlabsVoiceCache
    && Date.now() - elevenlabsVoiceCache.fetchedAt < ELEVENLABS_VOICE_CACHE_TTL_MS
  ) {
    return elevenlabsVoiceCache.voices;
  }

  const apiKey = await requireHudsonOraProviderKey('elevenlabs');
  const response = await fetch('https://api.elevenlabs.io/v2/voices?page_size=100', {
    headers: {
      'xi-api-key': apiKey,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs voice list failed (${response.status}).`);
  }

  const payload = await response.json() as {
    voices?: Array<{
      voice_id: string;
      name: string;
      description?: string;
      category?: string;
      preview_url?: string;
      labels?: Record<string, string>;
    }>;
  };

  const voices = (payload.voices ?? [])
    .map(voice => ({
      id: voice.voice_id,
      label: voice.name,
      provider: 'elevenlabs' as const,
      ...(voice.labels?.language ? { locale: voice.labels.language } : {}),
      previewText: voice.description?.trim() || DEFAULT_PREVIEW_TEXT,
      metadata: {
        category: voice.category ?? null,
        previewUrl: voice.preview_url ?? null,
        accent: voice.labels?.accent ?? null,
        age: voice.labels?.age ?? null,
        gender: voice.labels?.gender ?? null,
      },
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  elevenlabsVoiceCache = {
    fetchedAt: Date.now(),
    voices,
  };

  return voices;
}

async function listHudsonOraVoicesForProvider(
  provider: HudsonOraProvider,
  model: string,
): Promise<HudsonOraVoice[]> {
  switch (provider) {
    case 'openai':
      return OPENAI_VOICES;
    case 'elevenlabs':
      return isHudsonOraProviderAvailable('elevenlabs').available
        ? listHudsonOraElevenLabsVoices()
        : [];
    case 'groq':
      return model === 'canopylabs/orpheus-arabic-saudi'
        ? GROQ_ARABIC_VOICES
        : GROQ_ENGLISH_VOICES;
    case 'system':
    default:
      return listHudsonOraSystemVoices();
  }
}

async function resolveHudsonOraVoiceId(
  provider: HudsonOraProvider,
  model: string,
  requestedVoice?: string,
): Promise<string | undefined> {
  if (!requestedVoice) return undefined;
  const voices = await listHudsonOraVoicesForProvider(provider, model);
  return voices.some(voice => voice.id === requestedVoice) ? requestedVoice : undefined;
}

async function synthesizeHudsonOraOpenAICompatibleSpeech(args: {
  provider: 'openai' | 'groq';
  apiKey: string;
  model: string;
  request: HudsonOraWorkerSynthesisRequest;
  endpoint: string;
  defaultVoice: string;
}): Promise<HudsonOraWorkerSynthesisResponse> {
  const format = resolveHudsonOraRequestedFormat(args.provider, args.request.format ?? args.request.plan?.format);
  const voice = (await resolveHudsonOraVoiceId(args.provider, args.model, args.request.voice))
    ?? args.defaultVoice;
  const text = args.provider === 'groq'
    ? truncateForGroqSpeech(args.request.text)
    : args.request.text;

  const body: Record<string, unknown> = {
    model: args.model,
    voice,
    input: text,
    response_format: format,
  };

  if (args.provider === 'openai') {
    if (typeof args.request.rate === 'number' && Number.isFinite(args.request.rate)) {
      body.speed = args.request.rate;
    }
    if (args.request.instructions?.trim()) {
      body.instructions = args.request.instructions.trim();
    }
  }

  const response = await fetch(args.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `${args.provider[0]?.toUpperCase() + args.provider.slice(1)} speech failed (${response.status}): ${errorText || 'Unknown error.'}`,
    );
  }

  const audioData = new Uint8Array(await response.arrayBuffer());
  const mimeType = resolveHudsonOraResponseMimeType(format, response.headers.get('content-type'));

  return buildHudsonOraSynthesisResponse({
    request: {
      ...args.request,
      provider: args.provider,
      model: args.model,
      text,
    },
    requestId: randomUUID(),
    provider: args.provider,
    model: args.model,
    voice,
    audioData,
    durationMs: 0,
    format,
    mimeType,
    metadata: {
      ...(args.request.metadata ?? {}),
      backend: args.provider,
      requestedFormat: args.request.format ?? args.request.plan?.format ?? null,
      actualFormat: format,
      ...(text !== args.request.text ? { truncatedForProvider: true } : {}),
    },
  });
}

async function synthesizeHudsonOraElevenLabsSpeech(
  request: HudsonOraWorkerSynthesisRequest,
  model: string,
): Promise<HudsonOraWorkerSynthesisResponse> {
  const apiKey = await requireHudsonOraProviderKey('elevenlabs');
  const format = resolveHudsonOraRequestedFormat('elevenlabs', request.format ?? request.plan?.format);
  const voices = await listHudsonOraElevenLabsVoices();
  const voice = (await resolveHudsonOraVoiceId('elevenlabs', model, request.voice))
    ?? voices[0]?.id;

  if (!voice) {
    throw new Error('No ElevenLabs voices are available for this account.');
  }

  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`);
  url.searchParams.set('output_format', 'mp3_44100_128');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: request.text,
      model_id: model,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs speech failed (${response.status}): ${errorText || 'Unknown error.'}`);
  }

  const audioData = new Uint8Array(await response.arrayBuffer());
  const mimeType = resolveHudsonOraResponseMimeType(format, response.headers.get('content-type'));

  return buildHudsonOraSynthesisResponse({
    request: {
      ...request,
      provider: 'elevenlabs',
      model,
    },
    requestId: randomUUID(),
    provider: 'elevenlabs',
    model,
    voice,
    audioData,
    durationMs: 0,
    format,
    mimeType,
    metadata: {
      ...(request.metadata ?? {}),
      backend: 'elevenlabs',
      requestedFormat: request.format ?? request.plan?.format ?? null,
      actualFormat: format,
    },
  });
}

export async function listHudsonOraVoiceCatalog(args?: {
  provider?: HudsonOraProvider;
  model?: string;
}): Promise<VoiceCatalogResponse> {
  const providers = getHudsonOraProviderOptions();
  const provider = args?.provider ?? getDefaultHudsonOraProvider();
  const model = resolveHudsonOraModel(provider, args?.model);
  const voices = await listHudsonOraVoicesForProvider(provider, model);

  return {
    defaultProvider: getDefaultHudsonOraProvider(),
    provider,
    model,
    providers,
    models: getHudsonOraModelOptions(provider),
    voices,
  };
}

export async function getHudsonOraHealth(): Promise<HudsonOraWorkerHealth> {
  const catalog = await listHudsonOraVoiceCatalog({
    provider: getDefaultHudsonOraProvider(),
  });

  return {
    ok: true,
    provider: catalog.provider,
    providers: catalog.providers,
    defaultProvider: catalog.defaultProvider,
    models: catalog.models,
    voices: catalog.voices,
    capabilities: {
      streaming: false,
      boundaries: false,
      providerSwitching: true,
    },
  };
}

export async function synthesizeHudsonOraSpeech(
  request: HudsonOraWorkerSynthesisRequest,
): Promise<HudsonOraWorkerSynthesisResponse> {
  const provider = request.provider ?? getDefaultHudsonOraProvider();
  const providerAvailability = isHudsonOraProviderAvailable(provider);

  if (!providerAvailability.available) {
    throw new Error(providerAvailability.reason || `${provider} is not configured.`);
  }

  const model = resolveHudsonOraModel(provider, request.model);

  switch (provider) {
    case 'openai':
      return synthesizeHudsonOraOpenAICompatibleSpeech({
        provider: 'openai',
        apiKey: await requireHudsonOraProviderKey('openai'),
        model,
        request,
        endpoint: 'https://api.openai.com/v1/audio/speech',
        defaultVoice: 'alloy',
      });
    case 'elevenlabs':
      return synthesizeHudsonOraElevenLabsSpeech(request, model);
    case 'groq':
      return synthesizeHudsonOraOpenAICompatibleSpeech({
        provider: 'groq',
        apiKey: await requireHudsonOraProviderKey('groq'),
        model,
        request,
        endpoint: 'https://api.groq.com/openai/v1/audio/speech',
        defaultVoice: model === 'canopylabs/orpheus-arabic-saudi' ? 'layla' : 'hannah',
      });
    case 'system':
    default:
      return synthesizeHudsonOraSystemSpeech({
        ...request,
        provider: 'system',
        model,
      });
  }
}
