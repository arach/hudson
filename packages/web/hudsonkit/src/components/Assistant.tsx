'use client';

import { useMemo, useCallback, useState } from 'react';
import { Sparkles, Mic, Square, Volume2, VolumeX, Loader2 } from '../icons';
import { AI } from './AI';
import { TerminalRelay } from './TerminalRelay';
import { useTerminalRelay } from '../hooks/useTerminalRelay';
import { useAssistant } from '../hooks/useAssistant';
import { usePersistentState } from '../hooks/usePersistentState';
import { usePlatform } from '../platform/PlatformContext';
import type { HudsonApp } from '../types/app';
import type { CommandOption } from './overlays/CommandPalette';
import type { AssistantVoiceKit } from '../types/voice-kit';

// ---------------------------------------------------------------------------
// Generic dual-mode Assistant.
// - Default: PTY relay (leans on the user's existing Claude CLI auth)
// - Toggle: API chat (native tool calls; dispatches via app.intents → useCommands)
// ---------------------------------------------------------------------------

type AssistantMode = 'relay' | 'chat';

interface AssistantProps {
  app: HudsonApp;
  /** Live commands from the app's useCommands() hook — required for chat-mode dispatch. */
  commands: CommandOption[];
  /** Optional state snapshot included in chat-mode context each turn. */
  state?: Record<string, unknown>;

  // ---- Relay options ----
  relayUrl?: string;
  cwd?: string;
  agent?: 'claude' | 'pi';
  provider?: string;
  model?: string;
  backend?: 'pty' | 'tmux';
  tmuxSession?: string;
  workspaceFiles?: Record<string, string>;

  /** Called when the disconnected state's "Settings" button is clicked. */
  onOpenSettings?: () => void;
  /** Called when the disconnected state's "Start Service" button is clicked — should boot the relay service. */
  onStartService?: () => Promise<boolean>;

  /** Voice kit from hudsonkit/voice — if omitted, voice controls are hidden and no voice deps are loaded. */
  voiceKit?: AssistantVoiceKit;
}

export function Assistant({
  app,
  commands,
  state,
  relayUrl = 'ws://localhost:3600',
  cwd,
  agent = 'claude',
  provider,
  model,
  backend = 'pty',
  tmuxSession,
  workspaceFiles,
  onOpenSettings,
  onStartService,
  voiceKit,
}: AssistantProps) {
  const [mode, setMode] = usePersistentState<AssistantMode>(`assistant.${app.id}.mode`, 'relay');
  const [chatInput, setChatInput] = useState('');
  const [speakerOn, setSpeakerOn] = usePersistentState<boolean>(
    `assistant.${app.id}.voice.speakReplies`,
    voiceKit?.settings.speakReplies ?? false,
  );
  const { serviceApiUrl } = usePlatform();

  // ---- Relay engine ----------------------------------------------------------
  const relaySystemPrompt = useMemo(() => buildRelaySystemPrompt(app), [app]);

  const relay = useTerminalRelay({
    url: relayUrl,
    systemPrompt: relaySystemPrompt,
    cwd,
    workspaceFiles,
    sessionKey: `assistant-${app.id}`,
    backend,
    tmuxSession,
    agent,
    provider: agent === 'pi' ? provider : undefined,
    model: agent === 'pi' ? model : undefined,
  });

  // Default service starter — boots the bundled `relay` service via the catalog.
  // Override with `onStartService` for custom service registries.
  const handleStartRelay = useCallback(async (): Promise<boolean> => {
    if (onStartService) return onStartService();
    try {
      const res = await fetch(`${serviceApiUrl}/api/services/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: 'relay', action: 'start', triggeredBy: 'assistant' }),
      });
      const data = await res.json();
      return data.success === true;
    } catch {
      return false;
    }
  }, [onStartService, serviceApiUrl]);

  const relayConfigItems = useMemo(() => {
    const items = [
      { label: 'Relay', value: relayUrl },
      { label: 'Agent', value: agent },
    ];
    if (cwd) items.push({ label: 'CWD', value: cwd });
    if (agent === 'pi' && model) items.push({ label: 'Model', value: model });
    return items;
  }, [relayUrl, agent, cwd, model]);

  // ---- Voice (optional — only active when voiceKit is provided) -------------
  const [lastTurnSource, setLastTurnSource] = useState<'text' | 'voice'>('text');

  // ---- Chat engine -----------------------------------------------------------
  const chat = useAssistant({
    app,
    commands,
    state,
    provider,
    model,
    onFinish: ({ message, isAbort, isDisconnect, isError }) => {
      if (!voiceKit || !speakerOn) return;
      if (isAbort || isDisconnect || isError) return;
      if (message.role !== 'assistant') return;
      voiceKit.speakReply(message, { surface: 'hudson-assistant', appId: app.id, source: lastTurnSource });
    },
  });

  // Wire voice transcript into chat input (only when voiceKit present)
  const onVoiceTranscript = useCallback((transcript: string) => {
    if (!voiceKit) return;
    const merged = [chatInput.trim(), transcript].filter(Boolean).join(' ');
    if (voiceKit.settings.autoSend && chat.status !== 'streaming' && chat.status !== 'submitted') {
      setChatInput('');
      setLastTurnSource('voice');
      chat.sendMessage({ text: merged });
    } else {
      setChatInput(merged);
    }
  }, [voiceKit, chatInput, chat]);

  // Expose transcript callback to the voiceKit
  const onMicClick = useCallback(() => {
    if (!voiceKit) return;
    if (voiceKit.input.status === 'recording') voiceKit.input.stop();
    else void voiceKit.input.start(onVoiceTranscript);
  }, [voiceKit, onVoiceTranscript]);

  // ---- Render ---------------------------------------------------------------
  const intentCount = app.intents?.length ?? 0;
  const showVoice = !!voiceKit;
  const micBusy = voiceKit?.input.status === 'transcribing';
  const micRecording = voiceKit?.input.status === 'recording';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border/50 bg-background/60">
        <Sparkles size={11} className="text-cyan-400/60" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/80">
          Assistant
        </span>
        <span className="text-[10px] font-mono text-muted-foreground/60">
          · {app.name}
        </span>
        <div className="flex-1" />

        {/* Speaker toggle (chat-mode only) */}
        {showVoice && mode === 'chat' && (
          <button
            type="button"
            onClick={() => {
              if (speakerOn) voiceKit?.output.stop();
              setSpeakerOn(!speakerOn);
            }}
            className={`p-1 rounded transition-colors ${
              speakerOn
                ? 'text-cyan-300 hover:text-cyan-200'
                : 'text-muted-foreground/80 hover:text-foreground'
            }`}
            title={speakerOn ? 'Speaker on (click to mute)' : 'Speaker off (click to enable)'}
          >
            {voiceKit?.output.isPlaying
              ? <Loader2 size={12} className="animate-spin" />
              : speakerOn
                ? <Volume2 size={12} />
                : <VolumeX size={12} />}
          </button>
        )}

        {/* Mode toggle */}
        <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
          <ModeButton active={mode === 'relay'} onClick={() => setMode('relay')}>
            Relay
          </ModeButton>
          <ModeButton active={mode === 'chat'} onClick={() => setMode('chat')}>
            Chat
          </ModeButton>
        </div>

        {/* Relay-only controls */}
        {mode === 'relay' && relay.status === 'connected' && (
          <button
            type="button"
            onClick={() => relay.restart()}
            className="text-[10px] px-2 py-0.5 rounded-full border text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 transition-colors"
            title="Kill session and start fresh"
          >
            Restart
          </button>
        )}
        {mode === 'relay' && relay.status === 'connected' && (
          <button
            type="button"
            onClick={() => relay.disconnect()}
            className="text-[10px] px-2 py-0.5 rounded-full border text-red-400 border-red-500/30 hover:bg-red-500/10 transition-colors"
          >
            Disconnect
          </button>
        )}
        {mode === 'relay' && relay.status !== 'connected' && relay.status !== 'connecting' && (
          <button
            type="button"
            onClick={() => relay.connect()}
            className="text-[10px] px-2 py-0.5 rounded-full border text-accent border-accent/30 hover:bg-accent/10 transition-colors"
          >
            Connect
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0">
        {mode === 'relay' ? (
          <TerminalRelay
            relay={relay}
            configItems={relayConfigItems}
            onOpenSettings={onOpenSettings}
            onStartService={handleStartRelay}
          />
        ) : (
          <AI
            chat={chat}
            placeholder={intentCount === 0
              ? `Ask about ${app.name} — no intents declared, conversation only.`
              : `Ask ${app.name} to do something… (${intentCount} intent${intentCount === 1 ? '' : 's'})`}
            inputValue={chatInput}
            onInputChange={value => {
              // Reset turn-source when the user types — voice-source flag should
              // only stick when the message actually came from a transcript.
              if (lastTurnSource === 'voice' && value.length === 0) setLastTurnSource('text');
              setChatInput(value);
            }}
            inputExtras={showVoice && voiceKit?.input.isSupported ? (
              <button
                type="button"
                onClick={onMicClick}
                disabled={micBusy}
                className={`p-1 rounded transition-colors disabled:opacity-30 ${
                  micRecording
                    ? 'bg-red-500/15 text-red-300 hover:bg-red-500/20'
                    : 'text-muted-foreground/80 hover:text-cyan-400'
                }`}
                title={micRecording ? 'Stop recording' : 'Record voice prompt'}
              >
                {micBusy
                  ? <Loader2 size={12} className="animate-spin" />
                  : micRecording
                    ? <Square size={11} />
                    : <Mic size={12} />}
              </button>
            ) : undefined}
            inputStatus={showVoice && voiceKit ? <VoiceStatusBadge
              inputStatus={voiceKit.input.status}
              inputError={voiceKit.input.error}
              outputStatus={voiceKit.output.status}
              outputError={voiceKit.output.error}
            /> : undefined}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal pieces
// ---------------------------------------------------------------------------

type VoiceStatusValue = 'idle' | 'recording' | 'transcribing' | 'ready' | 'synthesizing' | 'speaking' | 'unavailable' | 'error';

function VoiceStatusBadge({
  inputStatus,
  inputError,
  outputStatus,
  outputError,
}: {
  inputStatus: VoiceStatusValue;
  inputError: string | null;
  outputStatus: VoiceStatusValue;
  outputError: string | null;
}) {
  const badge = pickBadge(inputStatus) ?? pickBadge(outputStatus);
  const message = inputError ?? outputError;

  if (!badge && !message) return null;

  return (
    <div className="flex items-center gap-2">
      {badge && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${badge.className}`}>
          {badge.label}
        </span>
      )}
      {message && (
        <span className="text-[10px] text-muted-foreground/80 truncate flex-1" title={message}>
          {message}
        </span>
      )}
    </div>
  );
}

function pickBadge(status: VoiceStatusValue) {
  switch (status) {
    case 'recording': return { label: 'listening', className: 'border-red-500/20 bg-red-500/10 text-red-300' };
    case 'transcribing': return { label: 'transcribing', className: 'border-amber-500/20 bg-amber-500/10 text-amber-300' };
    case 'ready': return { label: 'draft ready', className: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300' };
    case 'synthesizing': return { label: 'voicing', className: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300' };
    case 'speaking': return { label: 'speaking', className: 'border-accent/20 bg-accent/10 text-accent' };
    case 'unavailable': return { label: 'voice offline', className: 'border-amber-500/20 bg-amber-500/10 text-amber-300' };
    case 'error': return { label: 'voice error', className: 'border-red-500/20 bg-red-500/10 text-red-300' };
    default: return null;
  }
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
        active
          ? 'bg-cyan-500/15 text-cyan-300'
          : 'text-muted-foreground/80 hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Generic relay system prompt — gives the CLI agent context about the host
 * app without prescribing a tool-tag protocol (relay mode talks to the user
 * directly through the terminal; the agent uses its own native tools).
 */
function buildRelaySystemPrompt(app: HudsonApp): string {
  const lines: string[] = [
    `You are working alongside the user inside the **${app.name}** Hudson app.`,
  ];
  if (app.description) lines.push(app.description);

  const intents = app.intents ?? [];
  if (intents.length > 0) {
    lines.push('', '## What this app can do (for context)');
    for (const i of intents) {
      lines.push(`- ${i.title} — ${i.description}`);
    }
    lines.push(
      '',
      'These actions live inside the running app. You can describe them to the user, but you do not invoke them yourself — the user can trigger any of them via the command palette (Cmd+K).',
    );
  }

  lines.push(
    '',
    '## How to behave',
    '- Be terse. The user is in a terminal; respect their attention.',
    '- Use your own tools (file ops, shell, etc.) freely if it helps.',
    '- When asked to change something inside the app itself, prefer guiding the user to the matching command rather than hacking around it.',
  );

  return lines.join('\n');
}
