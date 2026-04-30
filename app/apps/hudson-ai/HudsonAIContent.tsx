'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  AppWindow,
  ArrowRight,
  AudioLines,
  Bot,
  Link2,
  Mic,
  Play,
  Radio,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  TerminalSquare,
  Volume2,
  Wand2,
  Workflow,
  Wrench,
} from 'lucide-react';
import type { VoiceSettings } from '../hudson-docs/types';
import { useHudsonAIRuntime } from '../../shell/HudsonAIRuntimeContext';
import { useWorkspaceManager } from '../../shell/workspace-manager/WorkspaceManagerContext';
import { HudsonVoiceSettingsEditor } from '../../shell/HudsonVoiceSettingsEditor';
import { HudsonEnvironmentEditor } from '../../shell/HudsonEnvironmentEditor';
import {
  getHudsonSpokenReplyStyleLabel,
  getHudsonVoiceBehaviorPreset,
  getHudsonVoiceBehaviorPresetLabel,
} from '../../shell/voiceReply';
import { useHudsonAIApp } from './HudsonAIProvider';
import { HUDSON_AI_ACTIONS } from './catalog';

type InspectorView = 'overview' | 'settings' | 'construction' | 'prompts';

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/30">
      {children}
    </div>
  );
}

function ScopeBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.12em] text-cyan-300/80">
      {label}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3">
      <div className="text-[10px] font-mono text-white/25">{label}</div>
      <div className="mt-1 text-[16px] text-white/80">{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-[10px] font-mono text-white/25">{label}</span>
      <span className="text-[11px] text-right text-white/65">{value}</span>
    </div>
  );
}

function SurfaceTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] transition-colors ${
        active
          ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300'
          : 'border-white/[0.08] text-white/40 hover:border-cyan-500/20 hover:text-cyan-300'
      }`}
    >
      {label}
    </button>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  variant = 'secondary',
}: {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: 'secondary' | 'primary';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-mono transition-colors ${
        variant === 'primary'
          ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/15'
          : 'border-white/[0.08] text-white/55 hover:border-cyan-500/20 hover:text-cyan-300'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CapabilityRow({
  icon,
  label,
  description,
}: {
  icon: ReactNode;
  label: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3">
      <div className="flex items-center gap-2 text-[11px] font-medium text-white/75">
        <span className="text-cyan-300/75">{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-[10px] leading-relaxed text-white/35">{description}</div>
    </div>
  );
}

function ConstructionNode({
  label,
  description,
  meta,
}: {
  label: string;
  description: string;
  meta: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-cyan-300/70">
        {label}
      </div>
      <div className="mt-2 text-[11px] leading-relaxed text-white/70">{description}</div>
      <div className="mt-2 text-[10px] font-mono text-white/30">{meta}</div>
    </div>
  );
}

function SettingSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/28">
        {label}
      </div>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[11px] text-white/75 focus:border-cyan-500/25 focus:outline-none"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatProviderLabel(provider: VoiceSettings['replyProvider']) {
  if (provider === 'vox') return 'Vox';
  return provider;
}

function describeCaptureMode(settings: VoiceSettings) {
  return settings.autoSend ? 'Immediate send' : 'Draft first';
}

function describeLongReplyHandling(settings: VoiceSettings) {
  switch (settings.spokenReplyLongResponse) {
    case 'summary':
      return `Summarize after ${settings.spokenReplyMaxChars} chars`;
    case 'verbatim':
      return `Keep reading after ${settings.spokenReplyMaxChars} chars`;
    case 'invite':
    default:
      return `Invite discussion after ${settings.spokenReplyMaxChars} chars`;
  }
}

function describeCodeReplyHandling(settings: VoiceSettings) {
  switch (settings.spokenReplyCodeResponse) {
    case 'mention':
      return 'Mention code, do not read it aloud';
    case 'read':
      return 'Read code-heavy replies normally';
    case 'summary':
    default:
      return 'Explain the gist, keep code in text';
  }
}

function describeNextTurnBehavior(settings: VoiceSettings) {
  if (settings.autoSend && settings.speakReplies) {
    return 'Your next utterance will send immediately, then Hudson will speak the reply using the current behavior profile.';
  }
  if (settings.autoSend) {
    return 'Your next utterance will send immediately, but the reply will stay text-only.';
  }
  if (settings.speakReplies) {
    return 'Your next utterance will land as a draft first. Once you send it, Hudson will speak the reply.';
  }
  return 'Your next utterance will land as a draft first and stay text-only until you send it.';
}

function getFieldOptions(
  sections: Array<{
    fields: Array<{ key: string; options?: Array<{ value: string; label: string }> }>;
  }>,
  key: string,
) {
  return sections.flatMap(section => section.fields).find(field => field.key === key)?.options ?? [];
}

function getOptionLabel(
  value: string,
  options: Array<{ value: string; label: string }>,
) {
  return options.find(option => option.value === value)?.label ?? value;
}

export function HudsonAIContent() {
  const {
    toolContext,
    voiceSettings,
    queueConsolePrompt,
    openWorkspaceSettings,
  } = useHudsonAIRuntime();
  const { shellSettings, onUpdateShellSettings } = useWorkspaceManager();
  const {
    globalSettings,
    updateGlobalSettings,
    resetGlobalSettings,
    workspaceOverrideSettings,
    hasWorkspaceOverride,
    enableWorkspaceOverride,
    updateWorkspaceOverride,
    clearWorkspaceOverride,
    settingsConfig,
    resolvedModel,
    resolvedProvider,
    promptPresets,
    settingsSource,
  } = useHudsonAIApp();
  const [activeView, setActiveView] = useState<InspectorView>('overview');
  const shellVoiceSettings = shellSettings.voice ?? voiceSettings;

  const focusedApp = toolContext.apps.find(app => app.focused) ?? null;
  const voiceMode = voiceSettings.speakReplies ? 'Bidirectional' : 'Capture only';
  const behaviorPreset = getHudsonVoiceBehaviorPreset(voiceSettings);
  const providerOptions = getFieldOptions(settingsConfig.sections, 'provider');
  const modelOptions = getFieldOptions(settingsConfig.sections, 'model');
  const resolvedProviderLabel = getOptionLabel(resolvedProvider, providerOptions);
  const resolvedModelLabel = getOptionLabel(resolvedModel, modelOptions);
  const voiceProviderLabel = formatProviderLabel(voiceSettings.replyProvider);
  const globalProviderLabel = getOptionLabel(String(globalSettings.provider || 'copilot'), providerOptions);
  const globalModelLabel = getOptionLabel(String(globalSettings.model || 'gemini-3-flash-preview'), modelOptions);
  const workspaceProviderValue = String(workspaceOverrideSettings.provider || resolvedProvider);
  const workspaceModelValue = String(workspaceOverrideSettings.model || resolvedModel);
  const workspaceProviderLabel = getOptionLabel(workspaceProviderValue, providerOptions);
  const workspaceModelLabel = getOptionLabel(workspaceModelValue, modelOptions);

  const [requestedAppId, setRequestedAppId] = useState<string | null>(
    focusedApp?.id ?? toolContext.apps[0]?.id ?? null,
  );
  const [requestedIntentId, setRequestedIntentId] = useState<string | null>(null);

  const selectedAppId = toolContext.apps.some(app => app.id === requestedAppId)
    ? requestedAppId
    : (focusedApp?.id ?? toolContext.apps[0]?.id ?? null);

  const selectedApp = useMemo(
    () => toolContext.apps.find(app => app.id === selectedAppId) ?? null,
    [selectedAppId, toolContext.apps],
  );

  const selectedAppIntents = useMemo(
    () => toolContext.intents.filter(intent => intent.appId === selectedAppId),
    [selectedAppId, toolContext.intents],
  );

  const selectedAppCommands = useMemo(
    () => toolContext.commands.filter(command => command.appId === selectedAppId),
    [selectedAppId, toolContext.commands],
  );

  const selectedAppSettings = useMemo(
    () => toolContext.appSettings.find(entry => entry.appId === selectedAppId) ?? null,
    [selectedAppId, toolContext.appSettings],
  );

  const selectedAppServices = useMemo(
    () => toolContext.services.filter(service =>
      selectedApp?.services.some(dependency => dependency.serviceId === service.id) ?? false),
    [selectedApp, toolContext.services],
  );

  const selectedAppPipes = useMemo(
    () => toolContext.pipes.filter(pipe =>
      pipe.source.appId === selectedAppId || pipe.sink.appId === selectedAppId),
    [selectedAppId, toolContext.pipes],
  );

  const selectedIntentId = selectedAppIntents.some(intent => intent.commandId === requestedIntentId)
    ? requestedIntentId
    : (selectedAppIntents[0]?.commandId ?? null);

  const selectedIntent = selectedAppIntents.find(intent => intent.commandId === selectedIntentId) ?? null;
  const selectedCommand = (selectedIntent
    ? selectedAppCommands.find(command => command.id === selectedIntent.commandId)
    : selectedAppCommands[0]) ?? null;

  const settingsFieldCount = selectedAppSettings?.sections.reduce(
    (sum, section) => sum + section.fields.length,
    0,
  ) ?? 0;
  const inputCount = selectedApp?.ports?.inputs?.length ?? 0;
  const outputCount = selectedApp?.ports?.outputs?.length ?? 0;

  return (
    <div className="h-full min-h-0 overflow-y-auto frame-scrollbar p-4 space-y-4">
      <div className="rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/[0.12] via-white/[0.03] to-transparent p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
            <Sparkles size={18} />
          </div>
          <div className="min-w-0 space-y-2">
            <div className="text-[13px] font-medium text-white/85">Hudson AI Control Surface</div>
            <div className="text-[11px] leading-relaxed text-white/45">
              Use Console AI to act. Use this app to inspect what Hudson AI can see, manage Hudson defaults, and override them for the current workspace when needed.
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-white/35">
              <span className="rounded-full border border-white/[0.08] px-2 py-1">
                AI provider: {resolvedProviderLabel}
              </span>
              <span className="rounded-full border border-white/[0.08] px-2 py-1">
                AI model: {resolvedModelLabel}
              </span>
              <span className="rounded-full border border-white/[0.08] px-2 py-1">
                voice provider: {voiceProviderLabel}
              </span>
              <span className="rounded-full border border-white/[0.08] px-2 py-1">
                config source: {settingsSource}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <SurfaceTabButton
          active={activeView === 'overview'}
          label="Overview"
          onClick={() => setActiveView('overview')}
        />
        <SurfaceTabButton
          active={activeView === 'settings'}
          label="Settings"
          onClick={() => setActiveView('settings')}
        />
        <SurfaceTabButton
          active={activeView === 'construction'}
          label="Construction"
          onClick={() => setActiveView('construction')}
        />
        <SurfaceTabButton
          active={activeView === 'prompts'}
          label="Prompt Library"
          onClick={() => setActiveView('prompts')}
        />
      </div>

      {activeView === 'overview' && (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
              <SectionTitle>Runtime Configuration</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="AI Provider" value={resolvedProviderLabel} />
                <StatCard label="AI Model" value={resolvedModelLabel} />
                <StatCard label="Voice Provider" value={voiceProviderLabel} />
                <StatCard label="Config Source" value={settingsSource} />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {HUDSON_AI_ACTIONS.map(action => (
                  <CapabilityRow
                    key={action.id}
                    icon={<Wrench size={12} />}
                    label={action.label}
                    description={action.description}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
              <SectionTitle>Settings Scope</SectionTitle>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[12px] font-medium text-white/78">Hudson Preferences</div>
                    <ScopeBadge label="Global Shell" />
                  </div>
                  <div className="text-[10px] leading-relaxed text-white/35">
                    Voice capture, speak-back, reply behavior, and environment credentials live at the shell level. They affect Hudson globally, not only the Hudson AI app.
                  </div>
                  <div className="space-y-1 text-[10px] leading-relaxed text-white/45">
                    <div>Voice provider: {voiceProviderLabel}</div>
                    <div>Voice model: {voiceSettings.replyModel || 'Default'}</div>
                    <div>Reply behavior: {getHudsonVoiceBehaviorPresetLabel(behaviorPreset)}</div>
                  </div>
                  <ActionButton
                    label="Edit Here"
                    icon={<Settings2 size={11} />}
                    onClick={() => setActiveView('settings')}
                    variant="primary"
                  />
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[12px] font-medium text-white/78">Hudson AI Resolution</div>
                    <ScopeBadge label={hasWorkspaceOverride ? 'Workspace Override' : 'Hudson Default'} />
                  </div>
                  <div className="text-[10px] leading-relaxed text-white/35">
                    Hudson sets the default AI provider and model once. The current workspace can override that runtime when it needs a different pair.
                  </div>
                  <div className="space-y-1 text-[10px] leading-relaxed text-white/45">
                    <div>Hudson default: {globalProviderLabel} / {globalModelLabel}</div>
                    <div>Current workspace: {workspaceProviderLabel} / {workspaceModelLabel}</div>
                    <div>Source: {settingsSource}</div>
                  </div>
                  <ActionButton
                    label="Manage AI Settings"
                    icon={<SlidersHorizontal size={11} />}
                    onClick={() => setActiveView('settings')}
                    variant="primary"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
              <SectionTitle>Runtime Snapshot</SectionTitle>
              <div className="space-y-2">
                <CapabilityRow
                  icon={<AppWindow size={12} />}
                  label="Focused App"
                  description={focusedApp ? focusedApp.name : 'No app is focused right now.'}
                />
                <CapabilityRow
                  icon={<TerminalSquare size={12} />}
                  label="Command Surface"
                  description="Console AI can reach live shell, app, and service actions exposed by the current workspace."
                />
                <CapabilityRow
                  icon={<Workflow size={12} />}
                  label="Intent Catalog"
                  description="Intent metadata stays available for shell and workspace apps when you want to inspect or route structured actions."
                />
                <CapabilityRow
                  icon={<Link2 size={12} />}
                  label="Environment"
                  description={toolContext.environment.manageable
                    ? `Hudson can manage local environment values at ${toolContext.environment.path}.`
                    : 'The environment surface is unavailable in this workspace.'}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
              <SectionTitle>Voice Workflow</SectionTitle>
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] leading-relaxed text-white/42">
                  These are global Hudson preferences. They shape the voice loop for Hudson overall, not only this app.
                </div>
                <ScopeBadge label="Global Shell" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Capture" value={describeCaptureMode(voiceSettings)} />
                <StatCard label="Speak Back" value={voiceSettings.speakReplies ? 'On' : 'Off'} />
              </div>
              <div className="divide-y divide-white/[0.05]">
                <DetailRow
                  label="Reply Behavior"
                  value={getHudsonVoiceBehaviorPresetLabel(behaviorPreset)}
                />
                <DetailRow
                  label="Spoken Detail"
                  value={getHudsonSpokenReplyStyleLabel(voiceSettings.spokenReplyStyle)}
                />
                <DetailRow
                  label="Long Replies"
                  value={describeLongReplyHandling(voiceSettings)}
                />
                <DetailRow
                  label="Code Replies"
                  value={describeCodeReplyHandling(voiceSettings)}
                />
                <DetailRow
                  label="Voice Provider"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Radio size={11} className="text-cyan-300/70" />
                      {voiceProviderLabel} / {voiceSettings.replyModel || 'default'}
                    </span>
                  }
                />
                <DetailRow
                  label="Reply Voice"
                  value={voiceSettings.replyVoice || 'Default voice'}
                />
                <DetailRow
                  label="Reply Speed"
                  value={`${voiceSettings.replyRate.toFixed(2)}x`}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  label="Edit Voice Workflow"
                  icon={<Settings2 size={11} />}
                  onClick={() => setActiveView('settings')}
                  variant="primary"
                />
                <ActionButton
                  label="Open Full Hudson Settings"
                  icon={<Settings2 size={11} />}
                  onClick={() => openWorkspaceSettings('settings')}
                />
              </div>
              <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.07] px-3 py-3">
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.14em] text-cyan-300/80">
                  <Volume2 size={11} />
                  Next Turn
                </div>
                <div className="mt-2 text-[11px] leading-relaxed text-white/65">
                  {describeNextTurnBehavior(voiceSettings)}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
              <SectionTitle>Voice Loop Notes</SectionTitle>
              <div className="space-y-2">
                <CapabilityRow
                  icon={<Mic size={12} />}
                  label="Transcription Path"
                  description="Capture still runs through the local Vox companion. Hudson only needs the origin allowlisted in Vox when the bridge is locked down."
                />
                <CapabilityRow
                  icon={<AudioLines size={12} />}
                  label="Spoken Replies"
                  description="Reply audio runs through Hudson’s local Vox-backed speech endpoint, with voices and models populated from Vox."
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === 'settings' && (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <SectionTitle>Voice Workflow</SectionTitle>
                <ScopeBadge label="Global Shell" />
              </div>
              <div className="text-[11px] leading-relaxed text-white/45">
                These settings belong to Hudson globally. Voice capture, speak-back, and reply behavior are shared shell preferences, and changes here apply immediately.
              </div>
              <HudsonVoiceSettingsEditor
                voiceSettings={shellVoiceSettings}
                onChange={next => onUpdateShellSettings({ voice: next })}
                intro="These are the live Hudson-wide voice settings. Changes here affect the global voice loop immediately, including voice mode outside this app."
              />
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <SectionTitle>Environment Credentials</SectionTitle>
                <ScopeBadge label="Global Shell" />
              </div>
              <div className="text-[11px] leading-relaxed text-white/45">
                Provider credentials also live at the Hudson level. Edit them here when you want this workspace to access OpenAI, ElevenLabs, Groq, or other local integrations.
              </div>
              <HudsonEnvironmentEditor
                intro="These values are stored in Hudson’s local environment file for this repo. They stay out of git and back the shell-wide AI and voice integrations."
              />
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  label="Open Full Hudson Settings"
                  icon={<Settings2 size={11} />}
                  onClick={() => openWorkspaceSettings('settings')}
                />
                <ActionButton
                  label="Open Full Environment"
                  icon={<Link2 size={11} />}
                  onClick={() => openWorkspaceSettings('environment')}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <SectionTitle>Hudson Default</SectionTitle>
                <ScopeBadge label="Global Hudson" />
              </div>
              <div className="text-[11px] leading-relaxed text-white/45">
                This is the default Hudson AI runtime for every workspace. If a workspace does nothing, it inherits this definition.
              </div>
              <div className="grid gap-3">
                <SettingSelect
                  label="AI Provider"
                  value={String(globalSettings.provider || 'copilot')}
                  options={providerOptions}
                  onChange={value => updateGlobalSettings({ provider: value })}
                />
                <SettingSelect
                  label="AI Model"
                  value={String(globalSettings.model || 'gemini-3-flash-preview')}
                  options={modelOptions}
                  onChange={value => updateGlobalSettings({ model: value })}
                />
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3">
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/28">
                  Default Runtime
                </div>
                <div className="mt-2 space-y-1 text-[11px] leading-relaxed text-white/60">
                  <div>AI Provider: {globalProviderLabel}</div>
                  <div>AI Model: {globalModelLabel}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  label="Reset Hudson Default"
                  icon={<RotateCcw size={11} />}
                  onClick={() => resetGlobalSettings()}
                />
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <SectionTitle>Workspace Override</SectionTitle>
                <ScopeBadge label={hasWorkspaceOverride ? 'Current Workspace' : 'Inheriting Hudson'} />
              </div>
              <div className="text-[11px] leading-relaxed text-white/45">
                Override Hudson AI only for this workspace when you need a different provider or model here than everywhere else.
              </div>
              {hasWorkspaceOverride ? (
                <>
                  <div className="grid gap-3">
                    <SettingSelect
                      label="AI Provider"
                      value={workspaceProviderValue}
                      options={providerOptions}
                      onChange={value => updateWorkspaceOverride({ provider: value })}
                    />
                    <SettingSelect
                      label="AI Model"
                      value={workspaceModelValue}
                      options={modelOptions}
                      onChange={value => updateWorkspaceOverride({ model: value })}
                    />
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3">
                    <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/28">
                      Workspace Runtime
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] leading-relaxed text-white/60">
                      <div>AI Provider: {workspaceProviderLabel}</div>
                      <div>AI Model: {workspaceModelLabel}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ActionButton
                      label="Use Hudson Default"
                      icon={<RotateCcw size={11} />}
                      onClick={() => clearWorkspaceOverride()}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.07] px-3 py-3 text-[11px] leading-relaxed text-white/65">
                    This workspace currently inherits the Hudson default: {globalProviderLabel} / {globalModelLabel}.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ActionButton
                      label="Override This Workspace"
                      icon={<SlidersHorizontal size={11} />}
                      onClick={() => enableWorkspaceOverride()}
                      variant="primary"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <SectionTitle>Resolved Runtime</SectionTitle>
                <ScopeBadge label={settingsSource} />
              </div>
              <div className="text-[11px] leading-relaxed text-white/45">
                This is what Hudson AI is actually using right now after applying the Hudson default and any workspace override.
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3">
                <div className="mt-0 space-y-1 text-[11px] leading-relaxed text-white/60">
                  <div>AI Provider: {resolvedProviderLabel}</div>
                  <div>AI Model: {resolvedModelLabel}</div>
                  <div>Voice Mode: {voiceMode}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === 'construction' && selectedApp && (
        <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
              <SectionTitle>Workspace Apps</SectionTitle>
              <div className="space-y-2">
                {toolContext.apps.map(app => {
                  const isSelected = app.id === selectedAppId;
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => setRequestedAppId(app.id)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                        isSelected
                          ? 'border-cyan-500/25 bg-cyan-500/10'
                          : 'border-white/[0.06] bg-black/20 hover:border-cyan-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-white/80">{app.name}</span>
                        <span className="text-[9px] font-mono text-white/35">
                          {app.tools.length} tools
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] leading-relaxed text-white/35">
                        {app.visible ? 'Visible' : 'Hidden'} • {app.mode} • {(app.ports?.inputs?.length ?? 0)} in / {(app.ports?.outputs?.length ?? 0)} out
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
              <SectionTitle>Selected App</SectionTitle>
              <div className="text-[13px] font-medium text-white/82">{selectedApp.name}</div>
              <div className="text-[11px] leading-relaxed text-white/42">
                {selectedApp.description || 'No description registered for this app.'}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Intents" value={selectedAppIntents.length} />
                <StatCard label="Commands" value={selectedAppCommands.length} />
                <StatCard label="Services" value={selectedAppServices.length} />
                <StatCard label="Pipes" value={selectedAppPipes.length} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
              <SectionTitle>Construction Graph</SectionTitle>
              <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
                <ConstructionNode
                  label="App"
                  description={selectedApp.name}
                  meta={`${selectedApp.mode} mode`}
                />
                <div className="hidden items-center justify-center text-white/20 lg:flex">
                  <ArrowRight size={14} />
                </div>
                <ConstructionNode
                  label="Intent"
                  description={selectedIntent?.title || 'No selected intent'}
                  meta={selectedIntent ? `${selectedIntent.category} • ${selectedIntent.commandId}` : 'No intent metadata'}
                />
                <div className="hidden items-center justify-center text-white/20 lg:flex">
                  <ArrowRight size={14} />
                </div>
                <ConstructionNode
                  label="Command"
                  description={selectedCommand?.label || 'No linked command'}
                  meta={selectedCommand ? `${selectedCommand.scope} scope` : 'No live command bridge'}
                />
                <div className="hidden items-center justify-center text-white/20 lg:flex">
                  <ArrowRight size={14} />
                </div>
                <ConstructionNode
                  label="Dependency"
                  description={`${settingsFieldCount} settings • ${selectedAppServices.length} services • ${selectedAppPipes.length} pipes`}
                  meta={`${inputCount} inputs • ${outputCount} outputs`}
                />
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-4">
              <SectionTitle>Drilldown</SectionTitle>
              <div className="grid gap-3 xl:grid-cols-4">
                <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3 space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/25">
                    App
                  </div>
                  <div className="text-[12px] font-medium text-white/80">{selectedApp.name}</div>
                  <div className="text-[10px] leading-relaxed text-white/35">
                    {selectedApp.description || 'No description registered.'}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-2">
                      <div className="text-white/25">Mode</div>
                      <div className="mt-1 text-white/75">{selectedApp.mode}</div>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-2">
                      <div className="text-white/25">Tools</div>
                      <div className="mt-1 text-white/75">{selectedApp.tools.length}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3 space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/25">
                    Intent
                  </div>
                  {selectedAppIntents.length > 0 ? (
                    <div className="space-y-2">
                      {selectedAppIntents.map(intent => {
                        const isSelected = intent.commandId === selectedIntentId;
                        return (
                          <button
                            key={intent.commandId}
                            type="button"
                            onClick={() => setRequestedIntentId(intent.commandId)}
                            className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
                              isSelected
                                ? 'border-cyan-500/25 bg-cyan-500/10'
                                : 'border-white/[0.06] bg-white/[0.02] hover:border-cyan-500/20'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-white/75">{intent.title}</span>
                              <span className="text-[9px] font-mono text-cyan-300/70">{intent.category}</span>
                            </div>
                            <div className="mt-1 text-[10px] leading-relaxed text-white/30">
                              {intent.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[10px] leading-relaxed text-white/30">
                      This app has no registered intents yet.
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3 space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/25">
                    Command
                  </div>
                  {selectedCommand ? (
                    <>
                      <div className="text-[12px] font-medium text-white/80">{selectedCommand.label}</div>
                      <div className="flex flex-wrap items-center gap-2 text-[9px] font-mono text-white/35">
                        <span className="rounded-full border border-white/[0.08] px-1.5 py-0.5">
                          {selectedCommand.scope}
                        </span>
                        {selectedCommand.shortcut && (
                          <span className="rounded-full border border-white/[0.08] px-1.5 py-0.5">
                            {selectedCommand.shortcut}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] leading-relaxed text-white/30">
                        {selectedCommand.description || 'No command description registered.'}
                      </div>
                      {selectedIntent && (
                        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[10px] leading-relaxed text-white/35">
                          {selectedIntent.paramsCount > 0
                            ? `This intent expects ${selectedIntent.paramsCount} parameter${selectedIntent.paramsCount === 1 ? '' : 's'}.`
                            : 'This intent does not declare parameters.'}
                          {selectedIntent.dangerous ? ' It is marked as dangerous.' : ''}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[10px] leading-relaxed text-white/30">
                      No live command is currently linked for this selection.
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3 space-y-3">
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/25">
                    Dependency
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-2">
                      <div className="text-white/25">Settings</div>
                      <div className="mt-1 text-white/75">{settingsFieldCount}</div>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-2">
                      <div className="text-white/25">Services</div>
                      <div className="mt-1 text-white/75">{selectedAppServices.length}</div>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-2">
                      <div className="text-white/25">Pipes</div>
                      <div className="mt-1 text-white/75">{selectedAppPipes.length}</div>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-2">
                      <div className="text-white/25">Ports</div>
                      <div className="mt-1 text-white/75">{inputCount + outputCount}</div>
                    </div>
                  </div>
                  <div className="space-y-1 text-[10px] leading-relaxed text-white/35">
                    <div>
                      Settings: {selectedAppSettings?.sections.map(section => section.label).join(', ') || 'None'}
                    </div>
                    <div>
                      Services: {selectedAppServices.map(service => service.name).join(', ') || 'None'}
                    </div>
                    <div>
                      Pipes: {selectedAppPipes.map(pipe => pipe.name).join(', ') || 'None'}
                    </div>
                    <div>
                      Ports: {inputCount} in / {outputCount} out
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === 'prompts' && (
        <div className="rounded-xl border border-white/[0.05] bg-black/10 p-4 space-y-3">
          <SectionTitle>Prompt Reference</SectionTitle>
          <div className="text-[10px] leading-relaxed text-white/30">
            These are starting points for the Console AI path. They stay secondary on purpose, because the primary job of this app is to expose structure and configuration rather than act as another chat surface.
          </div>
          <div className="space-y-2">
            {promptPresets.map(preset => (
              <div
                key={preset.id}
                className="rounded-xl border border-white/[0.05] bg-black/20 px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] font-medium text-white/70">
                      <Bot size={12} className="text-white/35" />
                      {preset.title}
                    </div>
                    <div className="mt-1 text-[10px] leading-relaxed text-white/30">
                      {preset.description}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <ActionButton
                      label="Insert"
                      icon={<Wand2 size={10} />}
                      onClick={() => queueConsolePrompt(preset.text)}
                    />
                    <ActionButton
                      label="Run"
                      icon={<Play size={10} />}
                      onClick={() => queueConsolePrompt(preset.text, { submit: true })}
                      variant="primary"
                    />
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[10px] font-mono text-white/28 hover:text-cyan-300 transition-colors">
                    Show prompt text
                  </summary>
                  <div className="mt-2 rounded-lg border border-white/[0.04] bg-black/25 px-3 py-2 text-[10px] font-mono leading-relaxed text-white/38">
                    {preset.text}
                  </div>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
