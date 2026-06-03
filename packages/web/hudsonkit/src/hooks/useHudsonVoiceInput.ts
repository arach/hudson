'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { VoiceStatus } from '../types/voice';
import { HObservabilityDefault } from '../observability';
import {
  HudsonVoiceClientError,
  createHudsonVoiceClient,
  type HudsonVoiceAvailability,
  type HudsonVoiceClient,
  type HudsonVoiceClientOptions,
  type HudsonVoiceLiveEvent,
  type HudsonVoiceLiveSession,
  type HudsonVoiceMode,
} from '../lib/hudsonVoiceClient';

export interface UseHudsonVoiceInputOptions {
  /** Called with the final transcript once the Hudson daemon emits `session.final`. */
  onTranscript: (transcript: string) => void;
  /** Inject an already-created client, useful for tests or app-level discovery/auth. */
  client?: HudsonVoiceClient;
  /** Create a Hudson voice client from these options when `client` is not supplied. */
  clientOptions?: HudsonVoiceClientOptions;
  /** Identifies the calling Hudson surface, e.g. "terminal" or "hudson-assistant". */
  surface?: string;
  /** Free-form metadata included with every live session request. */
  metadata?: Record<string, unknown>;
  /** Spoken language hint. Defaults to "en". */
  language?: string;
  /** Transcription model id. Defaults to the daemon/runtime default. */
  modelId?: string;
  /** Session mode. Defaults to "push_to_talk". */
  mode?: HudsonVoiceMode;
  /** Optional daemon-side input device override. */
  deviceId?: string;
}

export interface UseHudsonVoiceInputResult {
  status: VoiceStatus;
  error: string | null;
  lastTranscript: string | null;
  partialTranscript: string | null;
  sessionId: string | null;
  start: () => Promise<void>;
  stop: () => void;
  cancel: () => void;
  /** Whether this environment can talk to the Hudson voice service. */
  isSupported: boolean;
}

function canUseHudsonVoiceService(
  client: HudsonVoiceClient | undefined,
  clientOptions: HudsonVoiceClientOptions | undefined,
): boolean {
  if (client) return true;
  if (!clientOptions) return false;
  return typeof ReadableStream !== 'undefined'
    && (!!clientOptions.fetch || typeof fetch !== 'undefined');
}

function availabilityMessage(availability: HudsonVoiceAvailability): string {
  switch (availability) {
  case 'warming':
    return 'Hudson voice service is starting up. Try again in a moment.';
  case 'permission-denied':
    return 'Microphone access is denied for Hudson. Open Hudson settings to grant microphone access.';
  case 'unreachable':
    return 'Hudson voice service is not reachable. Launch the Hudson app and try again.';
  case 'error':
    return 'Hudson voice service is not ready. Check the Hudson app and try again.';
  case 'connected':
  default:
    return '';
  }
}

function normalizeHudsonVoiceInputError(error: unknown): { status: VoiceStatus; message: string } {
  if (error instanceof HudsonVoiceClientError) {
    if (error.code === 'network_error') {
      return {
        status: 'unavailable',
        message: 'Hudson voice service is not reachable. Launch the Hudson app and try again.',
      };
    }
    if (error.code === 'session_id_missing') {
      return {
        status: 'error',
        message: 'Hudson voice session has not started yet.',
      };
    }
    return {
      status: 'error',
      message: error.message || 'Hudson voice service returned an error.',
    };
  }

  if (error instanceof Error) return { status: 'error', message: error.message };
  return { status: 'error', message: 'Hudson voice capture failed.' };
}

function readEventText(event: HudsonVoiceLiveEvent): string {
  const data = event.data;
  if (data && typeof data === 'object' && 'text' in data) {
    const text = (data as { text?: unknown }).text;
    return typeof text === 'string' ? text : '';
  }
  return '';
}

function readEventState(event: HudsonVoiceLiveEvent): string {
  const data = event.data;
  if (data && typeof data === 'object' && 'state' in data) {
    const state = (data as { state?: unknown }).state;
    return typeof state === 'string' ? state : '';
  }
  return '';
}

export function useHudsonVoiceInput(options: UseHudsonVoiceInputOptions): UseHudsonVoiceInputResult {
  const {
    onTranscript,
    client,
    clientOptions,
    surface = 'hudson-assistant',
    metadata,
    language = 'en',
    modelId,
    mode = 'push_to_talk',
    deviceId,
  } = options;

  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [partialTranscript, setPartialTranscript] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;

  const createdClientRef = useRef<HudsonVoiceClient | null>(null);
  const sessionRef = useRef<HudsonVoiceLiveSession | null>(null);
  const mountedRef = useRef(true);

  const isSupported = useMemo(
    () => canUseHudsonVoiceService(client, clientOptions),
    [client, clientOptions],
  );

  useEffect(() => {
    createdClientRef.current = null;
  }, [clientOptions]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) void session.cancel().catch(() => {});
    };
  }, []);

  const getClient = useCallback(() => {
    if (client) return client;
    if (!clientOptions) {
      throw new HudsonVoiceClientError(
        'network_error',
        'Hudson voice service is not configured.',
      );
    }
    if (!createdClientRef.current) {
      createdClientRef.current = createHudsonVoiceClient(clientOptions);
    }
    return createdClientRef.current;
  }, [client, clientOptions]);

  const handleEvent = useCallback((event: HudsonVoiceLiveEvent) => {
    if (!mountedRef.current) return;
    if (event.sessionId) setSessionId(event.sessionId);

    if (event.event === 'session.state') {
      const nextState = readEventState(event);
      if (nextState === 'recording') setStatus('recording');
      if (nextState === 'processing') setStatus('transcribing');
      if (nextState === 'cancelled') setStatus('idle');
      if (nextState === 'error') setStatus('error');
      return;
    }

    if (event.event === 'session.partial') {
      setPartialTranscript(readEventText(event));
      return;
    }

    if (event.event === 'session.final') {
      const transcript = readEventText(event).trim();
      setPartialTranscript(null);
      setLastTranscript(transcript);
      setStatus('ready');
      if (transcript) onTranscriptRef.current(transcript);
      return;
    }

    if (event.event === 'session.cancelled') {
      setPartialTranscript(null);
      setStatus('idle');
      return;
    }

    if (event.event === 'session.error') {
      const message = readEventText(event) || 'Hudson voice session failed.';
      setStatus('error');
      setError(message);
    }
  }, []);

  const consumeSession = useCallback(async (session: HudsonVoiceLiveSession) => {
    try {
      for await (const event of session.events) {
        handleEvent(event);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      HObservabilityDefault.logger.error('hudson.voice.service.stream_error', {
        category: 'voice',
        data: { surface, error: err instanceof Error ? err.message : String(err) },
      });
      const normalized = normalizeHudsonVoiceInputError(err);
      setStatus(normalized.status);
      setError(normalized.message);
    } finally {
      if (sessionRef.current === session) sessionRef.current = null;
    }
  }, [handleEvent, surface]);

  const start = useCallback(async () => {
    if (status === 'recording' || status === 'transcribing') return;
    if (!isSupported) {
      setStatus('unavailable');
      setError('Hudson voice service is not configured.');
      return;
    }

    setError(null);
    setLastTranscript(null);
    setPartialTranscript(null);
    setSessionId(null);

    try {
      const voiceClient = getClient();
      const availability = await voiceClient.availability();
      if (availability !== 'connected') {
        setStatus(availability === 'warming' || availability === 'unreachable' ? 'unavailable' : 'error');
        setError(availabilityMessage(availability));
        return;
      }

      const session = await voiceClient.startLiveSession({
        surface,
        language,
        modelId,
        mode,
        deviceId,
        metadata: metadataRef.current,
      });
      sessionRef.current = session;
      setStatus('recording');
      void consumeSession(session);
    } catch (err) {
      HObservabilityDefault.logger.error('hudson.voice.service.start_error', {
        category: 'voice',
        data: { surface, error: err instanceof Error ? err.message : String(err) },
      });
      const normalized = normalizeHudsonVoiceInputError(err);
      setStatus(normalized.status);
      setError(normalized.message);
    }
  }, [consumeSession, deviceId, getClient, isSupported, language, mode, modelId, status, surface]);

  const stop = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    setStatus('transcribing');
    void session.stop().catch(err => {
      const normalized = normalizeHudsonVoiceInputError(err);
      setStatus(normalized.status);
      setError(normalized.message);
    });
  }, []);

  const cancel = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    setPartialTranscript(null);
    setStatus('idle');
    void session.cancel().catch(err => {
      const normalized = normalizeHudsonVoiceInputError(err);
      setStatus(normalized.status);
      setError(normalized.message);
    });
  }, []);

  return {
    status,
    error,
    lastTranscript,
    partialTranscript,
    sessionId,
    start,
    stop,
    cancel,
    isSupported,
  };
}
