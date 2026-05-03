'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlatform } from '../platform/PlatformContext';
import type { VoiceProvider, VoiceStatus } from '../types/voice';
import { HObservabilityDefault } from '../observability';

// ---------------------------------------------------------------------------
// useVoiceOutput — TTS playback via the host app's /v1/audio/speech route.
// Caller passes raw text; the hook handles synthesis + playback + cleanup.
// Returns a `speak()` you can call from a chat hook's onFinish, plus a stop().
// ---------------------------------------------------------------------------

export interface SpeakOptions {
  provider?: VoiceProvider;
  model?: string;
  voice?: string;
  rate?: number;
  /** Free-form metadata included with the speech request (e.g. surface, sessionId). */
  metadata?: Record<string, unknown>;
}

export interface UseVoiceOutputResult {
  status: VoiceStatus;
  error: string | null;
  /** Synthesize and play the given text. Resolves once playback starts (or fails). */
  speak: (text: string, opts?: SpeakOptions) => Promise<void>;
  /** Stop any in-flight playback and discard pending requests. */
  stop: () => void;
  /** True while audio is streaming or actively playing. */
  isPlaying: boolean;
}

function pickReplySpeechFormat(): 'aac' | 'wav' {
  if (typeof document === 'undefined') return 'wav';
  const audio = document.createElement('audio');
  return audio.canPlayType('audio/mp4; codecs="mp4a.40.2"') ? 'aac' : 'wav';
}

interface SpeechResponsePayload {
  error?: string;
  mimeType?: string;
  audioBase64?: string;
  audio?: { base64?: string; mimeType?: string };
}

export function useVoiceOutput(): UseVoiceOutputResult {
  const { apiBaseUrl } = usePlatform();
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  const stop = useCallback(() => {
    requestIdRef.current += 1;

    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setStatus(current => (current === 'speaking' || current === 'synthesizing' ? 'idle' : current));
  }, []);

  const speak = useCallback(async (text: string, opts: SpeakOptions = {}) => {
    if (!text || !text.trim()) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus('synthesizing');
    setError(null);

    const format = pickReplySpeechFormat();
    const span = HObservabilityDefault.trace.start('hudson.voice.reply.speak', {
      category: 'voice',
      data: {
        provider: opts.provider,
        model: opts.model,
        voice: opts.voice,
        format,
        textLength: text.trim().length,
      },
    });

    try {
      const response = await fetch(`${apiBaseUrl}/v1/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          provider: opts.provider,
          model: opts.model,
          voice: opts.voice || undefined,
          rate: opts.rate,
          format,
          metadata: opts.metadata,
        }),
      });

      const payload = (await response.json()) as SpeechResponsePayload;

      if (!response.ok) {
        throw new Error(payload.error || `Speech synthesis failed (${response.status}).`);
      }

      const audioBase64 = payload.audio?.base64 ?? payload.audioBase64;
      const mimeType = payload.audio?.mimeType ?? payload.mimeType ?? 'audio/wav';

      if (!audioBase64) throw new Error('Speech synthesis returned no audio.');

      // If a newer request superseded this one, drop the result silently.
      if (requestIdRef.current !== requestId) {
        span.end({ superseded: true });
        return;
      }

      // Tear down any prior playback before starting this one.
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }

      const binary = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
      const blob = new Blob([binary], { type: mimeType });
      const objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);

      audioRef.current = audio;
      audioUrlRef.current = objectUrl;
      setStatus('speaking');

      audio.onended = () => {
        if (audioRef.current === audio) audioRef.current = null;
        if (audioUrlRef.current === objectUrl) {
          URL.revokeObjectURL(objectUrl);
          audioUrlRef.current = null;
        }
        setStatus(current => (current === 'speaking' ? 'idle' : current));
      };

      audio.onerror = () => {
        if (audioRef.current === audio) audioRef.current = null;
        if (audioUrlRef.current === objectUrl) {
          URL.revokeObjectURL(objectUrl);
          audioUrlRef.current = null;
        }
        setStatus('error');
        setError('Reply audio could not be played in this browser.');
      };

      await audio.play();
      span.end({ mimeType, audioBytesApprox: Math.round(audioBase64.length * 0.75) });
    } catch (err) {
      if (requestIdRef.current !== requestId) {
        span.end({ superseded: true });
        return;
      }
      span.error(err);
      stop();
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Reply speech failed.');
    }
  }, [apiBaseUrl, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
      }
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioRef.current = null;
      audioUrlRef.current = null;
    };
  }, []);

  return {
    status,
    error,
    speak,
    stop,
    isPlaying: status === 'synthesizing' || status === 'speaking',
  };
}
