'use client';

// ─────────────────────────────────────────────────────────────────────────────
// EmbedDocs — Getting-started docs preview for /embed/<appId>/docs
// ─────────────────────────────────────────────────────────────────────────────
// A focused preview of Hudson's getting-started material, served as an embed
// so consumer sites can drop in a real docs surface (not a marketing recreation)
// with a clear path to the full workspace experience.
//
// Three topic cards: Manifest, Primitives, Voice/AI. Each is a short excerpt +
// code snippet + "Read in workspace" link that opens the corresponding doc page
// in the parent tab (so visitors can keep the marketing scroll behind).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type CSSProperties } from 'react';

const WORKSPACE_URL = 'https://app.hudsonkit.com/?focus=hudson-docs';

interface Topic {
  id: string;
  num: string;
  title: string;
  pitch: string;
  code: string;
  hash: string;
}

const TOPICS: Topic[] = [
  {
    id: 'manifest',
    num: '01',
    title: 'Manifest',
    pitch:
      'Every app declares a typed manifest — id, mode, intents, takeover. Hudson reads it once at boot and wires the rest.',
    code: `export const manifest: HudsonApp = {
  id: 'talkie',
  mode: 'canvas',
  intents: [openScratch, makeNote],
};`,
    hash: 'manifest',
  },
  {
    id: 'primitives',
    num: '02',
    title: 'Primitives',
    pitch:
      'Eight components — Frame, Nav, Panel, Status, Canvas, Palette, Drawer, Voice. Drop them in, they share state through the Hudson context.',
    code: `<Frame>
  <Nav title="MYAPP" />
  <Panel side="left">{tree}</Panel>
  <Canvas>{world}</Canvas>
</Frame>`,
    hash: 'primitives',
  },
  {
    id: 'voice',
    num: '03',
    title: 'Voice / AI',
    pitch:
      'One hook for capture, one for replies. Vox runs locally; audio never leaves the machine. Same intents work by keystroke or voice.',
    code: `const { start, stop } = useVoiceInput({
  onTranscript: dispatchIntent,
  surface: 'myapp',
});`,
    hash: 'voice-ai',
  },
];

export function EmbedDocs() {
  const [activeId, setActiveId] = useState<string>(TOPICS[0].id);
  const active = TOPICS.find((t) => t.id === activeId) ?? TOPICS[0];

  return (
    <div style={ROOT}>
      <Header />
      <div style={BODY}>
        <aside style={SIDEBAR}>
          <div style={SIDEBAR_CAP}>Topics</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {TOPICS.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(t.id)}
                  aria-pressed={t.id === activeId}
                  style={topicButtonStyle(t.id === activeId)}
                >
                  <span style={{ color: 'var(--hud-accent, oklch(0.72 0.18 162))', marginRight: 10 }}>
                    {t.num}
                  </span>
                  {t.title}
                </button>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 'auto', paddingTop: 18 }}>
            <a href={`${WORKSPACE_URL}#${active.hash}`} target="_top" rel="noopener noreferrer" style={CTA_PRIMARY}>
              ↗ Open in workspace
            </a>
          </div>
        </aside>

        <article style={ARTICLE}>
          <div style={ARTICLE_HEAD}>
            <span style={ARTICLE_NUM}>{active.num}</span>
            <h2 style={ARTICLE_TITLE}>{active.title}</h2>
          </div>
          <p style={ARTICLE_PITCH}>{active.pitch}</p>
          <pre style={CODE_BLOCK}>
            <code>{active.code}</code>
          </pre>
          <a
            href={`${WORKSPACE_URL}#${active.hash}`}
            target="_top"
            rel="noopener noreferrer"
            style={READ_MORE}
          >
            Read the full {active.title.toLowerCase()} docs →
          </a>
        </article>
      </div>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header style={HEADER}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
        <span style={HEADER_LABEL}>HudsonKit · docs</span>
        <span style={HEADER_SUB}>getting started</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <a href={WORKSPACE_URL} target="_top" rel="noopener noreferrer" style={CTA_GHOST}>
          ⛶ Open full
        </a>
        <a href={WORKSPACE_URL} target="_blank" rel="noopener noreferrer" style={CTA_GHOST}>
          ↗ New tab
        </a>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer style={FOOTER}>
      <span>app.hudsonkit.com/docs</span>
      <span>v0.2 · live</span>
    </footer>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const ROOT: CSSProperties = {
  minHeight: '100%',
  width: '100%',
  background: 'var(--hud-bg, oklch(0.18 0.02 240))',
  color: 'var(--hud-ink, oklch(0.94 0.005 240))',
  fontFamily: 'var(--hud-font-body, system-ui, sans-serif)',
  display: 'grid',
  gridTemplateRows: 'auto 1fr auto',
};

const HEADER: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 22px',
  borderBottom: 'var(--hud-border-width, 1px) solid var(--hud-line, oklch(0.32 0.012 240))',
};

const HEADER_LABEL: CSSProperties = {
  fontFamily: 'var(--hud-font-mono, ui-monospace, monospace)',
  fontSize: 11,
  letterSpacing: '0.20em',
  textTransform: 'uppercase',
  color: 'var(--hud-ink, oklch(0.94 0.005 240))',
};

const HEADER_SUB: CSSProperties = {
  fontFamily: 'var(--hud-font-mono, ui-monospace, monospace)',
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--hud-ink-3, oklch(0.50 0.01 240))',
};

const BODY: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '220px 1fr',
  minHeight: 0,
};

const SIDEBAR: CSSProperties = {
  borderRight: 'var(--hud-border-width, 1px) solid var(--hud-line, oklch(0.32 0.012 240))',
  padding: '22px 18px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  background: 'var(--hud-bg-2, oklch(0.20 0.005 240))',
};

const SIDEBAR_CAP: CSSProperties = {
  fontFamily: 'var(--hud-font-mono, ui-monospace, monospace)',
  fontSize: 10,
  letterSpacing: '0.20em',
  textTransform: 'uppercase',
  color: 'var(--hud-ink-3, oklch(0.50 0.01 240))',
  marginBottom: 10,
};

function topicButtonStyle(active: boolean): CSSProperties {
  return {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '10px 12px',
    background: active
      ? 'var(--hud-bg-3, oklch(0.28 0.005 240))'
      : 'transparent',
    border: 'var(--hud-border-width, 1px) solid',
    borderColor: active
      ? 'var(--hud-line-strong, oklch(0.48 0.012 240))'
      : 'transparent',
    color: active
      ? 'var(--hud-ink, oklch(0.94 0.005 240))'
      : 'var(--hud-ink-1, oklch(0.86 0.005 240))',
    fontFamily: 'var(--hud-font-mono, ui-monospace, monospace)',
    fontSize: 12,
    letterSpacing: '0.08em',
    cursor: 'pointer',
    marginBottom: 4,
  };
}

const ARTICLE: CSSProperties = {
  padding: '26px 30px',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  minWidth: 0,
};

const ARTICLE_HEAD: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 14,
};

const ARTICLE_NUM: CSSProperties = {
  fontFamily: 'var(--hud-font-display, "Times New Roman", serif)',
  fontSize: 30,
  color: 'var(--hud-accent, oklch(0.72 0.18 162))',
  lineHeight: 1,
};

const ARTICLE_TITLE: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--hud-font-display, "Times New Roman", serif)',
  fontSize: 26,
  fontWeight: 400,
  lineHeight: 1.1,
  color: 'var(--hud-ink, oklch(0.94 0.005 240))',
  letterSpacing: '-0.01em',
};

const ARTICLE_PITCH: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.6,
  color: 'var(--hud-ink-2, oklch(0.66 0.008 240))',
  maxWidth: 540,
};

const CODE_BLOCK: CSSProperties = {
  margin: 0,
  padding: '14px 16px',
  background: 'var(--hud-bg, oklch(0.18 0.02 240))',
  border: 'var(--hud-border-width, 1px) solid var(--hud-line, oklch(0.32 0.012 240))',
  fontFamily: 'var(--hud-font-mono, ui-monospace, monospace)',
  fontSize: 11.5,
  lineHeight: 1.55,
  color: 'var(--hud-ink-1, oklch(0.86 0.005 240))',
  overflow: 'auto',
};

const READ_MORE: CSSProperties = {
  fontFamily: 'var(--hud-font-mono, ui-monospace, monospace)',
  fontSize: 11,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  color: 'var(--hud-accent, oklch(0.72 0.18 162))',
  textDecoration: 'none',
  marginTop: 4,
};

const FOOTER: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '10px 22px',
  borderTop: 'var(--hud-border-width, 1px) solid var(--hud-line, oklch(0.32 0.012 240))',
  fontFamily: 'var(--hud-font-mono, ui-monospace, monospace)',
  fontSize: 9,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--hud-ink-3, oklch(0.50 0.01 240))',
};

const CTA_PRIMARY: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  padding: '10px 14px',
  background: 'var(--hud-accent, oklch(0.72 0.18 162))',
  color: 'var(--hud-bg, oklch(0.18 0.02 240))',
  fontFamily: 'var(--hud-font-mono, ui-monospace, monospace)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  border: 'var(--hud-border-width, 1px) solid var(--hud-accent, oklch(0.72 0.18 162))',
};

const CTA_GHOST: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  background: 'transparent',
  color: 'var(--hud-ink-1, oklch(0.86 0.005 240))',
  fontFamily: 'var(--hud-font-mono, ui-monospace, monospace)',
  fontSize: 10,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  border: 'var(--hud-border-width, 1px) solid var(--hud-line-strong, oklch(0.48 0.012 240))',
};
