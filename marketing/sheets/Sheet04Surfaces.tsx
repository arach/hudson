import { Eyebrow } from '@/marketing/primitives/Eyebrow';
import { Sheet } from '@/marketing/primitives/Sheet';
import { ManifestBox } from './_components/ManifestBox';
import { PlatformFrame } from './_components/PlatformFrame';
import { ShipBlock } from './_components/ShipBlock';
import { SplitArrow } from './_components/SplitArrow';

export function Sheet04Surfaces() {
  return (
    <Sheet
      id="surfaces"
      num="04"
      slugTitle="MULTI-SURFACE"
      slugSub="three views, one source"
      sheetTitle="One Manifest, Three Surfaces"
      footer={{
        left: ['SHEET', '04 / 07'],
        mid: 'MULTI-SURFACE — ONE MANIFEST, THREE TARGETS',
        right: ['FORKS', '0'],
      }}
    >
      <div style={{ maxWidth: 1300, margin: '60px auto 0' }}>
        <div style={{ marginBottom: 24 }}>
          <Eyebrow>04 / Multi-surface</Eyebrow>
        </div>

        <h2 className="h-section" style={{ marginBottom: 48 }}>
          Write <em>once</em>. Render on{' '}
          <span style={{ borderBottom: 'var(--stroke-w) solid var(--accent)' }}>iOS</span>,{' '}
          <span style={{ borderBottom: 'var(--stroke-w) solid var(--accent)' }}>macOS</span>, and the{' '}
          <span style={{ borderBottom: 'var(--stroke-w) solid var(--accent)' }}>Web</span>.
        </h2>

        <div
          data-cal
          data-cal-label="multi-surface assembly"
          style={{
            border: 'var(--stroke-w) solid var(--ink)',
            background: 'var(--paper)',
            padding: 40,
            marginBottom: 48,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -1,
              left: -1,
              background: 'var(--ink)',
              color: 'var(--paper)',
              padding: '6px 14px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            FIG. 04-A · ASSEMBLY
          </div>

          <div
            className="reflow-assembly"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr auto 1fr',
              gap: 0,
              alignItems: 'center',
              marginTop: 28,
            }}
          >
            <ManifestBox />
            <SplitArrow />
            <div
              className="reflow-platforms"
              style={{
                gridColumn: 'span 3',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 28,
              }}
            >
              <PlatformFrame kind="ios" label="iOS" sub="TestFlight · App Store" />
              <PlatformFrame kind="macos" label="macOS" sub="notarized · DMG" />
              <PlatformFrame kind="web" label="Web" sub="CDN · PWA" />
            </div>
          </div>

          <div
            className="reflow-hide-narrow"
            style={{
              marginTop: 32,
              display: 'grid',
              gridTemplateColumns: 'auto auto 1fr',
              gap: 0,
              alignItems: 'center',
            }}
          >
            <div style={{ width: 280 }} />
            <div style={{ width: 60 }} />
            <div
              data-cal
              data-cal-label="platform dims"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28 }}
            >
              {[
                ['390 × 844', '@3x'],
                ['1024 × 768', 'window'],
                ['fluid', '@1x → ∞'],
              ].map(([d, s]) => (
                <div
                  key={d}
                  style={{
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-2)',
                  }}
                >
                  <div style={{ color: 'var(--ink)', fontSize: 13, fontWeight: 600 }}>{d}</div>
                  <div style={{ marginTop: 2 }}>{s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            gap: 48,
            alignItems: 'start',
          }}
        >
          <p className="subhead" style={{ fontSize: 17 }}>
            Same primitives, same intents, same chrome dimensions across every target. Hudson swaps
            the platform layer underneath — Swift on Apple, React on the web — but the components
            your app declares are identical.{' '}
            <em>Zero forks. Zero &quot;iOS-only&quot; features. Zero per-platform UI debt.</em>
          </p>

          <div data-cal data-cal-label="ship block">
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
                marginBottom: 8,
              }}
            >
              SHIP COMMAND
            </div>
            <ShipBlock />
          </div>
        </div>
      </div>
    </Sheet>
  );
}
