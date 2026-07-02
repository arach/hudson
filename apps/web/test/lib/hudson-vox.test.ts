import { describe, expect, it } from 'vitest';
import {
  buildHudsonVoxSpeechResponse,
  parseHudsonVoxNdjson,
  resolveHudsonVoxMimeType,
} from '@/app/lib/tts/voxBridge';

describe('Hudson Vox bridge helpers', () => {
  it('parses Vox streaming session NDJSON envelopes (VOX-002 contract)', () => {
    const chunks = parseHudsonVoxNdjson([
      JSON.stringify({ event: 'session.state', data: { sessionId: 'speech_1', state: 'starting', previous: null } }),
      JSON.stringify({
        event: 'session.audio',
        data: {
          sessionId: 'speech_1',
          sequence: 0,
          modelId: 'avspeech:system',
          voiceId: 'Samantha',
          format: 'wav',
          contentType: 'audio/wav',
          audioBase64: 'AQID',
          audioBytes: 3,
        },
      }),
      JSON.stringify({
        event: 'session.final',
        data: {
          sessionId: 'speech_1',
          modelId: 'avspeech:system',
          voiceId: 'Samantha',
          format: 'wav',
          contentType: 'audio/wav',
          audioBytes: 3,
          elapsedMs: 42,
          metrics: { audioDurationMs: 240 },
        },
      }),
      '',
    ].join('\n'));

    expect(chunks).toHaveLength(3);
    expect(chunks[1]).toMatchObject({
      event: 'session.audio',
      data: { audioBase64: 'AQID', sequence: 0 },
    });
    expect(chunks[2]).toMatchObject({
      event: 'session.final',
      data: { metrics: { audioDurationMs: 240 } },
    });
  });

  it('builds Hudson speech responses from a synthesize.generate result', () => {
    // Phase 1 `synthesize.generate` is wav-only. The result shape comes
    // straight from the JSON-RPC envelope's `result` object.
    const response = buildHudsonVoxSpeechResponse({
      requestId: 'req_123',
      request: {
        text: 'Hello from Hudson',
        provider: 'vox',
        model: 'avspeech:system',
        voice: 'Samantha',
        rate: 1.1,
        format: 'wav',
      },
      result: {
        audioBase64: 'AQID',
        contentType: 'audio/wav',
        format: 'wav',
        modelId: 'avspeech:system',
        voiceId: 'Samantha',
        audioBytes: 3,
        elapsedMs: 42,
        metrics: { audioDurationMs: 240 },
      },
    });

    expect(response).toEqual({
      requestId: 'req_123',
      provider: 'vox',
      model: 'avspeech:system',
      voice: 'Samantha',
      rate: 1.1,
      format: 'wav',
      cached: false,
      audio: {
        base64: 'AQID',
        mimeType: 'audio/wav',
      },
      audioBase64: 'AQID',
      mimeType: 'audio/wav',
      durationMs: 240,
      metadata: {
        backend: 'vox',
        vox: true,
        audioBytes: 3,
        elapsedMs: 42,
      },
    });
  });

  it('maps Vox formats to MIME types', () => {
    expect(resolveHudsonVoxMimeType('aiff')).toBe('audio/aiff');
    expect(resolveHudsonVoxMimeType('wav')).toBe('audio/wav');
    expect(resolveHudsonVoxMimeType('aac')).toBe('audio/aac');
    expect(resolveHudsonVoxMimeType('opus')).toBe('audio/opus');
    expect(resolveHudsonVoxMimeType('mp3')).toBe('audio/mpeg');
  });
});
