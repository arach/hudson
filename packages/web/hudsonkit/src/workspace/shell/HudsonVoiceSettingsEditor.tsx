'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  SettingsSlider,
  SettingsToggle,
  SettingsSegment,
  SettingsSelect,
  ServiceActionButton,
} from '../settings/components';
import type { VoiceSettings } from '../settings/types';
import {
  applyHudsonVoiceBehaviorPreset,
  getHudsonSpokenReplyStyleLabel,
  getHudsonVoiceBehaviorPreset,
  getHudsonVoiceBehaviorPresetLabel,
} from './voiceReply';
import { useWorkspaceHostRoutes } from '../hostRoutes';

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

type HudsonVoiceDeviceOption = {
  id: string;
  name: string;
  isDefault?: boolean;
  isSelected?: boolean;
};

type HudsonVoiceRuntimeStatus = {
  status?: string;
  permissions?: { microphone?: string };
  input?: { selectedDeviceId?: string | null; selectedDeviceName?: string | null };
  model?: {
    selectedModelId?: string | null;
    readiness?: { state?: string; detail?: string };
  };
  troubleshooting?: {
    runtimeAlive?: boolean;
  };
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
    label: 'Hudson Voice',
    available: true,
    defaultModel: 'avspeech:system',
    models: [
      {
        id: 'avspeech:system',
        label: 'Hudson Voice System',
        description: 'Local synthesis through Hudson Voice and the macOS speech backend.',
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

function formatHudsonVoiceStatus(status: HudsonVoiceRuntimeStatus | null): string {
  if (!status) return 'checking';
  if (status.troubleshooting?.runtimeAlive === false) return 'runtime stopped';
  return status.status ?? 'unknown';
}

function formatModelReadiness(status: HudsonVoiceRuntimeStatus | null): string {
  const selected = status?.model?.selectedModelId ?? 'default';
  const readiness = status?.model?.readiness?.state ?? 'placeholder';
  return `${selected} / ${readiness}`;
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
  const routes = useWorkspaceHostRoutes();
  const [voiceProviders, setVoiceProviders] = useState<VoiceProviderOption[]>(DEFAULT_VOICE_PROVIDER_OPTIONS);
  const [voiceModels, setVoiceModels] = useState<VoiceModelOption[]>(
    DEFAULT_VOICE_PROVIDER_OPTIONS[0]?.models ?? [],
  );
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([
    createDefaultVoiceOption(DEFAULT_VOICE_PROVIDER_OPTIONS[0]?.label ?? 'Hudson Voice'),
  ]);
  const [voiceOptionsError, setVoiceOptionsError] = useState<string | null>(null);
  const [voicePreviewStatus, setVoicePreviewStatus] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [voicePreviewError, setVoicePreviewError] = useState<string | null>(null);
  const [inputDevices, setInputDevices] = useState<HudsonVoiceDeviceOption[]>([]);
  const [hudsonVoiceStatus, setHudsonVoiceStatus] = useState<HudsonVoiceRuntimeStatus | null>(null);
  const [hudsonVoiceSettingsError, setHudsonVoiceSettingsError] = useState<string | null>(null);
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

    if (!routes.voices) {
      setVoiceProviders(DEFAULT_VOICE_PROVIDER_OPTIONS);
      setVoiceModels(DEFAULT_VOICE_PROVIDER_OPTIONS[0]?.models ?? []);
      setVoiceOptions([createDefaultVoiceOption(DEFAULT_VOICE_PROVIDER_OPTIONS[0]?.label ?? 'Hudson Voice')]);
      setVoiceOptionsError('Voice catalog is unavailable in this host.');
      return;
    }

    void fetch(`${routes.voices}?${params.toString()}`)
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
          createDefaultVoiceOption(selectedProvider?.label ?? 'Hudson Voice'),
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
        setVoiceOptions([createDefaultVoiceOption(fallbackProvider?.label ?? 'Hudson Voice')]);
        setVoiceOptionsError(error instanceof Error ? error.message : 'Failed to load voices.');
      });

    return () => {
      cancelled = true;
    };
  }, [routes.voices, voiceSettings.replyModel, voiceSettings.replyProvider]);

  const refreshHudsonVoiceStatus = useCallback(async () => {
    if (!routes.voiceApiBase) return;

    try {
      const [devicesResponse, healthResponse] = await Promise.all([
        fetch(`${routes.voiceApiBase}/v1/voice/devices`),
        fetch(`${routes.voiceApiBase}/health`).catch(() => null),
      ]);

      if (devicesResponse.ok) {
        const payload = await devicesResponse.json() as {
          devices?: HudsonVoiceDeviceOption[];
          selectedDeviceId?: string | null;
        };
        const devices = payload.devices ?? [];
        if (
          payload.selectedDeviceId
          && !devices.some(device => device.id === payload.selectedDeviceId)
        ) {
          devices.unshift({
            id: payload.selectedDeviceId,
            name: 'Selected Hudson Voice input',
            isSelected: true,
          });
        }
        setInputDevices(devices);
      }

      if (healthResponse?.ok) {
        setHudsonVoiceStatus(await healthResponse.json() as HudsonVoiceRuntimeStatus);
      } else if (healthResponse) {
        setHudsonVoiceStatus({
          status: 'unavailable',
          troubleshooting: { runtimeAlive: false },
        });
      }
      setHudsonVoiceSettingsError(null);
    } catch (error) {
      setHudsonVoiceSettingsError(error instanceof Error ? error.message : 'Hudson Voice status is unavailable.');
    }
  }, [routes.voiceApiBase]);

  useEffect(() => {
    void refreshHudsonVoiceStatus();
  }, [refreshHudsonVoiceStatus]);

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
    ?? createDefaultVoiceOption(selectedProvider?.label ?? 'Hudson Voice');
  const selectedVoicePreviewText = selectedVoice?.previewText?.trim() || DEFAULT_VOICE_PREVIEW_TEXT;
  const voiceBehaviorPreset = getHudsonVoiceBehaviorPreset(voiceSettings);
  const hudsonVoiceHealthLabel = formatHudsonVoiceStatus(hudsonVoiceStatus);
  const modelReadinessLabel = formatModelReadiness(hudsonVoiceStatus);
  const inputDeviceOptions = [
    { value: '', label: 'Runtime Default' },
    ...inputDevices.map(device => ({
      value: device.id,
      label: device.isDefault ? `${device.name} (Default)` : device.name,
    })),
  ];

  const persistHudsonVoiceSettings = useCallback((patch: Record<string, string | null>) => {
    if (!routes.voiceApiBase) return;
    void fetch(`${routes.voiceApiBase}/v1/voice/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: patch }),
    })
      .then(() => refreshHudsonVoiceStatus())
      .catch(error => {
        setHudsonVoiceSettingsError(error instanceof Error ? error.message : 'Hudson Voice settings did not save.');
      });
  }, [refreshHudsonVoiceStatus, routes.voiceApiBase]);

  const persistInputDevice = useCallback((deviceId: string) => {
    if (!routes.voiceApiBase) return;
    void fetch(`${routes.voiceApiBase}/v1/voice/devices/default`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: deviceId || null }),
    })
      .then(() => refreshHudsonVoiceStatus())
      .catch(error => {
        setHudsonVoiceSettingsError(error instanceof Error ? error.message : 'Hudson Voice input did not save.');
      });
  }, [refreshHudsonVoiceStatus, routes.voiceApiBase]);

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
      if (!routes.speech) {
        throw new Error('Voice preview is unavailable in this host.');
      }
      const response = await fetch(routes.speech, {
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
    routes.speech,
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
      <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-3 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div>
            <div className="uppercase tracking-[0.14em] text-muted-foreground">Engine</div>
            <div className="text-foreground/80">Hudson Voice embedded runtime</div>
          </div>
          <div>
            <div className="uppercase tracking-[0.14em] text-muted-foreground">Status</div>
            <div className="text-foreground/80">{hudsonVoiceHealthLabel}</div>
          </div>
          <div>
            <div className="uppercase tracking-[0.14em] text-muted-foreground">Permission</div>
            <div className="text-foreground/80">{hudsonVoiceStatus?.permissions?.microphone ?? 'unknown'}</div>
          </div>
          <div>
            <div className="uppercase tracking-[0.14em] text-muted-foreground">Model</div>
            <div className="text-foreground/80">{modelReadinessLabel}</div>
          </div>
        </div>
        <SettingsSelect
          label="Input Device"
          value={voiceSettings.inputDeviceId}
          options={inputDeviceOptions}
          onChange={value => {
            onChange({
              ...voiceSettings,
              inputDeviceId: value,
            });
            persistInputDevice(value);
          }}
        />
        <SettingsSelect
          label="Capture Mode"
          value={voiceSettings.captureMode}
          options={[
            { value: 'push_to_talk', label: 'Push to Talk' },
            { value: 'always_on', label: 'Always On' },
          ]}
          onChange={value => {
            const captureMode = value === 'always_on' ? 'always_on' : 'push_to_talk';
            onChange({
              ...voiceSettings,
              captureMode,
            });
            persistHudsonVoiceSettings({ mode: captureMode });
          }}
        />
        <SettingsSelect
          label="Capture Model"
          value={voiceSettings.transcriptionModel}
          options={[
            { value: 'parakeet:v3', label: 'Parakeet v3' },
          ]}
          onChange={value => {
            onChange({
              ...voiceSettings,
              transcriptionModel: value,
            });
            persistHudsonVoiceSettings({ preferredTranscriptionModelId: value });
          }}
        />
        <SettingsSelect
          label="Language"
          value={voiceSettings.transcriptionLanguage}
          options={[
            { value: 'en', label: 'English' },
          ]}
          onChange={value => {
            onChange({
              ...voiceSettings,
              transcriptionLanguage: value,
            });
            persistHudsonVoiceSettings({ preferredLanguage: value });
          }}
        />
        {hudsonVoiceSettingsError && (
          <div className="text-[10px] font-mono text-warning/80">{hudsonVoiceSettingsError}</div>
        )}
      </div>
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
        Voice capture and spoken replies use the voice routes provided by this host.
        Voice previews are available when a speech route is configured.
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
