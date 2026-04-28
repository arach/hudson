'use client';

import { useCallback, useRef } from 'react';
import { useVoiceInput } from './useVoiceInput';
import { useVoiceOutput } from './useVoiceOutput';
import { createHudsonSpokenReply, getHudsonMessageDisplayText } from '../lib/voiceReply';
import { DEFAULT_VOICE_SETTINGS, type VoiceSettings } from '../types/voice';
import type { AssistantVoiceKit } from '../types/voice-kit';
import type { UIMessage } from 'ai';

// ---------------------------------------------------------------------------
// useAssistantVoice — returns an AssistantVoiceKit for the <Assistant> component.
//
// Usage:
//   import { useAssistantVoice } from '@hudsonos/sdk/voice';
//   const voiceKit = useAssistantVoice({ appId: 'my-app' });
//   <Assistant app={app} commands={commands} voiceKit={voiceKit} />
// ---------------------------------------------------------------------------

export interface UseAssistantVoiceOptions {
  /** App ID for metadata tagging. */
  appId: string;
  /** Voice settings overrides. */
  settings?: Partial<VoiceSettings>;
}

export function useAssistantVoice(options: UseAssistantVoiceOptions): AssistantVoiceKit {
  const { appId, settings: settingsOverride } = options;

  const voiceSettings: VoiceSettings = {
    ...DEFAULT_VOICE_SETTINGS,
    ...settingsOverride,
  };

  // Keep a mutable ref to the latest transcript callback so the hook
  // doesn't need to be re-created on every render.
  const transcriptCallbackRef = useRef<((transcript: string) => void) | null>(null);

  const voiceInput = useVoiceInput({
    surface: 'hudson-assistant',
    metadata: { appId },
    onTranscript: (transcript) => {
      transcriptCallbackRef.current?.(transcript);
    },
  });

  const voiceOutput = useVoiceOutput();

  const inputAdapter: AssistantVoiceKit['input'] = {
    status: voiceInput.status,
    error: voiceInput.error,
    isSupported: voiceInput.isSupported,
    start: useCallback(async (onTranscript: (transcript: string) => void) => {
      transcriptCallbackRef.current = onTranscript;
      await voiceInput.start();
    }, [voiceInput]),
    stop: voiceInput.stop,
  };

  const outputAdapter: AssistantVoiceKit['output'] = {
    status: voiceOutput.status,
    error: voiceOutput.error,
    isPlaying: voiceOutput.isPlaying,
    speak: voiceOutput.speak,
    stop: voiceOutput.stop,
  };

  const speakReply = useCallback((message: Pick<UIMessage, 'parts'>, metadata?: Record<string, unknown>) => {
    const display = getHudsonMessageDisplayText(message);
    const spoken = createHudsonSpokenReply(display, voiceSettings);
    if (!spoken) return;
    void voiceOutput.speak(spoken, {
      provider: voiceSettings.replyProvider,
      model: voiceSettings.replyModel,
      voice: voiceSettings.replyVoice || undefined,
      rate: voiceSettings.replyRate,
      metadata: { surface: 'hudson-assistant', appId, ...metadata },
    });
  }, [voiceOutput, voiceSettings, appId]);

  return {
    input: inputAdapter,
    output: outputAdapter,
    settings: {
      autoSend: voiceSettings.autoSend,
      speakReplies: voiceSettings.speakReplies,
    },
    speakReply,
  };
}
