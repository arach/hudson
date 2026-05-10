'use client';

// ─────────────────────────────────────────────────────────────────────────────
// EmbedVoice — Getting-Started-with-Voice mini-app for /embed/<appId>/voice
// ─────────────────────────────────────────────────────────────────────────────
// State machine driven by probeVoxAvailability() (polled every 2s):
//
//   probing      → first paint, no result yet
//   install      → Vox unreachable on 127.0.0.1:43115 → invite DMG download
//   connect      → Vox running but origin blocked → vox:// launch handshake
//   ready        → Vox connected → 3-step setup walk-through
//
// All chrome respects --hud-* tokens delivered by the consumer registry +
// embed-context handshake, so the surface inherits drafting / hudson palettes
// without a flash.
// ─────────────────────────────────────────────────────────────────────────────

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  createVoxdClient,
  type LiveSession,
  type SessionState,
  type VoxDClient,
} from '@voxd/client';
import { probeVoxAvailability, type VoxAvailability } from 'hudsonkit';

// Stable brand URL — voxd.cc redirects to the current Vox.dmg. Avoids hard-coding
// the GitHub release path so we don't break when the release pipeline moves.
const VOX_INSTALL_URL = 'https://voxd.cc/download';
const VOX_BRAND_URL = 'https://voxd.cc/';
const POLL_INTERVAL_MS = 2000;
const HUDSON_VOX_CLIENT_ID = 'hudsonkit';

type Phase = 'probing' | 'install' | 'connect' | 'ready';

function phaseFor(a: VoxAvailability | null): Phase {
  if (a === null) return 'probing';
  if (a === 'connected' || a === 'warming') return 'ready';
  if (a === 'blocked-origin') return 'connect';
  return 'install';
}

function buildLaunchUrl(origin: string): string {
  const params = new URLSearchParams({
    clientId: HUDSON_VOX_CLIENT_ID,
    name: 'HudsonKit',
    origin,
    origins: origin,
    product: 'Hudson workspace',
    description: 'Hudson uses Vox for local voice prompts and replies.',
    routes: '/capabilities,/transcribe,/live,/voices,/speak',
    permissions: 'local_asr,local_tts,live_sessions',
  });
  return `vox://launch?${params.toString()}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EmbedVoice() {
  const [availability, setAvailability] = useState<VoxAvailability | null>(null);
  const [ticks, setTicks] = useState(0);
  const [downloadClicked, setDownloadClicked] = useState(false);

  // Single voxd client for the lifetime of the embed — drives both the
  // availability poll and the LiveSession test. Vox handles the mic capture
  // itself; we just send control signals over loopback.
  const voxClient = useMemo<VoxDClient | null>(() => {
    if (typeof window === 'undefined') return null;
    return createVoxdClient({ clientId: HUDSON_VOX_CLIENT_ID });
  }, []);

  useEffect(() => {
    if (!voxClient) return;
    let cancelled = false;
    async function poll() {
      if (cancelled || !voxClient) return;
      try {
        const r = await probeVoxAvailability(voxClient);
        if (cancelled) return;
        setAvailability(r);
        setTicks((c) => c + 1);
      } catch {
        if (cancelled) return;
        setAvailability('unreachable');
        setTicks((c) => c + 1);
      }
    }
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [voxClient]);

  const phase = phaseFor(availability);
  const launchUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return buildLaunchUrl(window.location.origin);
  }, []);

  return (
    <div style={ROOT}>
      <TopBar phase={phase} />
      <div style={STAGE}>
        {phase === 'probing' && <Probing />}
        {phase === 'install' && (
          <Install
            downloadClicked={downloadClicked}
            onDownload={() => setDownloadClicked(true)}
          />
        )}
        {phase === 'connect' && <Connect launchUrl={launchUrl} />}
        {phase === 'ready' && <Ready voxClient={voxClient} />}
      </div>
      <BottomBar phase={phase} ticks={ticks} availability={availability} />
    </div>
  );
}

// ─── Layout shells ───────────────────────────────────────────────────────────

const ROOT: CSSProperties = {
  minHeight: '100%',
  width: '100%',
  background: 'var(--hud-bg, oklch(0.18 0.02 240))',
  color: 'var(--hud-ink, oklch(0.94 0.005 240))',
  fontFamily: 'var(--hud-font-body, system-ui, sans-serif)',
  display: 'grid',
  gridTemplateRows: 'auto 1fr auto',
};

const STAGE: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  padding: '24px 32px',
  position: 'relative',
};

const STEPS: Array<{ id: Phase; label: string }> = [
  { id: 'install', label: '01 · Install' },
  { id: 'connect', label: '02 · Permit' },
  { id: 'ready', label: '03 · Ready' },
];

function TopBar({ phase }: { phase: Phase }) {
  const activeIdx = STEPS.findIndex((s) => s.id === phase);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        padding: '12px 18px',
        borderBottom: 'var(--hud-border-width, 1px) solid var(--hud-line, oklch(0.32 0.012 240))',
        fontFamily: 'var(--hud-font-mono, ui-monospace, monospace)',
        fontSize: 10,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--hud-ink-2, oklch(0.66 0.008 240))',
      }}
    >
      <span style={{ alignSelf: 'center' }}>
        Hudson · <span style={{ color: 'var(--hud-ink, oklch(0.94 0.005 240))' }}>voice setup</span>
      </span>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        {STEPS.map((s, i) => {
          const isActive = phase !== 'probing' && i === activeIdx;
          const isPast = phase !== 'probing' && activeIdx > i;
          return (
            <span
              key={s.id}
              style={{
                color: isActive
                  ? 'var(--hud-accent, oklch(0.72 0.18 162))'
                  : isPast
                    ? 'var(--hud-ink-1, oklch(0.86 0.005 240))'
                    : 'var(--hud-ink-3, oklch(0.50 0.01 240))',
                opacity: isActive ? 1 : isPast ? 0.85 : 0.5,
              }}
            >
              {s.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function BottomBar({
  phase,
  ticks,
  availability,
}: {
  phase: Phase;
  ticks: number;
  availability: VoxAvailability | null;
}) {
  const dotColor =
    phase === 'ready'
      ? 'var(--hud-accent, oklch(0.72 0.18 162))'
      : phase === 'connect'
        ? 'var(--hud-ink-1, oklch(0.86 0.005 240))'
        : 'var(--hud-ink-3, oklch(0.50 0.01 240))';

  const status =
    phase === 'ready'
      ? 'connected'
      : phase === 'connect'
        ? 'awaiting permission'
        : phase === 'install'
          ? 'watching for vox'
          : 'probing';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '10px 18px',
        borderTop: 'var(--hud-border-width, 1px) solid var(--hud-line, oklch(0.32 0.012 240))',
        fontFamily: 'var(--hud-font-mono, ui-monospace, monospace)',
        fontSize: 9,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--hud-ink-3, oklch(0.50 0.01 240))',
      }}
    >
      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        <Pulse color={dotColor} pulsing={phase === 'install' || phase === 'probing'} />
        {status}
      </span>
      <span>
        127.0.0.1:43115 · check #{ticks.toString().padStart(2, '0')}
        {availability && phase !== 'ready' && (
          <span style={{ marginLeft: 10, color: 'var(--hud-ink-2, oklch(0.66 0.008 240))' }}>
            · {availability}
          </span>
        )}
      </span>
    </div>
  );
}

function Pulse({ color, pulsing }: { color: string; pulsing: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 7,
        height: 7,
        background: color,
        borderRadius: 1,
        display: 'inline-block',
        animation: pulsing ? 'voxPulse 1.4s ease-in-out infinite' : 'none',
      }}
    >
      <style>{`
        @keyframes voxPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
      `}</style>
    </span>
  );
}

// ─── Phase: Probing ──────────────────────────────────────────────────────────

function Probing() {
  return (
    <Card>
      <Caption>Initializing</Caption>
      <h2 style={H2}>Looking for Vox.</h2>
      <p style={SUB}>
        Probing the local Vox companion on 127.0.0.1:43115 — this takes a moment.
      </p>
    </Card>
  );
}

// ─── Phase: Install ──────────────────────────────────────────────────────────

function Install({ downloadClicked, onDownload }: { downloadClicked: boolean; onDownload: () => void }) {
  return (
    <Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 32, alignItems: 'center' }}>
        <div>
          <Caption>Step 01 · Install</Caption>
          <h2 style={H2}>Get voice on Hudson.</h2>
          <p style={SUB}>
            Vox is the local companion that captures, transcribes, and replies — runs
            entirely on your machine, no cloud round-trip. Once installed, this page
            picks it up automatically.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
            <a
              href={VOX_INSTALL_URL}
              target="_top"
              rel="noopener noreferrer"
              onClick={onDownload}
              style={PrimaryButton}
            >
              ↓ Download Vox.dmg
            </a>
            <a
              href={VOX_BRAND_URL}
              target="_top"
              rel="noopener noreferrer"
              style={GhostButton}
            >
              About Vox
            </a>
          </div>
          {downloadClicked && (
            <p
              style={{
                marginTop: 18,
                fontFamily: 'var(--hud-font-mono, ui-monospace, monospace)',
                fontSize: 11,
                letterSpacing: '0.06em',
                color: 'var(--hud-ink-2, oklch(0.66 0.008 240))',
              }}
            >
              ⏵ Drag <strong style={{ color: 'var(--hud-ink, oklch(0.94 0.005 240))' }}>Vox.app</strong> into
              Applications, launch it, then return here. This page will detect Vox in ~2s.
            </p>
          )}
        </div>
        <MenuBarIllustration />
      </div>
    </Card>
  );
}

function MenuBarIllustration() {
  // Single-stroke drafting illustration of the macOS menu bar with Vox icon.
  return (
    <svg
      viewBox="0 0 360 220"
      width="100%"
      style={{ maxWidth: 360, alignSelf: 'center', display: 'block' }}
      role="img"
      aria-label="macOS menu bar with Vox icon"
    >
      <defs>
        <pattern id="grid-mb" width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M14 0H0V14" fill="none" stroke="var(--hud-line, oklch(0.32 0.012 240))" strokeWidth="0.5" opacity="0.3" />
        </pattern>
      </defs>

      <rect x="0" y="0" width="360" height="220" fill="url(#grid-mb)" />

      {/* Mac chrome silhouette */}
      <rect
        x="20"
        y="34"
        width="320"
        height="160"
        fill="none"
        stroke="var(--hud-line-strong, oklch(0.48 0.012 240))"
        strokeWidth="1.2"
      />
      <line x1="20" y1="58" x2="340" y2="58" stroke="var(--hud-line-strong, oklch(0.48 0.012 240))" strokeWidth="1.2" />

      {/* Apple menu */}
      <text
        x="32"
        y="50"
        fontFamily="var(--hud-font-mono, ui-monospace, monospace)"
        fontSize="11"
        fill="var(--hud-ink-1, oklch(0.86 0.005 240))"
      ></text>
      <text
        x="50"
        y="50"
        fontFamily="var(--hud-font-mono, ui-monospace, monospace)"
        fontSize="9"
        letterSpacing="1"
        fill="var(--hud-ink-2, oklch(0.66 0.008 240))"
      >
        Hudson
      </text>
      <text
        x="92"
        y="50"
        fontFamily="var(--hud-font-mono, ui-monospace, monospace)"
        fontSize="9"
        letterSpacing="1"
        fill="var(--hud-ink-3, oklch(0.50 0.01 240))"
      >
        File  Edit  View
      </text>

      {/* Vox icon (highlighted) — mic glyph in a small box */}
      <g transform="translate(290, 38)">
        <rect
          x="-1"
          y="-1"
          width="22"
          height="22"
          fill="var(--hud-accent-soft, oklch(0.72 0.18 162 / 0.10))"
          stroke="var(--hud-accent, oklch(0.72 0.18 162))"
          strokeWidth="1"
        />
        {/* mic */}
        <rect
          x="7"
          y="3"
          width="6"
          height="9"
          rx="3"
          fill="none"
          stroke="var(--hud-accent, oklch(0.72 0.18 162))"
          strokeWidth="1"
        />
        <path d="M5 11 a5 5 0 0 0 10 0" fill="none" stroke="var(--hud-accent, oklch(0.72 0.18 162))" strokeWidth="1" />
        <line x1="10" y1="16" x2="10" y2="18" stroke="var(--hud-accent, oklch(0.72 0.18 162))" strokeWidth="1" />
      </g>

      {/* Time */}
      <text
        x="324"
        y="50"
        textAnchor="end"
        fontFamily="var(--hud-font-mono, ui-monospace, monospace)"
        fontSize="9"
        letterSpacing="1"
        fill="var(--hud-ink-3, oklch(0.50 0.01 240))"
      >
        11 : 07
      </text>

      {/* Dim leader pointing to Vox icon */}
      <path
        d="M 300 70 L 280 96 L 200 96"
        fill="none"
        stroke="var(--hud-accent, oklch(0.72 0.18 162))"
        strokeWidth="0.8"
      />
      <circle cx="300" cy="70" r="2" fill="var(--hud-accent, oklch(0.72 0.18 162))" />
      <text
        x="196"
        y="93"
        textAnchor="end"
        fontFamily="var(--hud-font-mono, ui-monospace, monospace)"
        fontSize="9"
        letterSpacing="2"
        fill="var(--hud-accent, oklch(0.72 0.18 162))"
      >
        VOX · MENU BAR
      </text>
      <text
        x="196"
        y="106"
        textAnchor="end"
        fontFamily="var(--hud-font-mono, ui-monospace, monospace)"
        fontSize="8"
        letterSpacing="1.6"
        fill="var(--hud-ink-3, oklch(0.50 0.01 240))"
      >
        always-on companion
      </text>

      {/* App body */}
      <rect
        x="32"
        y="72"
        width="120"
        height="110"
        fill="none"
        stroke="var(--hud-line, oklch(0.32 0.012 240))"
        strokeWidth="0.8"
        strokeDasharray="3 3"
      />
      <text
        x="38"
        y="90"
        fontFamily="var(--hud-font-mono, ui-monospace, monospace)"
        fontSize="8"
        letterSpacing="1.6"
        fill="var(--hud-ink-3, oklch(0.50 0.01 240))"
      >
        YOUR APP
      </text>
    </svg>
  );
}

// ─── Phase: Connect (Vox running, origin not allowed) ────────────────────────

function Connect({ launchUrl }: { launchUrl: string }) {
  return (
    <Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18, maxWidth: 540 }}>
        <Caption color="accent">Vox is running ✓ · permission needed</Caption>
        <h2 style={H2}>Allow this page to talk to Vox.</h2>
        <p style={SUB}>
          Vox keeps an allowlist so only pages you trust can use your microphone. One
          click hands this origin to Vox — it&rsquo;ll prompt you to confirm.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          <a href={launchUrl} target="_top" rel="noopener noreferrer" style={PrimaryButton}>
            ⏵ Open Vox · grant access
          </a>
        </div>
        <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
          <Bullet>Vox.app will appear; press “Allow”.</Bullet>
          <Bullet>Return here — the loop activates instantly.</Bullet>
        </ul>
      </div>
    </Card>
  );
}

// ─── Phase: Ready ────────────────────────────────────────────────────────────
//
// The Ready test panel uses Vox's native LiveSession — Vox itself captures
// the audio (it already has macOS-level mic permission as a registered app),
// the embed just sends start/stop control signals over loopback. The browser
// never touches getUserMedia, so the embed works without iframe-permissions
// gymnastics or a per-origin mic prompt.

type LiveStatus = 'idle' | SessionState;

function Ready({ voxClient }: { voxClient: VoxDClient | null }) {
  const [state, setState] = useState<LiveStatus>('idle');
  const [partial, setPartial] = useState('');
  const [finalText, setFinalText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);

  // Cleanup any in-flight session on unmount.
  useEffect(() => {
    return () => {
      sessionRef.current?.close();
      sessionRef.current = null;
    };
  }, []);

  const start = useCallback(async () => {
    if (!voxClient) return;
    setError(null);
    setPartial('');
    setFinalText('');
    setState('starting');

    const session = voxClient.createLiveSession();
    sessionRef.current = session;

    const offState = session.onState((e) => setState(e.state));
    const offPartial = session.onPartial((e) => setPartial(e.text));
    const offError = session.onError((err) => {
      setError(err.message || 'Vox returned an error.');
      setState('error');
    });

    try {
      const final = await session.start();
      setFinalText(final.text);
    } catch (err) {
      // onError already handled UI state; swallow so the promise rejection
      // doesn't bubble. session may have ended in 'cancelled' — that's fine.
      if (err instanceof Error && !error) setError(err.message);
    } finally {
      offState();
      offPartial();
      offError();
      sessionRef.current = null;
    }
  }, [voxClient, error]);

  const stop = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    try {
      await s.stop();
    } catch {
      /* swallow — onError already populates state */
    }
  }, []);

  const isRecording = state === 'recording';
  const isStarting = state === 'starting';
  const isProcessing = state === 'processing';
  const isBusy = isStarting || isProcessing;
  const hasFinal = state === 'done' && !!finalText;

  const handleClick = useCallback(() => {
    if (isRecording) void stop();
    else if (!isBusy) void start();
  }, [isRecording, isBusy, start, stop]);

  const buttonLabel = isRecording
    ? '■  Stop'
    : isStarting
      ? '·  Warming up…'
      : isProcessing
        ? '·  Transcribing…'
        : hasFinal
          ? '↻  Try again'
          : '●  Press to speak';

  const buttonBg = isRecording
    ? 'oklch(0.62 0.18 25)'
    : isBusy
      ? 'var(--hud-bg-3, oklch(0.28 0.005 240))'
      : 'var(--hud-accent, oklch(0.72 0.18 162))';

  return (
    <Card>
      <Caption color="accent">Voice loop · active · test live</Caption>
      <h2 style={H2}>You&rsquo;re wired up.</h2>
      <p style={SUB}>
        Press to start, click again to stop. Vox handles the capture and transcription on your
        machine — the browser never touches your microphone.
      </p>

      <div
        style={{
          marginTop: 18,
          border: 'var(--hud-border-width, 1px) solid var(--hud-line-strong, oklch(0.48 0.012 240))',
          background: 'var(--hud-bg-2, oklch(0.20 0.005 240))',
          padding: 18,
          display: 'grid',
          gridTemplateColumns: '180px 1fr',
          gap: 18,
          alignItems: 'stretch',
          minHeight: 120,
        }}
      >
        <button
          type="button"
          onClick={handleClick}
          disabled={!voxClient || isBusy}
          aria-pressed={isRecording}
          style={{
            background: buttonBg,
            color: isBusy
              ? 'var(--hud-ink-2, oklch(0.66 0.008 240))'
              : isRecording
                ? 'oklch(0.98 0.01 30)'
                : 'var(--hud-bg, oklch(0.18 0.02 240))',
            fontFamily: 'var(--hud-font-mono, ui-monospace, monospace)',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            border: 'var(--hud-border-width, 1px) solid currentColor',
            cursor: isBusy ? 'progress' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px 14px',
            position: 'relative',
            animation: isRecording ? 'voxRecordPulse 1.2s ease-in-out infinite' : 'none',
          }}
        >
          {buttonLabel}
          <style>{`
            @keyframes voxRecordPulse {
              0%, 100% { box-shadow: 0 0 0 0 oklch(0.62 0.18 25 / 0.35); }
              50% { box-shadow: 0 0 0 8px oklch(0.62 0.18 25 / 0); }
            }
          `}</style>
        </button>

        <TranscriptPane
          state={state}
          partial={partial}
          finalText={finalText}
          error={error}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          marginTop: 14,
        }}
      >
        <SmallStep
          n="01"
          t="Pin to menu bar"
          b="Vox lives in your menu bar. Keep its icon visible to see when it's listening."
        />
        <SmallStep
          n="02"
          t="Wire it into Hudson"
          b="Hudson owns the start/stop. Bind voice to ⌘K, a hotkey, or push-to-talk inside your app."
          href="https://app.hudsonos.com"
        />
      </div>
    </Card>
  );
}

function TranscriptPane({
  state,
  partial,
  finalText,
  error,
}: {
  state: LiveStatus;
  partial: string;
  finalText: string;
  error: string | null;
}) {
  const baseStyle: CSSProperties = {
    fontFamily: 'var(--hud-font-mono, ui-monospace, monospace)',
    fontSize: 12,
    lineHeight: 1.55,
    padding: '10px 14px',
    border: 'var(--hud-border-width, 1px) solid var(--hud-line, oklch(0.32 0.012 240))',
    minHeight: '100%',
    display: 'flex',
    alignItems: 'center',
    background: 'var(--hud-bg, oklch(0.18 0.02 240))',
  };

  if (error) {
    return (
      <div style={{ ...baseStyle, color: 'oklch(0.78 0.16 25)' }}>⚠ {error}</div>
    );
  }

  if (state === 'starting') {
    return (
      <div style={{ ...baseStyle, color: 'var(--hud-ink-2, oklch(0.66 0.008 240))' }}>
        Vox is warming up the model…
      </div>
    );
  }

  if (state === 'recording') {
    return (
      <div
        style={{
          ...baseStyle,
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: 6,
          color: 'var(--hud-ink-1, oklch(0.86 0.005 240))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              background: 'oklch(0.62 0.18 25)',
              animation: 'voxBlink 0.9s ease-in-out infinite',
            }}
          />
          <span
            style={{
              fontSize: 9,
              letterSpacing: '0.20em',
              textTransform: 'uppercase',
              color: 'var(--hud-ink-3, oklch(0.50 0.01 240))',
            }}
          >
            Vox listening
          </span>
        </div>
        <div
          style={{
            fontSize: 13,
            color: partial ? 'var(--hud-ink, oklch(0.94 0.005 240))' : 'var(--hud-ink-3, oklch(0.50 0.01 240))',
          }}
        >
          {partial || '…'}
        </div>
        <style>{`
          @keyframes voxBlink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.2; }
          }
        `}</style>
      </div>
    );
  }

  if (state === 'processing') {
    return (
      <div style={{ ...baseStyle, color: 'var(--hud-ink-2, oklch(0.66 0.008 240))' }}>
        Vox finalizing the transcript…
      </div>
    );
  }

  if (state === 'done' && finalText) {
    return (
      <div
        style={{
          ...baseStyle,
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: 6,
          color: 'var(--hud-ink, oklch(0.94 0.005 240))',
        }}
      >
        <div
          style={{
            fontSize: 9,
            letterSpacing: '0.20em',
            textTransform: 'uppercase',
            color: 'var(--hud-accent, oklch(0.72 0.18 162))',
          }}
        >
          Transcript
        </div>
        <div style={{ fontSize: 13 }}>“{finalText}”</div>
      </div>
    );
  }

  return (
    <div style={{ ...baseStyle, color: 'var(--hud-ink-3, oklch(0.50 0.01 240))' }}>
      Try “open scratch”, “make a TODO”, or any phrase. Your transcript will appear here.
    </div>
  );
}

function SmallStep({ n, t, b, href }: { n: string; t: string; b: string; href?: string }) {
  const inner = (
    <div
      style={{
        border: 'var(--hud-border-width, 1px) solid var(--hud-line, oklch(0.32 0.012 240))',
        padding: '10px 12px 12px',
        display: 'grid',
        gap: 4,
        background: 'transparent',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--hud-font-mono, ui-monospace, monospace)',
          fontSize: 9,
          letterSpacing: '0.20em',
          color: 'var(--hud-accent, oklch(0.72 0.18 162))',
        }}
      >
        {n}
      </div>
      <div
        style={{
          fontFamily: 'var(--hud-font-mono, ui-monospace, monospace)',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--hud-ink-1, oklch(0.86 0.005 240))',
        }}
      >
        {t}
        {href && <span style={{ color: 'var(--hud-ink-3, oklch(0.50 0.01 240))' }}> ↗</span>}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 11,
          lineHeight: 1.5,
          color: 'var(--hud-ink-2, oklch(0.66 0.008 240))',
        }}
      >
        {b}
      </p>
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_top" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
        {inner}
      </a>
    );
  }
  return inner;
}

// ─── Atoms ───────────────────────────────────────────────────────────────────

function Card({ children }: { children: ReactNode }) {
  return <div style={{ width: '100%', maxWidth: 760 }}>{children}</div>;
}

function Caption({ children, color }: { children: ReactNode; color?: 'accent' }) {
  return (
    <div
      style={{
        fontFamily: 'var(--hud-font-mono, ui-monospace, monospace)',
        fontSize: 10,
        letterSpacing: '0.20em',
        textTransform: 'uppercase',
        color:
          color === 'accent'
            ? 'var(--hud-accent, oklch(0.72 0.18 162))'
            : 'var(--hud-ink-3, oklch(0.50 0.01 240))',
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: '14px 1fr',
        gap: 10,
        fontSize: 12,
        color: 'var(--hud-ink-2, oklch(0.66 0.008 240))',
        lineHeight: 1.5,
      }}
    >
      <span style={{ color: 'var(--hud-ink-3, oklch(0.50 0.01 240))' }}>·</span>
      <span>{children}</span>
    </li>
  );
}

const H2: CSSProperties = {
  fontFamily: 'var(--hud-font-display, "Times New Roman", serif)',
  fontSize: 28,
  fontWeight: 400,
  lineHeight: 1.15,
  margin: '0 0 12px',
  color: 'var(--hud-ink, oklch(0.94 0.005 240))',
  letterSpacing: '-0.01em',
};

const SUB: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.6,
  color: 'var(--hud-ink-2, oklch(0.66 0.008 240))',
  maxWidth: 480,
};

const PrimaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 18px',
  background: 'var(--hud-accent, oklch(0.72 0.18 162))',
  color: 'var(--hud-bg, oklch(0.18 0.02 240))',
  fontFamily: 'var(--hud-font-mono, ui-monospace, monospace)',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  border: 'var(--hud-border-width, 1px) solid var(--hud-accent, oklch(0.72 0.18 162))',
  cursor: 'pointer',
};

const GhostButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '10px 16px',
  background: 'transparent',
  color: 'var(--hud-ink-1, oklch(0.86 0.005 240))',
  fontFamily: 'var(--hud-font-mono, ui-monospace, monospace)',
  fontSize: 12,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  border: 'var(--hud-border-width, 1px) solid var(--hud-line-strong, oklch(0.48 0.012 240))',
};
