import { describe, expect, it } from 'vitest';
import {
  applyHudsonVoiceBehaviorPreset,
  createHudsonSpokenReply,
  getHudsonVoiceBehaviorPreset,
  getHudsonMessageDisplayText,
} from '@/app/shell/voiceReply';
import type { VoiceSettings } from '@/app/apps/hudson-docs/types';

function makeVoiceSettings(overrides: Partial<VoiceSettings> = {}): VoiceSettings {
  return {
    autoSend: true,
    speakReplies: true,
    replyProvider: 'vox',
    replyModel: 'avspeech:system',
    replyVoice: '',
    replyRate: 1,
    spokenReplyStyle: 'adaptive',
    spokenReplyLongResponse: 'invite',
    spokenReplyCodeResponse: 'summary',
    spokenReplyMaxChars: 720,
    ...overrides,
  };
}

describe('Hudson voice reply helpers', () => {
  it('extracts assistant display text and strips think blocks', () => {
    const text = getHudsonMessageDisplayText({
      parts: [
        { type: 'text', text: '<think>internal</think>Hello there.' },
        { type: 'text', text: ' How are you?' },
        { type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,abc' },
      ],
    });

    expect(text).toBe('Hello there. How are you?');
  });

  it('builds a concise spoken reply from markdown-heavy assistant text', () => {
    const spoken = createHudsonSpokenReply(`
## Plan
- Open the settings panel.
- Pick the voice you want.
- Turn on reply speech.

That will make Hudson speak back after voice turns. You can still read the full written answer in the terminal.
`, 'brief');

    expect(spoken).toBe(
      'Plan Open the settings panel. Pick the voice you want. Turn on reply speech.',
    );
  });

  it('keeps more content in full spoken mode', () => {
    const spoken = createHudsonSpokenReply(
      'Hudson can speak replies after voice turns. It uses the local Vox-backed endpoint for synthesis. You can choose a specific voice in settings. The written reply still stays in the transcript.',
      'full',
    );

    expect(spoken).toBe(
      'Hudson can speak replies after voice turns. It uses the local Vox-backed endpoint for synthesis. You can choose a specific voice in settings. The written reply still stays in the transcript.',
    );
  });

  it('falls back to a word-safe truncation when the text has no punctuation', () => {
    const spoken = createHudsonSpokenReply(
      'This reply keeps going without a period and should stop before it gets too long for comfortable speech playback in the app shell',
      'brief',
    );

    expect(spoken.endsWith('.')).toBe(true);
    expect(spoken.length).toBeLessThanOrEqual(321);
  });

  it('turns long replies into an intro plus invitation when configured', () => {
    const spoken = createHudsonSpokenReply(
      'Hudson finished the workspace audit and found a few follow-up items. The shell settings are available. The voice configuration is valid. The environment has provider credentials. The next step is to review the command surface and decide which actions should stay manual.',
      makeVoiceSettings({
        spokenReplyStyle: 'adaptive',
        spokenReplyLongResponse: 'invite',
        spokenReplyMaxChars: 90,
      }),
    );

    expect(spoken).toContain('The full details are in the written reply.');
    expect(spoken).toContain('We can talk through any part you want.');
  });

  it('summarizes code-heavy replies instead of reading code verbatim by default', () => {
    const spoken = createHudsonSpokenReply(`
I updated the formatter so long replies can become invitations instead of verbatim speech.

\`\`\`ts
export function createHudsonSpokenReply(text: string) {
  return buildSpokenReply(text, policy);
}
\`\`\`

The written reply includes the exact code. I can walk through the implementation if you want.
`, makeVoiceSettings({
      spokenReplyCodeResponse: 'summary',
    }));

    expect(spoken).toContain('I also included code in the written reply.');
    expect(spoken).toContain('I can walk through the implementation if you want.');
    expect(spoken).not.toContain('export function createHudsonSpokenReply');
  });

  it('detects the balanced preset from the default voice settings', () => {
    expect(getHudsonVoiceBehaviorPreset(makeVoiceSettings())).toBe('balanced');
  });

  it('applies the concise preset as a coherent reply behavior bundle', () => {
    const next = applyHudsonVoiceBehaviorPreset(makeVoiceSettings(), 'concise');

    expect(next.spokenReplyStyle).toBe('brief');
    expect(next.spokenReplyLongResponse).toBe('invite');
    expect(next.spokenReplyCodeResponse).toBe('mention');
    expect(next.spokenReplyMaxChars).toBe(360);
  });
});
