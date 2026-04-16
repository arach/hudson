import { describe, expect, it } from 'vitest';
import {
  createHudsonSpokenReply,
  getHudsonMessageDisplayText,
} from '@/app/shell/voiceReply';

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
      'Plan Open the settings panel. Pick the voice you want.',
    );
  });

  it('keeps more content in full spoken mode', () => {
    const spoken = createHudsonSpokenReply(
      'Hudson can speak replies after voice turns. It uses the local ORA-compatible endpoint for synthesis. You can choose a specific voice in settings. The written reply still stays in the transcript.',
      'full',
    );

    expect(spoken).toBe(
      'Hudson can speak replies after voice turns. It uses the local ORA-compatible endpoint for synthesis. You can choose a specific voice in settings. The written reply still stays in the transcript.',
    );
  });

  it('falls back to a word-safe truncation when the text has no punctuation', () => {
    const spoken = createHudsonSpokenReply(
      'This reply keeps going without a period and should stop before it gets too long for comfortable speech playback in the app shell',
      'brief',
    );

    expect(spoken.endsWith('.')).toBe(true);
    expect(spoken.length).toBeLessThanOrEqual(221);
  });
});
