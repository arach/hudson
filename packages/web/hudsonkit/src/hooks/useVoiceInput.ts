'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceStatus } from '../types/voice';
import { HObservabilityDefault } from '../observability';
import { useWorkspaceHostRoutes } from '../workspace/hostRoutes';
import {
  HudsonVoiceClientError,
  createHudsonVoiceClient,
  type HudsonVoiceAvailability,
  type HudsonVoiceClient,
  type HudsonVoiceLiveEvent,
  type HudsonVoiceLiveSession,
} from '../lib/hudsonVoiceClient';

const HUDSONKIT_VOX_CLIENT_ID = 'hudsonkit';

// ---------------------------------------------------------------------------
// useVoiceInput — Hudson-owned voice STT.
// By default, Hudson Menu owns mic capture through the embedded Vox daemon.
// Callers can still inject a transcribe() override to use browser MediaRecorder.
//
// This keeps app code on the Hudson voice boundary while preserving the older
// blob-transcription escape hatch for tests or custom providers.
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
  /** Identifies the calling Hudson voice surface (e.g. "hudson-ai", "assistant"). Defaults to "hudson-assistant". */
  surface?: string;
  /** Free-form metadata included with every transcribe request (e.g. `{ workspaceId }`). */
  metadata?: Record<string, unknown>;
  /** Spoken language hint. Defaults to "en". */
  language?: string;
  /** Optional STT provider override. If omitted, Hudson's embedded daemon owns capture. */
  transcribe?: TranscribeFn;
  /** Optional availability probe override for custom transcribe providers. */
  probe?: ProbeFn;
  /** Host route base for Hudson-owned voice capture. Required when `transcribe` is omitted. */
  voiceApiBase?: string;
}

export interface UseVoiceInputResult {
  status: VoiceStatus;
  error: string | null;
  /** The most recent transcript, useful for showing "draft ready" UI before send. */
  lastTranscript: string | null;
  start: () => Promise<void>;
  stop: () => void;
  /** Whether this environment can start the configured voice path. */
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
  if (error instanceof HudsonVoiceClientError) {
    if (error.code === 'network_error') {
      return {
        status: 'unavailable',
        message: 'Hudson voice service is not reachable. Launch Hudson Menu and try again.',
      };
    }
    if (error.code === 'daemon_error') {
      return {
        status: 'error',
        message: error.message || 'Hudson voice service returned an error.',
      };
    }
    if (error.code === 'session_id_missing') {
      return {
        status: 'error',
        message: 'Hudson voice session has not started yet.',
      };
    }
    return { status: 'error', message: error.message || 'Hudson voice capture failed.' };
  }

  // Duck-type legacy Vox errors for injected @voxd/client-style providers.
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const e = error as { code?: string; message?: string };
    if (e.code === 'network_error') {
      return {
        status: 'unavailable',
        message: 'Voice service is not reachable.',
      };
    }
    if (e.code === 'http_error') {
      const msg = e.message ?? '';
      if (msg.includes('Origin not allowed') || msg.includes('403')) {
        return {
          status: 'error',
          message: 'Voice service rejected this origin.',
        };
      }
      return { status: 'error', message: 'Voice service returned an error while transcribing.' };
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
  transcribe?: TranscribeFn;
  hudsonVoice?: HudsonVoiceClient;
  probeAvailability?: () => Promise<HudsonVoiceAvailability | 'blocked-origin'>;
}

async function loadDefaultHudsonVoiceClient(baseUrl: string): Promise<ClientHandle> {
  const client = createHudsonVoiceClient({
    baseUrl,
    clientId: HUDSONKIT_VOX_CLIENT_ID,
  });
  return {
    probe: () => client.probe(),
    hudsonVoice: client,
    probeAvailability: () => client.availability(),
  };
}

export function useVoiceInput(options: UseVoiceInputOptions): UseVoiceInputResult {
  const routes = useWorkspaceHostRoutes();
  const {
    onTranscript,
    surface = 'hudson-assistant',
    metadata,
    language = 'en',
    transcribe,
    probe,
    voiceApiBase,
  } = options;
  const resolvedVoiceApiBase = voiceApiBase ?? routes.voiceApiBase;

  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sessionRef = useRef<HudsonVoiceLiveSession | null>(null);
  const mountedRef = useRef(true);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;

  const clientRef = useRef<ClientHandle | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(transcribe ? canCaptureMicrophoneAudio() : Boolean(resolvedVoiceApiBase && typeof fetch !== 'undefined'));
  }, [transcribe, resolvedVoiceApiBase]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    clientRef.current = null;
  }, [resolvedVoiceApiBase]);

  const getClient = useCallback(async () => {
    if (transcribe) {
      return { probe: probe ?? (async () => true), transcribe };
    }
    if (!resolvedVoiceApiBase) {
      throw new Error('Hudson voice API route is not configured for this host.');
    }
    if (!clientRef.current) {
      clientRef.current = await loadDefaultHudsonVoiceClient(resolvedVoiceApiBase);
    }
    return clientRef.current;
  }, [transcribe, probe, resolvedVoiceApiBase]);

  const handleHudsonVoiceEvent = useCallback((event: HudsonVoiceLiveEvent) => {
    if (!mountedRef.current) return;

    if (event.event === 'session.state') {
      const state = typeof event.data.state === 'string' ? event.data.state : '';
      if (state === 'recording') setStatus('recording');
      if (state === 'processing') setStatus('transcribing');
      if (state === 'cancelled') setStatus('idle');
      if (state === 'error') setStatus('error');
      return;
    }

    if (event.event === 'session.final') {
      const rawText = typeof event.data.text === 'string' ? event.data.text : '';
      const transcript = rawText.trim();
      setLastTranscript(transcript);
      setStatus('ready');
      if (transcript) onTranscriptRef.current(transcript);
      return;
    }

    if (event.event === 'session.cancelled') {
      setStatus('idle');
      return;
    }

    if (event.event === 'session.error') {
      const message = typeof event.data.text === 'string'
        ? event.data.text
        : 'Hudson voice session failed.';
      setStatus('error');
      setError(message);
    }
  }, []);

  const consumeHudsonVoiceSession = useCallback(async (session: HudsonVoiceLiveSession) => {
    try {
      for await (const event of session.events) {
        handleHudsonVoiceEvent(event);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      HObservabilityDefault.logger.error('hudson.voice.daemon.stream_error', {
        category: 'voice',
        data: { surface, error: err instanceof Error ? err.message : String(err) },
      });
      const normalized = normalizeVoiceError(err);
      setStatus(normalized.status);
      setError(normalized.message);
    } finally {
      if (sessionRef.current === session) sessionRef.current = null;
    }
  }, [handleHudsonVoiceEvent, surface]);

  const startHudsonVoiceSession = useCallback(async (client: HudsonVoiceClient) => {
    const availability = await client.availability();
    if (availability === 'warming') {
      HObservabilityDefault.logger.info('hudson.voice.daemon.warming', {
        category: 'voice',
        data: { surface },
      });
      setStatus('unavailable');
      setError('Hudson voice service is starting up. Try again in a moment.');
      return;
    }
    if (availability === 'permission-denied') {
      setStatus('error');
      setError('Microphone access is denied for Hudson. Open Hudson Menu settings to grant microphone access.');
      return;
    }
    if (availability === 'unreachable') {
      HObservabilityDefault.logger.warn('hudson.voice.daemon.unreachable', {
        category: 'voice',
        data: { surface },
      });
      setStatus('unavailable');
      setError('Hudson voice service is not reachable. Launch Hudson Menu and try again.');
      return;
    }
    if (availability === 'error') {
      setStatus('error');
      setError('Hudson voice service is not ready. Check Hudson Menu and try again.');
      return;
    }

    const session = await client.startLiveSession({
      clientId: HUDSONKIT_VOX_CLIENT_ID,
      surface,
      language,
      mode: 'push_to_talk',
      metadata: metadataRef.current,
    });
    sessionRef.current = session;
    setStatus('recording');
    void consumeHudsonVoiceSession(session);
  }, [consumeHudsonVoiceSession, language, surface]);

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
      if (!client.transcribe) {
        throw new Error('Voice transcription is not configured.');
      }

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
      if (client.hudsonVoice && !client.transcribe) {
        await startHudsonVoiceSession(client.hudsonVoice);
        return;
      }

      const availability = client.probeAvailability
        ? await client.probeAvailability()
        : ((await client.probe()) ? 'connected' : 'unreachable');
      if (availability === 'blocked-origin') {
        HObservabilityDefault.logger.warn('hudson.voice.capture.blocked_origin', {
          category: 'voice',
          data: { surface },
        });
        const origin = typeof window !== 'undefined' ? window.location.origin : 'this origin';
        setStatus('error');
        setError(`Voice service rejected this origin. Allowlist ${origin} and try again.`);
        return;
      }
      if (availability === 'warming') {
        HObservabilityDefault.logger.info('hudson.voice.capture.warming', {
          category: 'voice',
          data: { surface },
        });
        setStatus('unavailable');
        setError('Voice service is starting up. Try again in a moment.');
        return;
      }
      if (availability === 'unreachable') {
        HObservabilityDefault.logger.warn('hudson.voice.capture.unreachable', {
          category: 'voice',
          data: { surface },
        });
        setStatus('unavailable');
        setError('Voice service is not reachable.');
        return;
      }
      if (availability === 'permission-denied') {
        setStatus('error');
        setError('Microphone access is denied for Hudson. Open Hudson Menu settings to grant microphone access.');
        return;
      }
      if (availability === 'error') {
        setStatus('error');
        setError('Voice service is not ready. Check Hudson Menu and try again.');
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
  }, [finalize, getClient, isSupported, startHudsonVoiceSession, status, surface]);

  const stop = useCallback(() => {
    const session = sessionRef.current;
    if (session) {
      setStatus('transcribing');
      void session.stop().catch(err => {
        const normalized = normalizeVoiceError(err);
        setStatus(normalized.status);
        setError(normalized.message);
      });
      return;
    }

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
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) void session.cancel().catch(() => {});
      streamRef.current = null;
      recorderRef.current = null;
      chunksRef.current = [];
    };
  }, []);

  return { status, error, lastTranscript, start, stop, isSupported };
}
