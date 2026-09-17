'use client';

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useAppSettings } from 'hudsonkit';
import { HudSelectBase } from 'hudsonkit/behaviors';
import {
  AlertTriangle,
  AudioLines,
  Check,
  Info,
  Loader2,
  Mic,
  Minus,
  Play,
  Power,
  RotateCcw,
  Trash2,
  VolumeX,
  Wrench,
  X,
} from 'hudsonkit/icons';
import { useVoice } from './VoiceProvider';
import type { VoiceToolActivity, VoiceTranscript } from './voice-types';
import { hudsonVoiceSettings } from './settings';
import { formatClock } from './hooks';
import './voice.css';

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

const PHASE_LABELS: Record<string, string> = {
  idle: 'Idle',
  connecting: 'Connecting',
  connected: 'Live',
  disconnecting: 'Ending',
  error: 'Error',
};

function phaseDotClass(phase: string, ready: boolean): string {
  switch (phase) {
    case 'connected':
      return 'bg-success voice-live-dot';
    case 'connecting':
    case 'disconnecting':
      return 'bg-warning';
    case 'error':
      return 'bg-red-400';
    default:
      return ready ? 'bg-muted-foreground/60' : 'bg-warning';
  }
}

function ControlButton({
  label,
  icon,
  onClick,
  disabled,
  variant = 'quiet',
  pressed,
  title,
}: {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'quiet' | 'danger';
  pressed?: boolean;
  title?: string;
}) {
  const base =
    'inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[10px] font-mono transition-colors disabled:cursor-not-allowed disabled:opacity-40';
  const look =
    variant === 'primary'
      ? 'border-info/40 bg-info/10 text-info hover:bg-info/20'
      : variant === 'danger'
        ? 'border-red-400/35 bg-red-400/10 text-red-400 hover:bg-red-400/15'
        : pressed
          ? 'border-warning/45 bg-warning/10 text-warning'
          : 'border-border/70 text-muted-foreground hover:border-info/30 hover:text-info';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      title={title}
      className={`${base} ${look}`}
    >
      {icon}
      {label}
    </button>
  );
}

function NoticeRow({
  tone,
  icon,
  children,
  action,
}: {
  tone: 'info' | 'warning' | 'error';
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  const look =
    tone === 'error'
      ? 'border-red-400/35 bg-red-400/10 text-red-400'
      : tone === 'warning'
        ? 'border-warning/40 bg-warning/10 text-warning'
        : 'border-info/30 bg-info/10 text-info';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`mx-3 mt-2 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] ${look}`}
    >
      {icon}
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

function ConfigFacts() {
  const { availability } = useVoice();
  const config = availability.config;
  if (!config) return null;
  const facts = [config.provider, config.model, config.voice].filter(Boolean).join(' · ');
  return (
    <details className="text-[11px] text-foreground/70">
      <summary className="cursor-pointer">Connection details</summary>
      <p className="mt-2 font-mono">{facts}</p>
      <p className="mt-1">Configured on the server.</p>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

interface Turn {
  role: 'user' | 'assistant';
  entries: VoiceTranscript[];
}

function groupTurns(transcript: VoiceTranscript[]): Turn[] {
  const turns: Turn[] = [];
  for (const entry of transcript) {
    const last = turns[turns.length - 1];
    if (last && last.role === entry.role) last.entries.push(entry);
    else turns.push({ role: entry.role, entries: [entry] });
  }
  return turns;
}

function TranscriptEmptyState() {
  const { phase, availability } = useVoice();
  if (phase === 'connected') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <span className="h-2 w-2 rounded-full bg-success voice-live-dot" aria-hidden />
        <div className="text-[12px] text-foreground/80">Listening — say something.</div>
        <div className="text-[10px] font-mono text-muted-foreground">
          The transcript of both sides appears here as you speak.
        </div>
      </div>
    );
  }
  const limit = availability.sessionLimitSeconds;
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-[380px] space-y-3">
        <div className="text-[14px] text-foreground">Ready when you are</div>
        <ol className="list-decimal space-y-2 pl-4 text-[12px] leading-relaxed text-foreground/80">
          <li>
            Refresh and pick a microphone. Refreshing grants access to device names without
            starting a session.
          </li>
          <li>Start a conversation. The assistant hears you live and answers aloud.</li>
          <li>
            Interrupt playback at any time — it mutes the assistant&rsquo;s audio without
            cancelling tools it is running. You can also switch microphones mid-session.
          </li>
        </ol>
        {limit > 0 && (
          <div className="text-[11px] text-foreground/70">
            Sessions end automatically after {formatClock(limit)}.
          </div>
        )}
        <ConfigFacts />
      </div>
    </div>
  );
}

function TranscriptView({ follow }: { follow: boolean }) {
  const { transcript, clearTranscript, phase } = useVoice();
  const sessionBusy =
    phase === 'connecting' || phase === 'connected' || phase === 'disconnecting';
  const turns = useMemo(() => groupTurns(transcript), [transcript]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const lastEntryId = transcript.length > 0 ? transcript[transcript.length - 1].id : -1;
  const lastEntryLength =
    transcript.length > 0 ? transcript[transcript.length - 1].text.length : 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !follow || !nearBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [follow, lastEntryId, lastEntryLength]);

  return (
    <section aria-label="Transcript" className="flex min-h-0 min-w-0 flex-col">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border/60 px-3">
        <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
          Transcript{transcript.length > 0 ? ` · ${turns.length}` : ''}
        </div>
        <button
          type="button"
          onClick={clearTranscript}
          disabled={transcript.length === 0 || sessionBusy}
          title={
            sessionBusy
              ? 'The transcript can be cleared after the session ends'
              : 'Clear transcript'
          }
          className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[10px] font-mono text-muted-foreground transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 size={11} />
          Clear
        </button>
      </div>
      {transcript.length === 0 ? (
        <TranscriptEmptyState />
      ) : (
        <div
          ref={scrollRef}
          role="log"
          aria-label="Conversation transcript"
          onScroll={() => {
            const el = scrollRef.current;
            if (!el) return;
            nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          }}
          className="frame-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3"
        >
          <div className="space-y-3">
            {turns.map(turn => (
              <div key={turn.entries[0].id}>
                <div
                  className={`text-[9px] font-mono uppercase tracking-[0.14em] ${
                    turn.role === 'assistant' ? 'text-info' : 'text-muted-foreground'
                  }`}
                >
                  {turn.role === 'assistant' ? 'Assistant' : 'You'}
                </div>
                <div className="mt-0.5 space-y-1">
                  {turn.entries.map(entry => (
                    <p
                      key={entry.id}
                      className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/85"
                    >
                      {entry.text}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tool activity
// ---------------------------------------------------------------------------

function ToolStatusGlyph({ status }: { status: VoiceToolActivity['status'] }) {
  switch (status) {
    case 'running':
      return <Loader2 size={11} className="animate-spin text-warning" aria-hidden />;
    case 'complete':
      return <Check size={11} className="text-success" aria-hidden />;
    case 'failed':
      return <X size={11} className="text-red-400" aria-hidden />;
    default:
      return <Minus size={11} className="text-muted-foreground" aria-hidden />;
  }
}

const TOOL_STATUS_LABELS: Record<VoiceToolActivity['status'], string> = {
  running: 'running',
  complete: 'complete',
  failed: 'failed',
  cancelled: 'cancelled',
};

function ToolRail() {
  const { tools } = useVoice();
  const anyRunning = tools.some(tool => tool.status === 'running');
  return (
    <aside aria-label="Tool activity" className="voice-rail flex min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center border-b border-border/60 px-3">
        <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
          <Wrench size={10} aria-hidden />
          Tool Activity{tools.length > 0 ? ` · ${tools.length}` : ''}
        </div>
      </div>
      {tools.length === 0 ? (
        <div className="px-3 py-3 text-[12px] leading-relaxed text-foreground/75">
          No tool calls yet. Tools the assistant invokes during the session are listed here.
        </div>
      ) : (
        <div className="frame-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-2">
            {tools.map(tool => (
              <li key={tool.id} className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <ToolStatusGlyph status={tool.status} />
                  <span className="truncate font-mono text-[11px] text-foreground/85">
                    {tool.name}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-[9px] uppercase tracking-wide text-muted-foreground/70">
                    {TOOL_STATUS_LABELS[tool.status]}
                  </span>
                </div>
                {tool.detail && (
                  <div className="mt-0.5 pl-[18.5px] text-[10px] leading-snug text-muted-foreground">
                    {tool.detail}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {anyRunning && (
        <div className="shrink-0 border-t border-border/60 px-3 py-1.5 text-[9px] font-mono leading-snug text-muted-foreground/70">
          Interrupting playback does not cancel running tools.
        </div>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Header + microphone strip
// ---------------------------------------------------------------------------

function SessionHeader() {
  const voice = useVoice();
  const { phase, availability, loading, selectingMicrophone, elapsedSeconds } = voice;
  const limit = availability.sessionLimitSeconds;
  const remaining = limit > 0 ? limit - elapsedSeconds : Infinity;
  const canConnect =
    (phase === 'idle' || phase === 'error') &&
    availability.ready &&
    !loading &&
    !selectingMicrophone;

  return (
    <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border/60 px-3 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${phaseDotClass(phase, availability.ready)}`}
          aria-hidden
        />
        <span aria-live="polite" className="font-mono text-[11px] text-foreground/85">
          {PHASE_LABELS[phase]}
        </span>
        {phase === 'connected' && (
          <span
            className={`font-mono text-[11px] tabular-nums ${
              remaining <= 15 ? 'text-warning' : 'text-muted-foreground'
            }`}
          >
            {formatClock(elapsedSeconds)}
            {limit > 0 && ` / ${formatClock(limit)}`}
          </span>
        )}
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
        {phase === 'connected' && (
          <>
            {voice.playbackMuted || voice.playbackBlocked ? (
              <ControlButton
                label="Resume audio"
                icon={<Play size={11} />}
                onClick={() => { void voice.resumePlayback(); }}
                title="Resume the assistant's audio playback"
              />
            ) : (
              <ControlButton
                label="Interrupt"
                icon={<VolumeX size={11} />}
                onClick={() => voice.interrupt()}
                title="Mute the assistant's playback. Running tools keep going."
              />
            )}
            <ControlButton
              label={voice.microphoneMuted ? 'Mic muted' : 'Mute mic'}
              icon={<Mic size={11} />}
              pressed={voice.microphoneMuted}
              onClick={() => voice.toggleMicrophone()}
              title={
                voice.microphoneMuted
                  ? 'Unmute your microphone'
                  : 'Mute your microphone. Playback continues.'
              }
            />
          </>
        )}
        {phase === 'idle' || phase === 'error' ? (
          <ControlButton
            label="Start conversation"
            icon={<AudioLines size={11} />}
            variant="primary"
            disabled={!canConnect}
            onClick={() => { void voice.connect(); }}
            title={
              availability.ready
                ? 'Start a live voice session with your microphone'
                : availability.message || 'Voice session is not configured'
            }
          />
        ) : (
          <ControlButton
            label="End"
            icon={<Power size={11} />}
            variant="danger"
            disabled={phase === 'disconnecting'}
            onClick={() => { void voice.disconnect(); }}
            title="End the session and release the microphone"
          />
        )}
      </div>
    </div>
  );
}

function MicrophoneStrip() {
  const voice = useVoice();
  const { devices, selectedDeviceId, actualMicrophone, selectingMicrophone, loading, phase } =
    voice;
  const options = useMemo(() => {
    const known = [
      { value: '', label: 'System default' },
      ...(selectedDeviceId && !devices.some(device => device.id === selectedDeviceId) ? [{ value: selectedDeviceId, label: 'Selected microphone (unavailable)' }] : []),
      ...devices
        .filter(device => device.id !== '')
        .map(device => ({ value: device.id, label: device.label })),
    ];
    // Keep a dropped-but-selected device addressable so the picker never
    // silently misreports which input the session is using.
    if (selectedDeviceId && !known.some(option => option.value === selectedDeviceId)) {
      known.push({
        value: selectedDeviceId,
        label: 'Selected microphone unavailable — choose another',
      });
    }
    return known;
  }, [devices, selectedDeviceId]);
  const pickerLocked =
    selectingMicrophone || loading || phase === 'connecting' || phase === 'disconnecting';

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/60 px-3">
      <Mic size={11} className="shrink-0 text-muted-foreground" aria-hidden />
      <HudSelectBase
        aria-label="Microphone"
        placeholder="System default"
        density="compact"
        options={options}
        value={selectedDeviceId}
        disabled={pickerLocked}
        onValueChange={value => { void voice.selectMicrophone(value ?? ''); }}
        className="w-full max-w-[260px]"
      />
      <button
        type="button"
        onClick={() => { void voice.refreshMicrophones(); }}
        disabled={selectingMicrophone || voice.phase === 'connecting' || voice.phase === 'disconnecting'}
        title="Refresh microphones. Grants access to device names without starting a session."
        aria-label="Refresh microphones"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border/70 text-muted-foreground transition-colors hover:border-info/30 hover:text-info disabled:cursor-not-allowed disabled:opacity-40"
      >
        <RotateCcw size={11} className={selectingMicrophone ? 'animate-spin' : undefined} />
      </button>
      {actualMicrophone && (
        <span className="ml-auto min-w-0 truncate text-right font-mono text-[10px] text-muted-foreground">
          Using: {actualMicrophone}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notices
// ---------------------------------------------------------------------------

function SetupCard() {
  const { availability, loading, refreshAvailability } = useVoice();
  return (
    <div className="mx-3 mt-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-warning">
        <AlertTriangle size={12} aria-hidden />
        <span className="min-w-0 flex-1">{availability.message || 'Voice session is not configured.'}</span>
        <ControlButton
          label={loading ? 'Checking' : 'Check again'}
          icon={loading ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
          disabled={loading}
          onClick={() => { void refreshAvailability(); }}
        />
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
        The conversation provider, model, and credentials are owned by the server and read from
        its environment. Nothing secret is entered or stored in the browser — update the server
        environment, then check again.
      </p>
    </div>
  );
}

function Notices() {
  const voice = useVoice();
  const { phase, availability, loading, message, playbackBlocked } = voice;
  return (
    <>
      {!availability.ready && phase === 'idle' && loading && (
        <NoticeRow tone="info" icon={<Loader2 size={12} className="animate-spin" aria-hidden />}>
          {availability.message || 'Checking connection…'}
        </NoticeRow>
      )}
      {!availability.ready && phase === 'idle' && !loading && <SetupCard />}
      {phase === 'error' && (
        <NoticeRow
          tone="error"
          icon={<AlertTriangle size={12} aria-hidden />}
          action={
            availability.ready ? (
              <ControlButton label="Retry" icon={<RotateCcw size={11} />} onClick={() => { void voice.connect(); }} />
            ) : undefined
          }
        >
          {message || 'The session failed.'}
        </NoticeRow>
      )}
      {phase !== 'error' && message && message !== availability.message && (
        <NoticeRow tone="info" icon={<Info size={12} aria-hidden />}>
          {message}
        </NoticeRow>
      )}
      {playbackBlocked && (
        <NoticeRow
          tone="warning"
          icon={<VolumeX size={12} aria-hidden />}
          action={
            <ControlButton
              label="Enable audio"
              icon={<Play size={11} />}
              onClick={() => { void voice.resumePlayback(); }}
            />
          }
        >
          The browser blocked audio playback.
        </NoticeRow>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export function VoiceContent() {
  const [settings] = useAppSettings('hudson-voice', hudsonVoiceSettings);
  const showToolActivity = settings.showToolActivity !== false;
  const followTranscript = settings.followTranscript !== false;

  return (
    <div className="voice-root flex h-full min-h-0 min-w-0 flex-col bg-background text-foreground">
      <SessionHeader />
      <MicrophoneStrip />
      <Notices />
      <div className="voice-main min-h-0 flex-1">
        <div className={`voice-split ${showToolActivity ? 'voice-split--rail' : ''}`}>
          <TranscriptView follow={followTranscript} />
          {showToolActivity && <ToolRail />}
        </div>
      </div>
    </div>
  );
}
