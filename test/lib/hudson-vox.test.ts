import { describe, expect, it } from 'vitest';
import {
  buildHudsonVoxSpeechResponse,
  parseHudsonVoxNdjson,
  resolveHudsonVoxMimeType,
} from '@/app/lib/tts/voxBridge';

describe('Hudson Vox bridge helpers', () => {
  it('parses Vox streaming synthesis chunks', () => {
    const chunks = parseHudsonVoxNdjson([
      JSON.stringify({ type: 'started', sessionId: 'session_1' }),
      JSON.stringify({
        type: 'complete',
        result: {
          audioBase64: 'AQID',
          contentType: 'audio/aac',
          format: 'aac',
          modelId: 'avspeech:system',
          voiceId: 'Samantha',
          audioBytes: 3,
          elapsedMs: 42,
          metrics: { audioDurationMs: 240 },
        },
      }),
      '',
    ].join('\n'));

    expect(chunks).toHaveLength(2);
    expect(chunks[1]).toMatchObject({
      type: 'complete',
      result: {
        audioBase64: 'AQID',
        modelId: 'avspeech:system',
      },
    });
  });

  it('builds Hudson speech responses from Vox synthesis results', () => {
    const response = buildHudsonVoxSpeechResponse({
      requestId: 'req_123',
      request: {
        text: 'Hello from Hudson',
        provider: 'vox',
        model: 'avspeech:system',
        voice: 'Samantha',
        rate: 1.1,
        format: 'aac',
      },
      result: {
        audioBase64: 'AQID',
        contentType: 'audio/aac',
        format: 'aac',
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
      format: 'aac',
      cached: false,
      audio: {
        base64: 'AQID',
        mimeType: 'audio/aac',
      },
      audioBase64: 'AQID',
      mimeType: 'audio/aac',
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
