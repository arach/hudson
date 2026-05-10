'use client';

import { useState } from 'react';
import { HudsonEmbed } from '@/marketing/lib/embed';
import { EmbedFrame } from '@/marketing/primitives/EmbedFrame';
import { Eyebrow } from '@/marketing/primitives/Eyebrow';
import { Sheet } from '@/marketing/primitives/Sheet';

const SPEC: Array<[string, string, boolean?]> = [
  ['NAV.HEIGHT', '48 px'],
  ['PANEL.WIDTH', '280 px'],
  ['STATUS.HEIGHT', '28 px'],
  ['ACCENT', 'var(--accent)'],
  ['INTENTS', '16 indexed', true],
  ['COMMANDS', '45 live', true],
  ['LATENCY', '< 80 ms (vox→cmd)', true],
  ['SURFACES', 'iOS · macOS · Web'],
  ['THEME', 'hudson · dark'],
  ['VERSION', 'v0.4.2'],
];

const PARTS = [
  { n: '01', t: 'DECLARE', l: 'A typed object names your app.', b: 'id, mode, intents, ports — Hudson reads it like a blueprint.' },
  { n: '02', t: 'WIRE', l: 'Intents become voice + ⌘K.', b: 'Each entry is indexed for fuzzy match, hotkeys, and the assistant.' },
  { n: '03', t: 'COMPOSE', l: 'Drop in primitives.', b: 'Frame, Nav, Panel, Canvas, Status — same chrome every app inherits.' },
  { n: '04', t: 'SHIP', l: 'Three surfaces, zero forks.', b: 'iOS through TestFlight, macOS notarized, Web via CDN. One command.' },
];

type Layout = 'stack' | 'toggle';

const LAYOUT_OPTIONS: Array<{ id: Layout; label: string }> = [
  { id: 'stack', label: 'Stack' },
  { id: 'toggle', label: 'Toggle' },
];

export function Sheet02Possession() {
  const [layout, setLayout] = useState<Layout>('stack');
  const [active, setActive] = useState<'mock' | 'live'>('mock');

  return (
    <Sheet
      id="possession"
      num="02"
      slugTitle="LIVE WORKSPACE"
      slugSub="elevation · 1:1 scale"
      sheetTitle="Possession Mode — Live Embed"
      footer={{
        left: ['SHEET', '02 / 07'],
        mid: 'LIVE EMBED · POSSESSION MODE — workspace = self',
        right: ['SCALE', '1 : 1'],
      }}
    >
      <div style={{ maxWidth: 1300, margin: '60px auto 0' }}>
        <div style={{ marginBottom: 24 }}>
          <Eyebrow>02 / Live Embed · spec ↔ live</Eyebrow>
        </div>

        <h2 className="h-section" style={{ marginBottom: 20 }}>
          The component <em>below</em> is a Hudson embed.
        </h2>

        <p className="subhead" style={{ marginBottom: 32, fontSize: 17 }}>
          The same workspace shell twice. <strong>Mock</strong>: a stripped-down schematic — same
          design language, same colors, no recreated content. <strong>Live</strong>: the real
          primitives, rendered from the SDK. Same chrome any Hudson app inherits.
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 18,
            gap: 18,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.20em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            FIG. 02 · LAYOUT
          </span>
          <LayoutToggle layout={layout} setLayout={setLayout} />
        </div>

        <div style={{ marginBottom: 56 }}>
          {layout === 'stack' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
              <EmbedSlot kind="mock" height={720} />
              <EmbedSlot kind="live" height={720} />
            </div>
          )}

          {layout === 'toggle' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  gap: 6,
                  marginBottom: 14,
                }}
              >
                <ActiveButton current={active} target="mock" set={setActive} label="MOCK · spec" />
                <ActiveButton current={active} target="live" set={setActive} label="LIVE · primitives" />
              </div>
              <EmbedSlot kind={active} height={720} />
            </div>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 320px',
            gap: 40,
            alignItems: 'start',
            marginBottom: 64,
          }}
        >
          <div style={{ alignSelf: 'start' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.12em',
                color: 'var(--ink-2)',
                textTransform: 'uppercase',
                paddingTop: 12,
                borderTop: '1px solid var(--line)',
              }}
            >
              <span>① CAPABILITY MAP</span>
              <span>② COMMAND DOCK</span>
              <span>③ STATUS BAR</span>
              <span>④ CANVAS · pan/zoom</span>
            </div>
          </div>

          <div>
            <div className="spec" data-cal data-cal-label="manifest spec">
              <div className="spec__row spec__row--header">
                <div>Param</div>
                <div>Value</div>
              </div>
              {SPEC.map(([k, v, accent]) => (
                <div key={k} className="spec__row">
                  <div className="spec__k">{k}</div>
                  <div className={'spec__v' + (accent ? ' spec__v--accent' : '')}>{v}</div>
                </div>
              ))}
            </div>

            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                letterSpacing: '0.06em',
                color: 'var(--ink-2)',
                marginTop: 16,
                lineHeight: 1.6,
                textTransform: 'uppercase',
              }}
            >
              Note. Every parameter on this sheet is read from the same{' '}
              <span style={{ color: 'var(--accent-deep)', fontWeight: 600 }}>manifest.ts</span> the
              embedded workspace consumes.
            </p>
          </div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <Eyebrow>Parts list · build sequence</Eyebrow>
        </div>

        <div
          data-cal
          data-cal-label="build sequence parts"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}
        >
          {PARTS.map((p) => (
            <div key={p.n} className="part">
              <div className="part__num">{p.n}</div>
              <div className="part__title">{p.t}</div>
              <h3 className="part__lede">{p.l}</h3>
              <p className="part__body">{p.b}</p>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

function EmbedSlot({ kind, height }: { kind: 'mock' | 'live'; height: number }) {
  const isMock = kind === 'mock';
  return (
    <div style={{ position: 'relative' }}>
      <div className="embed-plate__caption">
        <span
          className="live"
          style={!isMock ? undefined : { background: 'var(--ink-2)' }}
        />
        FIG. 02-{isMock ? 'A' : 'B'} ·{' '}
        <span style={{ color: 'var(--accent-deep)', fontWeight: 600 }}>
          {isMock ? 'MOCK' : 'LIVE'}
        </span>
        <span style={{ color: 'var(--ink-faint)' }}> · </span>
        <span>{isMock ? 'the spec, drawn' : 'the spec, running'}</span>
      </div>
      <EmbedFrame height={height}>
        {isMock ? (
          <HudsonEmbed
            src="/embed/workspace"
            surface="workspace"
            sizing={{ mode: 'fill' }}
            density="comfy"
            workspace="self"
            template="hudson"
            consumerId="hudsonos"
            title="Hudson workspace · mock spec"
          />
        ) : (
          <HudsonEmbed
            src="/embed/hudson/workspace"
            surface="workspace"
            sizing={{ mode: 'fill' }}
            density="comfy"
            workspace="self"
            template="drafting"
            consumerId="hudson-linen"
            title="Hudson workspace · live primitives · linen"
          />
        )}
      </EmbedFrame>
    </div>
  );
}

function LayoutToggle({
  layout,
  setLayout,
}: {
  layout: Layout;
  setLayout: (l: Layout) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="layout mode"
      style={{
        display: 'inline-grid',
        gridTemplateColumns: `repeat(${LAYOUT_OPTIONS.length}, auto)`,
        border: '1px solid var(--ink)',
      }}
    >
      {LAYOUT_OPTIONS.map((opt, i) => {
        const isActive = opt.id === layout;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setLayout(opt.id)}
            style={{
              padding: '7px 14px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              background: isActive ? 'var(--ink)' : 'var(--paper)',
              color: isActive ? 'var(--paper)' : 'var(--ink-1)',
              border: 0,
              borderRight:
                i < LAYOUT_OPTIONS.length - 1 ? '1px solid var(--ink)' : 0,
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function ActiveButton({
  current,
  target,
  set,
  label,
}: {
  current: 'mock' | 'live';
  target: 'mock' | 'live';
  set: (v: 'mock' | 'live') => void;
  label: string;
}) {
  const isActive = current === target;
  return (
    <button
      type="button"
      onClick={() => set(target)}
      aria-pressed={isActive}
      style={{
        padding: '6px 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        background: isActive ? 'var(--accent)' : 'var(--paper)',
        color: isActive ? 'var(--paper)' : 'var(--ink-1)',
        border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--ink)'),
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
