'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { decodeThemeForEmbed, inlineThemeStyle } from '@/marketing/lib/embed-theme';
import './workspace-mock.css';

// ─── Theme + handshake ──────────────────────────────────────────────────────

function consumerClassName(ref: string | null | undefined): string | undefined {
  if (!ref) return undefined;
  return `embed-theme-${ref}`;
}

const ALLOWED_ORIGINS = (() => {
  const list = new Set<string>();
  if (typeof window !== 'undefined') list.add(window.location.origin);
  const env = process.env.NEXT_PUBLIC_HUDSON_EMBED_ORIGINS ?? '';
  for (const o of env.split(',').map((s) => s.trim()).filter(Boolean)) list.add(o);
  return list;
})();

function isAllowedOrigin(origin: string) {
  if (typeof window !== 'undefined' && origin === window.location.origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (ALLOWED_ORIGINS.has('*')) return true;
  return false;
}

function applyTokens(vars: unknown) {
  if (!vars || typeof vars !== 'object') return;
  for (const [k, v] of Object.entries(vars as Record<string, unknown>)) {
    if (typeof k === 'string' && k.startsWith('--hud-') && typeof v === 'string') {
      document.documentElement.style.setProperty(k, v);
    }
  }
}

// ─── Nav / activity content ─────────────────────────────────────────────────

const NAV_APPS: Array<{ id: string; sub: string; active?: boolean }> = [
  { id: 'talkie', sub: 'ios · macos' },
  { id: 'scout-ops', sub: 'ios', active: true },
  { id: 'logo-studio', sub: 'web' },
  { id: 'vox', sub: 'menu bar' },
];

const NAV_SECTIONS = ['Manifest', 'Primitives', 'Voice / AI', 'Settings'];

const ACTIVITY_SEED = [
  { ts: '00:00', kw: 'init', text: 'shell mounted' },
  { ts: '00:01', kw: 'idx', text: '16 intents resolved' },
  { ts: '00:01', kw: 'cmd', text: '45 commands live' },
  { ts: '00:02', kw: 'ai', text: 'capability map exposed' },
];

const ACTIVITY_FEED = [
  { kw: 'evt', text: 'intent · transcribe · resolved' },
  { kw: 'svc', text: 'voice ↔ vox · handshake ok' },
  { kw: 'cmd', text: '⌘K · "transcribe this" · 92% match' },
  { kw: 'idx', text: 're-indexed 3 intents' },
  { kw: 'evt', text: 'capability map · refresh' },
  { kw: 'cmd', text: '⌘K · "switch workspace" · 88% match' },
  { kw: 'svc', text: 'ai.copilot · stream open' },
];

const BUILD_STEPS: Array<{ n: string; verb: string; body: string; code: string }> = [
  { n: '01', verb: 'DECLARE', body: 'typed manifest', code: "{ id: 'talkie',\n  mode: 'canvas' }" },
  { n: '02', verb: 'WIRE', body: 'intents indexed', code: '→ ⌘K\n→ voice' },
  { n: '03', verb: 'COMPOSE', body: 'drop primitives', code: '<Frame>\n  <Nav/>\n</Frame>' },
  { n: '04', verb: 'RUN', body: 'standard dev', code: '$ bun dev' },
];

function fmtUptime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface WorkspaceEmbedClientProps {
  themeClassName?: string;
  themeStyle?: React.CSSProperties;
}

export default function WorkspaceEmbedClient({
  themeClassName: themeClassNameProp,
  themeStyle: themeStyleProp,
}: WorkspaceEmbedClientProps) {
  const searchParams = useSearchParams();

  let themeStyle = themeStyleProp;
  let themeClassName = themeClassNameProp;
  if (!themeStyle) {
    const palette = searchParams.get('palette');
    if (palette) {
      const decoded = decodeThemeForEmbed(palette);
      if (decoded) themeStyle = inlineThemeStyle(decoded) as React.CSSProperties;
    }
  }
  if (!themeStyle && !themeClassName) {
    const ref = searchParams.get('ref');
    themeClassName = consumerClassName(ref ?? undefined);
  }

  const sentReady = useRef(false);
  const [uptimeSec, setUptimeSec] = useState(3);
  const [logTail, setLogTail] = useState<Array<{ ts: string; kw: string; text: string }>>([]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!isAllowedOrigin(e.origin)) return;
      const data = e.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'hudson:embed-context' && data.context) {
        const ctx = data.context;
        applyTokens(ctx.palette);
        applyTokens(ctx.fonts);
        if (ctx.layout?.density) document.documentElement.dataset.density = ctx.layout.density;
        if (ctx.surface) document.documentElement.dataset.surface = ctx.surface;
      } else if (data.type === 'hudson:theme-sync') {
        applyTokens(data.vars);
      }
    }
    window.addEventListener('message', onMessage);
    if (window.parent !== window && !sentReady.current) {
      sentReady.current = true;
      window.parent.postMessage(
        { type: 'hudson:embed-ready', surfaceId: 'workspace', sizing: { mode: 'fill' } },
        '*',
      );
    }
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setUptimeSec((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setLogTail((tail) => {
        const next = ACTIVITY_FEED[(tail.length + Math.floor(uptimeSec / 4)) % ACTIVITY_FEED.length];
        const ts = fmtUptime(uptimeSec);
        return [...tail, { ts, ...next }].slice(-3);
      });
    }, 4000);
    return () => clearInterval(id);
  }, [uptimeSec]);

  const wrapperClass = ['workspace', themeClassName].filter(Boolean).join(' ');

  return (
    <div className={wrapperClass} style={themeStyle}>
      <header className="workspace__top">
        <span className="workspace__brand">H&nbsp;hudson</span>
        <span className="workspace__spacer" />
        <span className="workspace__meta">workspace · self</span>
        <span className="workspace__kbd">⌘K</span>
      </header>

      <div className="workspace__body">
        <aside className="workspace__nav">
          <div className="workspace__nav-section">
            <div className="workspace__nav-cap">apps</div>
            {NAV_APPS.map((app) => (
              <div
                key={app.id}
                className={'workspace__nav-row' + (app.active ? ' workspace__nav-row--active' : '')}
              >
                <span className="workspace__nav-bullet">▸</span>
                <span className="workspace__nav-id">{app.id}</span>
                <span className="workspace__nav-sub">{app.sub}</span>
              </div>
            ))}
          </div>
          <div className="workspace__nav-section">
            <div className="workspace__nav-cap">sections</div>
            {NAV_SECTIONS.map((s) => (
              <div key={s} className="workspace__nav-row">
                <span className="workspace__nav-bullet">·</span>
                <span className="workspace__nav-id">{s}</span>
              </div>
            ))}
          </div>
        </aside>

        <main className="workspace__hero">
          <div className="workspace__hero-eyebrow">— Hudson embed</div>
          <h2 className="workspace__hero-title">
            This component is a <span className="accent">Hudson embed.</span>
          </h2>
          <p className="workspace__hero-body">
            Everything you see around this text — nav, panels, status, the chrome — is a real Hudson
            primitive. Same shell any app inherits.
          </p>

          <div className="workspace__build">
            <div className="workspace__build-cap">
              <span>build sequence</span>
              <span className="workspace__build-flow">DECLARE → WIRE → COMPOSE → RUN</span>
            </div>
            <div className="workspace__build-grid">
              {BUILD_STEPS.map((s) => (
                <div key={s.n} className="workspace__step">
                  <div className="workspace__step-head">§ STEP {s.n}</div>
                  <div className="workspace__step-action">
                    <span className="workspace__step-num">{s.n.replace(/^0/, '')}</span>
                    {s.verb}
                  </div>
                  <div className="workspace__step-body">{s.body}</div>
                  <pre className="workspace__step-code">{s.code}</pre>
                </div>
              ))}
            </div>
          </div>
        </main>

        <aside className="workspace__info">
          <div className="workspace__info-section">
            <div className="workspace__info-cap">runtime</div>
            <div className="workspace__stats">
              <div className="workspace__stat"><span className="k">uptime</span><span>{fmtUptime(uptimeSec)}</span></div>
              <div className="workspace__stat"><span className="k">intents</span><span>16</span></div>
              <div className="workspace__stat"><span className="k">commands</span><span>{45 + Math.floor(uptimeSec / 6)}</span></div>
              <div className="workspace__stat"><span className="k">voice</span><span className="accent">vox</span></div>
              <div className="workspace__stat"><span className="k">ai.model</span><span>gemini-3-flash</span></div>
            </div>
          </div>

          <div className="workspace__info-section">
            <div className="workspace__info-cap">activity</div>
            <div className="workspace__log">
              {ACTIVITY_SEED.map((row, i) => (
                <div key={`seed-${i}`}>
                  <span className="ts">{row.ts}</span>
                  <span className="kw">{row.kw}</span>
                  {row.text}
                </div>
              ))}
              {logTail.map((row, i) => (
                <div key={`live-${i}`}>
                  <span className="ts">{row.ts}</span>
                  <span className="kw">{row.kw}</span>
                  {row.text}
                </div>
              ))}
              <div><span className="ts">{fmtUptime(uptimeSec)}</span><span className="kw ok">ok</span>ready<span className="cursor" /></div>
            </div>
          </div>
        </aside>
      </div>

      <footer className="workspace__bottom">
        <span className="workspace__bottom-state">● ready</span>
        <span className="workspace__bottom-sep">·</span>
        <span>uptime {fmtUptime(uptimeSec)}</span>
        <span className="workspace__bottom-sep">·</span>
        <span>16 intents · {45 + Math.floor(uptimeSec / 6)} commands</span>
        <span className="workspace__spacer" />
        <span>hudson · dark</span>
      </footer>
    </div>
  );
}
