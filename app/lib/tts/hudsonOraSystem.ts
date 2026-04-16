import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildHudsonOraSynthesisResponse,
  parseHudsonAfinfoDuration,
  parseHudsonSayVoices,
  rateToHudsonSayWordsPerMinute,
  toHudsonOraVoice,
  type HudsonOraModelOption,
  type HudsonOraProviderOption,
  type HudsonOraWorkerHealth,
  type HudsonOraWorkerSynthesisRequest,
  type HudsonOraWorkerSynthesisResponse,
  type HudsonOraVoice,
} from './ora-compat';

let voiceCache: HudsonOraVoice[] | null = null;
const SYSTEM_MODEL_OPTIONS: HudsonOraModelOption[] = [
  {
    id: 'system',
    label: 'macOS System',
    provider: 'system',
    description: 'Local Apple voices via the macOS speech synthesizer.',
  },
];

const SYSTEM_PROVIDER_OPTIONS: HudsonOraProviderOption[] = [
  {
    id: 'system',
    label: 'macOS System',
    available: true,
    defaultModel: 'system',
    models: SYSTEM_MODEL_OPTIONS,
    supportsVoiceSelection: true,
    supportsRate: true,
    supportsInstructions: false,
  },
];

function resolveHudsonOraTranscodeTarget(format: HudsonOraWorkerSynthesisRequest['format']) {
  switch (format) {
    case 'wav':
      return {
        format: 'wav' as const,
        mimeType: 'audio/wav',
        extension: 'wav',
        afconvertArgs: ['-f', 'WAVE', '-d', 'LEI16'],
      };
    case 'aac':
      return {
        format: 'aac' as const,
        mimeType: 'audio/mp4',
        extension: 'm4a',
        afconvertArgs: ['-f', 'm4af', '-d', 'aac'],
      };
    default:
      return null;
  }
}

async function execFile(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolveExec, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      stdout += String(chunk);
    });
    child.stderr.on('data', chunk => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolveExec({ stdout, stderr });
        return;
      }

      reject(new Error(stderr.trim() || `${command} exited with code ${code}.`));
    });
  });
}

async function getHudsonOraAudioDurationMs(path: string): Promise<number> {
  try {
    const { stdout } = await execFile('/usr/bin/afinfo', [path]);
    return parseHudsonAfinfoDuration(stdout);
  } catch {
    return 0;
  }
}

async function resolveHudsonOraSystemVoice(requestedVoice?: string): Promise<string> {
  const voices = await listHudsonOraSystemVoices();

  if (requestedVoice && voices.some(voice => voice.id === requestedVoice)) {
    return requestedVoice;
  }

  return voices[0]?.id ?? 'Samantha';
}

export async function listHudsonOraSystemVoices(forceRefresh = false): Promise<HudsonOraVoice[]> {
  if (voiceCache && !forceRefresh) {
    return voiceCache;
  }

  const { stdout } = await execFile('/usr/bin/say', ['-v', '?']);
  voiceCache = parseHudsonSayVoices(stdout).map(toHudsonOraVoice);
  return voiceCache;
}

export async function getHudsonOraSystemHealth(): Promise<HudsonOraWorkerHealth> {
  return {
    ok: true,
    provider: 'system',
    providers: SYSTEM_PROVIDER_OPTIONS,
    defaultProvider: 'system',
    models: SYSTEM_MODEL_OPTIONS,
    voices: await listHudsonOraSystemVoices(),
    capabilities: {
      streaming: false,
      boundaries: false,
      providerSwitching: false,
    },
  };
}

export async function synthesizeHudsonOraSystemSpeech(
  request: HudsonOraWorkerSynthesisRequest,
): Promise<HudsonOraWorkerSynthesisResponse> {
  const requestId = randomUUID();
  const voice = await resolveHudsonOraSystemVoice(request.voice);
  const model = request.model ?? 'system';
  const tempDir = await mkdtemp(join(tmpdir(), 'hudson-ora-'));
  const filePath = join(tempDir, `${requestId}.aiff`);
  const requestedFormat = request.format ?? request.plan?.format;
  const transcodeTarget = resolveHudsonOraTranscodeTarget(requestedFormat);
  const sayArgs = ['-v', voice];
  const wordsPerMinute = rateToHudsonSayWordsPerMinute(request.rate);

  if (wordsPerMinute) {
    sayArgs.push('-r', String(wordsPerMinute));
  }

  sayArgs.push('-o', filePath, request.text);

  try {
    await execFile('/usr/bin/say', sayArgs);
    const durationMs = await getHudsonOraAudioDurationMs(filePath);
    let outputPath = filePath;
    let outputFormat: HudsonOraWorkerSynthesisResponse['format'] = 'aiff';
    let outputMimeType = 'audio/aiff';
    let conversionFallback: string | null = null;

    if (transcodeTarget) {
      const transcodedPath = join(tempDir, `${requestId}.${transcodeTarget.extension}`);

      try {
        await execFile('/usr/bin/afconvert', [
          filePath,
          ...transcodeTarget.afconvertArgs,
          transcodedPath,
        ]);
        outputPath = transcodedPath;
        outputFormat = transcodeTarget.format;
        outputMimeType = transcodeTarget.mimeType;
      } catch {
        conversionFallback = 'aiff';
      }
    }

    const audioData = new Uint8Array(await readFile(outputPath));

    return buildHudsonOraSynthesisResponse({
      request,
      requestId,
      provider: 'system',
      model,
      voice,
      audioData,
      durationMs,
      format: outputFormat,
      mimeType: outputMimeType,
      metadata: {
        ...(request.metadata ?? {}),
        backend: 'system',
        requestedFormat: requestedFormat ?? null,
        actualFormat: outputFormat,
        ...(conversionFallback ? { conversionFallback } : {}),
      },
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
