'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  SettingsSlider,
  SettingsToggle,
  SettingsSegment,
  SettingsSelect,
  ServiceActionButton,
} from '../apps/hudson-docs/components';
import type { VoiceSettings } from '../apps/hudson-docs/types';
import {
  applyHudsonVoiceBehaviorPreset,
  getHudsonSpokenReplyStyleLabel,
  getHudsonVoiceBehaviorPreset,
  getHudsonVoiceBehaviorPresetLabel,
} from './voiceReply';

type VoiceOption = {
  label: string;
  value: string;
  previewText?: string;
};

type VoiceModelOption = {
  id: string;
  label: string;
  description?: string;
};

type VoiceProviderOption = {
  id: VoiceSettings['replyProvider'];
  label: string;
  available: boolean;
  reason?: string;
  defaultModel: string;
  models: VoiceModelOption[];
  supportsVoiceSelection: boolean;
  supportsRate: boolean;
  supportsInstructions: boolean;
};

const DEFAULT_VOICE_PREVIEW_TEXT = 'Hello from Hudson. This is the current reply voice.';
const DEFAULT_VOICE_PROVIDER_OPTIONS: VoiceProviderOption[] = [
  {
    id: 'vox',
    label: 'Vox',
    available: true,
    defaultModel: 'avspeech:system',
    models: [
      {
        id: 'avspeech:system',
        label: 'Vox System',
        description: 'Local synthesis through Vox and the macOS speech backend.',
      },
    ],
    supportsVoiceSelection: true,
    supportsRate: true,
    supportsInstructions: false,
  },
];

function createDefaultVoiceOption(providerLabel: string): VoiceOption {
  return {
    label: `${providerLabel} Default`,
    value: '',
    previewText: DEFAULT_VOICE_PREVIEW_TEXT,
  };
}

function pickReplyPreviewFormat(): 'aac' | 'wav' {
  if (typeof document === 'undefined') return 'wav';
  const audio = document.createElement('audio');
  return audio.canPlayType('audio/mp4; codecs="mp4a.40.2"') ? 'aac' : 'wav';
}

export function HudsonVoiceSettingsEditor({
  voiceSettings,
  onChange,
  intro,
}: {
  voiceSettings: VoiceSettings;
  onChange: (next: VoiceSettings) => void;
  intro?: ReactNode;
}) {
  const [voiceProviders, setVoiceProviders] = useState<VoiceProviderOption[]>(DEFAULT_VOICE_PROVIDER_OPTIONS);
  const [voiceModels, setVoiceModels] = useState<VoiceModelOption[]>(
    DEFAULT_VOICE_PROVIDER_OPTIONS[0]?.models ?? [],
  );
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([
    createDefaultVoiceOption(DEFAULT_VOICE_PROVIDER_OPTIONS[0]?.label ?? 'Vox'),
  ]);
  const [voiceOptionsError, setVoiceOptionsError] = useState<string | null>(null);
  const [voicePreviewStatus, setVoicePreviewStatus] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [voicePreviewError, setVoicePreviewError] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioUrlRef = useRef<string | null>(null);
  const previewRequestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      provider: voiceSettings.replyProvider,
    });

    if (voiceSettings.replyModel) {
      params.set('model', voiceSettings.replyModel);
    }

    void fetch(`/v1/voices?${params.toString()}`)
      .then(async response => {
        if (!response.ok) {
          throw new Error(`Failed to load voices (${response.status}).`);
        }

        const data = await response.json() as {
          providers?: VoiceProviderOption[];
          models?: VoiceModelOption[];
          voices?: Array<{ id: string; label?: string; previewText?: string }>;
        };

        if (cancelled) return;

        const nextProviders = data.providers?.length
          ? data.providers
          : DEFAULT_VOICE_PROVIDER_OPTIONS;
        const selectedProvider = nextProviders.find(provider => provider.id === voiceSettings.replyProvider)
          ?? nextProviders[0]
          ?? DEFAULT_VOICE_PROVIDER_OPTIONS[0];
        const nextModels = data.models?.length
          ? data.models
          : selectedProvider?.models ?? [];
        const rawOptions = [
          createDefaultVoiceOption(selectedProvider?.label ?? 'Vox'),
          ...(data.voices ?? []).map(voice => ({
            label: voice.label ?? voice.id,
            value: voice.id,
            previewText: voice.previewText,
          })),
        ];
        // The default option can collide with an upstream voice id, and some
        // providers occasionally return duplicates. First occurrence wins.
        const seenValues = new Set<string>();
        const nextOptions = rawOptions.filter(option => {
          if (seenValues.has(option.value)) return false;
          seenValues.add(option.value);
          return true;
        });

        setVoiceProviders(nextProviders);
        setVoiceModels(nextModels);
        setVoiceOptions(nextOptions);
        setVoiceOptionsError(null);
      })
      .catch(error => {
        if (cancelled) return;
        const fallbackProvider = DEFAULT_VOICE_PROVIDER_OPTIONS[0];
        setVoiceProviders(DEFAULT_VOICE_PROVIDER_OPTIONS);
        setVoiceModels(fallbackProvider?.models ?? []);
        setVoiceOptions([createDefaultVoiceOption(fallbackProvider?.label ?? 'Vox')]);
        setVoiceOptionsError(error instanceof Error ? error.message : 'Failed to load voices.');
      });

    return () => {
      cancelled = true;
    };
  }, [voiceSettings.replyModel, voiceSettings.replyProvider]);

  const releaseVoicePreview = useCallback((resetState = true) => {
    previewRequestIdRef.current += 1;

    const audio = previewAudioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      previewAudioRef.current = null;
    }

    const objectUrl = previewAudioUrlRef.current;
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      previewAudioUrlRef.current = null;
    }

    if (resetState) {
      setVoicePreviewStatus('idle');
    }
  }, []);

  useEffect(() => () => {
    releaseVoicePreview(false);
  }, [releaseVoicePreview]);

  const selectedProvider = voiceProviders.find(provider => provider.id === voiceSettings.replyProvider)
    ?? voiceProviders[0]
    ?? DEFAULT_VOICE_PROVIDER_OPTIONS[0];
  const selectedModelValue = selectedProvider?.models.some(model => model.id === voiceSettings.replyModel)
    ? voiceSettings.replyModel
    : selectedProvider?.defaultModel ?? 'avspeech:system';
  const selectedVoiceId = voiceSettings.replyVoice;
  const selectedVoice = voiceOptions.find(option => option.value === selectedVoiceId)
    ?? voiceOptions[0]
    ?? createDefaultVoiceOption(selectedProvider?.label ?? 'Vox');
  const selectedVoicePreviewText = selectedVoice?.previewText?.trim() || DEFAULT_VOICE_PREVIEW_TEXT;
  const voiceBehaviorPreset = getHudsonVoiceBehaviorPreset(voiceSettings);

  const handlePreviewVoice = useCallback(async () => {
    if (voicePreviewStatus !== 'idle') {
      releaseVoicePreview();
      return;
    }

    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    setVoicePreviewStatus('loading');
    setVoicePreviewError(null);

    try {
      const response = await fetch('/v1/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: selectedVoicePreviewText,
          provider: voiceSettings.replyProvider,
          model: selectedModelValue,
          voice: selectedVoiceId || undefined,
          rate: voiceSettings.replyRate,
          format: pickReplyPreviewFormat(),
          metadata: {
            surface: 'hudson-voice-editor',
            source: 'voice-preview',
          },
        }),
      });

      const payload = await response.json() as {
        error?: string;
        mimeType?: string;
        audioBase64?: string;
        audio?: { base64?: string; mimeType?: string };
      };

      if (!response.ok) {
        throw new Error(payload.error || `Voice preview failed (${response.status}).`);
      }

      const audioBase64 = payload.audio?.base64 ?? payload.audioBase64;
      const mimeType = payload.audio?.mimeType ?? payload.mimeType ?? 'audio/wav';

      if (!audioBase64) {
        throw new Error('Voice preview returned no audio.');
      }

      if (previewRequestIdRef.current !== requestId) return;

      releaseVoicePreview(false);

      const bytes = Uint8Array.from(atob(audioBase64), char => char.charCodeAt(0));
      const blob = new Blob([bytes], { type: mimeType });
      const objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);

      previewAudioRef.current = audio;
      previewAudioUrlRef.current = objectUrl;

      audio.onended = () => {
        if (previewAudioRef.current === audio) {
          previewAudioRef.current = null;
        }
        if (previewAudioUrlRef.current === objectUrl) {
          URL.revokeObjectURL(objectUrl);
          previewAudioUrlRef.current = null;
        }
        setVoicePreviewStatus('idle');
      };
      audio.onerror = () => {
        if (previewAudioRef.current === audio) {
          previewAudioRef.current = null;
        }
        if (previewAudioUrlRef.current === objectUrl) {
          URL.revokeObjectURL(objectUrl);
          previewAudioUrlRef.current = null;
        }
        setVoicePreviewStatus('idle');
        setVoicePreviewError('Unable to play the voice preview.');
      };

      await audio.play();
      if (previewRequestIdRef.current !== requestId) return;
      setVoicePreviewStatus('playing');
    } catch (error) {
      if (previewRequestIdRef.current !== requestId) return;
      releaseVoicePreview(false);
      setVoicePreviewStatus('idle');
      setVoicePreviewError(error instanceof Error ? error.message : 'Voice preview failed.');
    }
  }, [
    releaseVoicePreview,
    selectedModelValue,
    selectedVoiceId,
    selectedVoicePreviewText,
    voicePreviewStatus,
    voiceSettings.replyProvider,
    voiceSettings.replyRate,
  ]);

  return (
    <div className="space-y-4">
      {intro && (
        <div className="text-[11px] font-mono text-muted-foreground leading-relaxed">
          {intro}
        </div>
      )}
      <SettingsToggle
        label="Auto-send Transcript"
        checked={voiceSettings.autoSend}
        onChange={value => onChange({
          ...voiceSettings,
          autoSend: value,
        })}
      />
      <SettingsSelect
        label="Reply Provider"
        value={voiceSettings.replyProvider}
        options={voiceProviders.map(provider => ({
          value: provider.id,
          label: provider.available ? provider.label : `${provider.label} (Unavailable)`,
        }))}
        onChange={value => {
          const nextProvider = voiceProviders.find(provider => provider.id === value)
            ?? voiceProviders[0]
            ?? DEFAULT_VOICE_PROVIDER_OPTIONS[0];

          onChange({
            ...voiceSettings,
            replyProvider: value as VoiceProviderOption['id'],
            replyModel: nextProvider?.defaultModel ?? 'avspeech:system',
            replyVoice: '',
          });
        }}
      />
      <SettingsSelect
        label="Reply Model"
        value={selectedModelValue}
        options={(voiceModels.length > 0 ? voiceModels : selectedProvider?.models ?? []).map(model => ({
          value: model.id,
          label: model.label,
        }))}
        onChange={value => onChange({
          ...voiceSettings,
          replyModel: value,
          replyVoice: '',
        })}
      />
      <SettingsToggle
        label="Speak Assistant Replies"
        checked={voiceSettings.speakReplies}
        onChange={value => onChange({
          ...voiceSettings,
          speakReplies: value,
        })}
      />
      <SettingsSegment
        label="Reply Behavior"
        value={voiceBehaviorPreset}
        options={[
          { value: 'concise', label: 'Concise' },
          { value: 'balanced', label: 'Balanced' },
          { value: 'detailed', label: 'Detailed' },
          { value: 'custom', label: 'Custom' },
        ]}
        onChange={value => {
          if (value === 'custom') return;
          onChange(applyHudsonVoiceBehaviorPreset(voiceSettings, value));
        }}
      />
      <div className="text-[10px] font-mono text-muted-foreground leading-relaxed">
        Concise keeps spoken replies tight. Balanced gives a fuller spoken summary. Detailed reads more before falling back to summary rules. Use Custom only when you want to override the preset below.
      </div>
      <SettingsSelect
        label="Reply Voice"
        value={voiceSettings.replyVoice}
        options={voiceOptions}
        onChange={value => onChange({
          ...voiceSettings,
          replyVoice: value,
        })}
      />
      <div className="ml-[156px] space-y-2">
        <div className="flex items-center gap-2">
          <ServiceActionButton
            label={voicePreviewStatus === 'playing' ? 'Stop Preview' : 'Preview Voice'}
            variant="secondary"
            loading={voicePreviewStatus === 'loading'}
            onClick={() => {
              void handlePreviewVoice();
            }}
          />
          <div className="text-[10px] font-mono text-muted-foreground leading-relaxed">
            {selectedVoicePreviewText}
          </div>
        </div>
        {voicePreviewError && (
          <div className="text-[10px] font-mono text-destructive/80">
            {voicePreviewError}
          </div>
        )}
      </div>
      <details className="rounded-lg border border-border/60 bg-muted/40">
        <summary className="cursor-pointer list-none px-3 py-2 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          Advanced Reply Behavior
        </summary>
        <div className="space-y-4 border-t border-border/60 px-3 py-3">
          <div className="text-[10px] font-mono text-muted-foreground leading-relaxed">
            Current profile: <span className="text-foreground/80">{getHudsonVoiceBehaviorPresetLabel(voiceBehaviorPreset)}</span>. Spoken detail is <span className="text-foreground/80">{getHudsonSpokenReplyStyleLabel(voiceSettings.spokenReplyStyle)}</span>.
          </div>
          <SettingsSegment
            label="Reply Readout"
            value={voiceSettings.spokenReplyStyle}
            options={[
              { value: 'brief', label: 'Concise' },
              { value: 'adaptive', label: 'Balanced' },
              { value: 'full', label: 'Detailed' },
            ]}
            onChange={value => onChange({
              ...voiceSettings,
              spokenReplyStyle: value as typeof voiceSettings.spokenReplyStyle,
            })}
          />
          <SettingsSlider
            label="Long Threshold"
            value={voiceSettings.spokenReplyMaxChars}
            min={240}
            max={1400}
            step={20}
            format={value => `${Math.round(value)} chars`}
            onChange={value => onChange({
              ...voiceSettings,
              spokenReplyMaxChars: value,
            })}
          />
          <SettingsSegment
            label="Long Replies"
            value={voiceSettings.spokenReplyLongResponse}
            options={[
              { value: 'summary', label: 'Summarize' },
              { value: 'invite', label: 'Invite Me In' },
              { value: 'verbatim', label: 'Keep Reading' },
            ]}
            onChange={value => onChange({
              ...voiceSettings,
              spokenReplyLongResponse: value as typeof voiceSettings.spokenReplyLongResponse,
            })}
          />
          <SettingsSegment
            label="Code Replies"
            value={voiceSettings.spokenReplyCodeResponse}
            options={[
              { value: 'summary', label: 'Explain' },
              { value: 'mention', label: 'Mention Code' },
              { value: 'read', label: 'Read Code' },
            ]}
            onChange={value => onChange({
              ...voiceSettings,
              spokenReplyCodeResponse: value as typeof voiceSettings.spokenReplyCodeResponse,
            })}
          />
        </div>
      </details>
      <details className="rounded-lg border border-border/60 bg-muted/40">
        <summary className="cursor-pointer list-none px-3 py-2 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          Speech Engine
        </summary>
        <div className="space-y-4 border-t border-border/60 px-3 py-3">
          <SettingsSlider
            label="Reply Speed"
            value={voiceSettings.replyRate}
            min={0.7}
            max={1.3}
            step={0.05}
            format={value => `${value.toFixed(2)}x`}
            onChange={value => onChange({
              ...voiceSettings,
              replyRate: value,
            })}
          />
          {!selectedProvider?.supportsRate && (
            <div className="text-[10px] font-mono text-muted-foreground">
              {selectedProvider?.label} currently ignores Hudson&apos;s reply speed control.
            </div>
          )}
          {selectedProvider?.models.find(model => model.id === selectedModelValue)?.description && (
            <div className="text-[10px] font-mono text-muted-foreground">
              {selectedProvider.models.find(model => model.id === selectedModelValue)?.description}
            </div>
          )}
        </div>
      </details>
      <div className="text-[11px] font-mono text-muted-foreground leading-relaxed">
        Voice capture uses Hudson Menu&apos;s embedded Vox daemon through <span className="text-foreground/80">/api/hudson-voice</span>.
        Spoken replies use Hudson&apos;s local Vox-backed endpoint on <span className="text-foreground/80">/v1/audio/speech</span>,
        with voices and models populated from <span className="text-foreground/80">/v1/voices</span>.
        Hudson owns microphone permission and daemon lifecycle; standalone Vox.app is not required.
      </div>
      {!selectedProvider?.available && selectedProvider?.reason && (
        <div className="text-[10px] font-mono text-warning/80">
          {selectedProvider.reason}
        </div>
      )}
      {voiceOptionsError && (
        <div className="text-[10px] font-mono text-warning/80">
          Reply voices are unavailable right now: {voiceOptionsError}
        </div>
      )}
    </div>
  );
}
