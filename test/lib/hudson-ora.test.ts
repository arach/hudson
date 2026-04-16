import { describe, expect, it } from 'vitest';
import {
  buildHudsonOraSynthesisResponse,
  createHudsonOraCacheKey,
  parseHudsonAfinfoDuration,
  parseHudsonSayVoices,
  rateToHudsonSayWordsPerMinute,
  resolveHudsonOraMimeType,
  toHudsonOraVoice,
} from '@/app/lib/tts/ora-compat';

describe('Hudson ORA compatibility helpers', () => {
  it('parses macOS say voices into Ora-compatible metadata', () => {
    const parsed = parseHudsonSayVoices([
      'Agnes                en_US    # Isn\'t it nice to have a computer that will talk to you?',
      'Amelie               fr_CA    # Bonjour, je m\'appelle Amelie.',
    ].join('\n'));

    expect(parsed).toEqual([
      {
        id: 'Agnes',
        locale: 'en_US',
        sample: 'Isn\'t it nice to have a computer that will talk to you?',
      },
      {
        id: 'Amelie',
        locale: 'fr_CA',
        sample: 'Bonjour, je m\'appelle Amelie.',
      },
    ]);

    expect(toHudsonOraVoice(parsed[0]!)).toEqual({
      id: 'Agnes',
      label: 'Agnes (en-US)',
      provider: 'system',
      locale: 'en-US',
      previewText: 'Isn\'t it nice to have a computer that will talk to you?',
      metadata: {
        sample: 'Isn\'t it nice to have a computer that will talk to you?',
      },
    });
  });

  it('creates stable cache keys for equivalent synthesis requests', () => {
    const base = createHudsonOraCacheKey({
      text: 'Hello Hudson',
      voice: 'Samantha',
      rate: 1,
      format: 'aiff',
    });
    const same = createHudsonOraCacheKey({
      text: 'Hello Hudson',
      voice: 'Samantha',
      rate: 1,
      format: 'aiff',
    });
    const different = createHudsonOraCacheKey({
      text: 'Hello Hudson',
      voice: 'Agnes',
      rate: 1,
      format: 'aiff',
    });

    expect(base).toBe(same);
    expect(base).not.toBe(different);
  });

  it('builds buffered speech responses with inline base64 audio', () => {
    const response = buildHudsonOraSynthesisResponse({
      request: {
        text: 'Hello from Hudson',
        voice: 'Samantha',
        rate: 1.1,
        format: 'wav',
      },
      requestId: 'req_123',
      voice: 'Samantha',
      audioData: new Uint8Array([1, 2, 3]),
      durationMs: 240,
      format: 'aiff',
      mimeType: 'audio/aiff',
      metadata: {
        backend: 'system',
      },
    });

    expect(response).toEqual({
      requestId: 'req_123',
      cacheKey: createHudsonOraCacheKey({
        text: 'Hello from Hudson',
        voice: 'Samantha',
        rate: 1.1,
        format: 'wav',
      }),
      voice: 'Samantha',
      rate: 1.1,
      format: 'aiff',
      cached: false,
      audio: {
        base64: 'AQID',
        mimeType: 'audio/aiff',
      },
      audioBase64: 'AQID',
      mimeType: 'audio/aiff',
      durationMs: 240,
      metadata: {
        backend: 'system',
      },
    });
  });

  it('parses afinfo durations and clamps requested speech rates', () => {
    expect(parseHudsonAfinfoDuration('estimated duration: 1.234567 sec')).toBe(1235);
    expect(rateToHudsonSayWordsPerMinute(undefined)).toBeNull();
    expect(rateToHudsonSayWordsPerMinute(0.5)).toBe(88);
    expect(rateToHudsonSayWordsPerMinute(5)).toBe(360);
  });

  it('maps Ora formats to MIME types', () => {
    expect(resolveHudsonOraMimeType('aiff')).toBe('audio/aiff');
    expect(resolveHudsonOraMimeType('wav')).toBe('audio/wav');
    expect(resolveHudsonOraMimeType('aac')).toBe('audio/aac');
    expect(resolveHudsonOraMimeType('opus')).toBe('audio/opus');
    expect(resolveHudsonOraMimeType('mp3')).toBe('audio/mpeg');
  });
});
