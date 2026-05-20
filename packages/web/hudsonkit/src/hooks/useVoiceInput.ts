'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceStatus } from '../types/voice';
import { probeVoxAvailability, type VoxAvailability } from '../lib/voxProbe';
import { HObservabilityDefault } from '../observability';

const HUDSONKIT_VOX_CLIENT_ID = 'hudsonkit';

// ---------------------------------------------------------------------------
// useVoiceInput — Vox-backed STT.
// Handles mic capture via MediaRecorder, ships audio to the local Vox companion
// (127.0.0.1:43115) for transcription, and surfaces the transcript via callback.
//
// Vox client is dynamically imported so the SDK has no hard dependency on
// @voxd/client; consumers that want to substitute another STT provider can
// pass in their own `transcribe` function.
// ---------------------------------------------------------------------------

type AudioFormat = 'wav' | 'aac' | 'opus';

type TranscribeFn = (input: {
  audio: Blob;
  format: AudioFormat;
  language?: string;
  metadata?: Record<string, unknown>;
}) => Promise<{ text: string }>;

type ProbeFn = () => Promise<boolean>;

export interface UseVoiceInputOptions {
  /** Called with the transcript once recording stops and transcription completes. */
  onTranscript: (transcript: string) => void;
  /** Identifies the calling surface in Vox metadata (e.g. "hudson-ai", "assistant"). Defaults to "hudson-assistant". */
  surface?: string;
  /** Free-form metadata included with every transcribe request (e.g. `{ workspaceId }`). */
  metadata?: Record<string, unknown>;
  /** Spoken language hint. Defaults to "en". */
  language?: string;
  /** Optional STT provider override. If omitted, the hook lazily loads @voxd/client. */
  transcribe?: TranscribeFn;
  /** Optional availability probe override. Defaults to the Vox client's probe(). */
  probe?: ProbeFn;
}

export interface UseVoiceInputResult {
  status: VoiceStatus;
  error: string | null;
  /** The most recent transcript, useful for showing "draft ready" UI before send. */
  lastTranscript: string | null;
  start: () => Promise<void>;
  stop: () => void;
  /** Whether MediaRecorder is supported in this environment. */
  isSupported: boolean;
}

const DEFAULT_VOICE_MIME_TYPE = 'audio/ogg;codecs=opus';

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/ogg;codecs=opus',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/webm;codecs=opus',
  ];
  return candidates.find(type => MediaRecorder.isTypeSupported(type));
}

function stopStreamTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach(track => track.stop());
}

function inferVoiceFormat(mimeType: string): AudioFormat {
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('aac') || mimeType.includes('mp4')) return 'aac';
  return 'opus';
}

function resolveRecordedMimeType(chunks: Blob[], mimeType: string): string {
  if (mimeType) return mimeType;
  const typedChunk = chunks.find(chunk => chunk.type);
  return typedChunk?.type || DEFAULT_VOICE_MIME_TYPE;
}

function sumChunkBytes(chunks: Blob[]) {
  return chunks.reduce((total, chunk) => total + chunk.size, 0);
}

function canCaptureMicrophoneAudio(): boolean {
  return typeof MediaRecorder !== 'undefined'
    && typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia;
}

interface NormalizedError {
  status: 'unavailable' | 'error';
  message: string;
}

function normalizeVoiceError(error: unknown): NormalizedError {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'this origin';

  // Duck-type Vox errors so we don't have to import @voxd/client at module scope
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const e = error as { code?: string; message?: string };
    if (e.code === 'network_error') {
      return {
        status: 'unavailable',
        message: 'Vox Companion is not reachable on 127.0.0.1:43115. Install Vox.app, or launch it if it is already installed.',
      };
    }
    if (e.code === 'http_error') {
      const msg = e.message ?? '';
      if (msg.includes('Origin not allowed') || msg.includes('403')) {
        return {
          status: 'error',
          message: `Vox rejected this origin. Allowlist ${origin} in Vox settings and try again.`,
        };
      }
      return { status: 'error', message: 'Vox returned an error while transcribing. Check Vox and try again.' };
    }
  }

  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return { status: 'error', message: 'Microphone access was denied.' };
    if (error.name === 'NotFoundError') return { status: 'error', message: 'No microphone is available.' };
  }

  if (error instanceof Error) return { status: 'error', message: error.message };
  return { status: 'error', message: 'Voice capture failed.' };
}

interface ClientHandle {
  probe: ProbeFn;
  transcribe: TranscribeFn;
  /** Detailed availability probe. Only present for the default @voxd/client-backed
   *  client; when a caller injects their own transcribe() we fall back to a
   *  binary probe and cannot distinguish warming / blocked-origin. */
  probeAvailability?: () => Promise<VoxAvailability>;
}

async function loadDefaultVoxClient(): Promise<ClientHandle> {
  const mod = await import('@voxd/client');
  const client = mod.createVoxdClient({ clientId: HUDSONKIT_VOX_CLIENT_ID });
  return {
    probe: () => client.probe(),
    transcribe: ({ audio, format, language, metadata }) =>
      client.transcribe({ audio, format, language, metadata }),
    probeAvailability: () => probeVoxAvailability(client),
  };
}

export function useVoiceInput(options: UseVoiceInputOptions): UseVoiceInputResult {
  const {
    onTranscript,
    surface = 'hudson-assistant',
    metadata,
    language = 'en',
    transcribe,
    probe,
  } = options;

  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;

  const clientRef = useRef<ClientHandle | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(canCaptureMicrophoneAudio());
  }, []);

  const getClient = useCallback(async () => {
    if (transcribe) {
      return { probe: probe ?? (async () => true), transcribe };
    }
    if (!clientRef.current) {
      clientRef.current = await loadDefaultVoxClient();
    }
    return clientRef.current;
  }, [transcribe, probe]);

  const finalize = useCallback(async (chunks: Blob[], mimeType: string) => {
    stopStreamTracks(streamRef.current);
    streamRef.current = null;
    recorderRef.current = null;

    if (chunks.length === 0) {
      HObservabilityDefault.logger.warn('hudson.voice.capture.empty', {
        category: 'voice',
        data: { surface },
      });
      setStatus('error');
      setError('No audio was captured.');
      return;
    }

    setStatus('transcribing');
    setError(null);

    const recordedMimeType = resolveRecordedMimeType(chunks, mimeType);
    const span = HObservabilityDefault.trace.start('hudson.voice.transcribe', {
      category: 'voice',
      data: {
        surface,
        format: inferVoiceFormat(recordedMimeType),
        mimeType: recordedMimeType,
        chunkCount: chunks.length,
        audioBytes: sumChunkBytes(chunks),
      },
    });

    try {
      const client = await getClient();
      const result = await client.transcribe({
        audio: new Blob(chunks, { type: recordedMimeType }),
        format: inferVoiceFormat(recordedMimeType),
        language,
        metadata: { clientId: HUDSONKIT_VOX_CLIENT_ID, surface, ...metadataRef.current },
      });
      const transcript = result.text.trim();
      if (!transcript) throw new Error('Transcription returned empty text.');

      span.end({ transcriptLength: transcript.length });
      setLastTranscript(transcript);
      setStatus('ready');
      onTranscriptRef.current(transcript);
    } catch (err) {
      span.error(err);
      const normalized = normalizeVoiceError(err);
      setStatus(normalized.status);
      setError(normalized.message);
    }
  }, [getClient, language, surface]);

  const start = useCallback(async () => {
    if (status === 'recording' || status === 'transcribing') return;
    if (!isSupported) {
      setStatus('error');
      setError('This browser cannot capture microphone audio.');
      return;
    }

    setError(null);
    setLastTranscript(null);

    try {
      const client = await getClient();
      const availability: VoxAvailability = client.probeAvailability
        ? await client.probeAvailability()
        : ((await client.probe()) ? 'connected' : 'unreachable');
      if (availability === 'blocked-origin') {
        HObservabilityDefault.logger.warn('hudson.voice.capture.blocked_origin', {
          category: 'voice',
          data: { surface },
        });
        const origin = typeof window !== 'undefined' ? window.location.origin : 'this origin';
        setStatus('error');
        setError(`Vox rejected this origin. Allowlist ${origin} in Vox settings and try again.`);
        return;
      }
      if (availability === 'warming') {
        HObservabilityDefault.logger.info('hudson.voice.capture.warming', {
          category: 'voice',
          data: { surface },
        });
        setStatus('unavailable');
        setError('Vox is starting up — try again in a moment.');
        return;
      }
      if (availability === 'unreachable') {
        HObservabilityDefault.logger.warn('hudson.voice.capture.unreachable', {
          category: 'voice',
          data: { surface },
        });
        setStatus('unavailable');
        setError('Vox Companion is not reachable on 127.0.0.1:43115. Install Vox.app, or launch it if it is already installed.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        stopStreamTracks(streamRef.current);
        streamRef.current = null;
        recorderRef.current = null;
        chunksRef.current = [];
        setStatus('error');
        setError('Voice capture failed while recording.');
      };

      recorder.onstop = () => {
        const recordedChunks = [...chunksRef.current];
        chunksRef.current = [];
        void finalize(recordedChunks, resolveRecordedMimeType(recordedChunks, recorder.mimeType || mimeType || ''));
      };

      recorder.start();
      HObservabilityDefault.logger.info('hudson.voice.capture.start', {
        category: 'voice',
        data: { surface, mimeType: recorder.mimeType || mimeType || null },
      });
      setStatus('recording');
    } catch (err) {
      HObservabilityDefault.logger.error('hudson.voice.capture.error', {
        category: 'voice',
        data: { surface, error: err instanceof Error ? err.message : String(err) },
      });
      const normalized = normalizeVoiceError(err);
      setStatus(normalized.status);
      setError(normalized.message);
    }
  }, [finalize, getClient, isSupported, status, surface]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    HObservabilityDefault.logger.info('hudson.voice.capture.stop', {
      category: 'voice',
      data: { surface, chunkCount: chunksRef.current.length },
    });
    setStatus('transcribing');
    recorder.stop();
  }, [surface]);

  // Cleanup on unmount: kill any live stream / recorder
  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state === 'recording') {
        try { recorder.stop(); } catch { /* ignore */ }
      }
      stopStreamTracks(streamRef.current);
      streamRef.current = null;
      recorderRef.current = null;
      chunksRef.current = [];
    };
  }, []);

  return { status, error, lastTranscript, start, stop, isSupported };
}
