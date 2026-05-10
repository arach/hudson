import { HudsonEmbed } from '@/marketing/lib/embed';
import { EmbedFrame } from '@/marketing/primitives/EmbedFrame';
import { Eyebrow } from '@/marketing/primitives/Eyebrow';
import { Sheet } from '@/marketing/primitives/Sheet';

const STEPS = [
  {
    n: '01',
    t: 'INSTALL',
    cmd: '$ bun add hudsonkit',
    caption: 'One package. SDK, primitives, and voice in the same import surface.',
  },
  {
    n: '02',
    t: 'SCAFFOLD',
    cmd: '$ hudson new my-app',
    caption: 'Manifest, app folder, primitives wired up. Ready to run.',
  },
  {
    n: '03',
    t: 'RUN',
    cmd: '$ bun dev',
    caption: 'Your standard dev server. Hudson runs alongside whatever you already use.',
  },
];

const FOOTER_COLS = [
  { h: 'Project', links: ['GitHub', 'Changelog', 'Roadmap', 'Discord'] },
  { h: 'Docs', links: ['Quickstart', 'Manifest', 'Primitives', 'Voice / AI'] },
  { h: 'Apps', links: ['Talkie', 'Scout', 'Linea', 'Lattices', 'Vox'] },
  { h: 'Legal', links: ['License (MINE)', 'Contributing', 'Code of Conduct', 'Security'] },
];

const WORKSPACE_URL = 'https://app.hudsonos.com';
const GITHUB_URL = 'https://github.com/arach/hudsonos';

export function Sheet07Quickstart() {
  return (
    <Sheet
      id="quickstart"
      num="07"
      slugTitle="QUICKSTART"
      slugSub="install · scaffold · build"
      sheetTitle="Quickstart — End Sheet"
      footer={{
        left: ['SHEET', '07 / 07'],
        mid: 'HUDSONKIT — END OF DRAWING SET',
        right: ['LICENSE', 'MINE'],
      }}
    >
      <div style={{ maxWidth: 1300, margin: '60px auto 0' }}>
        <div style={{ marginBottom: 24 }}>
          <Eyebrow>07 / Quickstart · the page turns</Eyebrow>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            gap: 64,
            alignItems: 'end',
            marginBottom: 56,
          }}
        >
          <h2 className="h-section">
            End of our drawing. <em>Start</em> of yours.
          </h2>
          <p className="subhead" style={{ fontSize: 16 }}>
            Seven sheets in, you&rsquo;ve seen the shape of a Hudson app: manifest, primitives, voice
            loop, the whole drawing set. Now the drawing ends and the build begins. Three commands
            and the docs are waiting.
          </p>
        </div>

        <div
          data-cal
          data-cal-label="quickstart cards · 3-col"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 24,
            marginBottom: 64,
          }}
        >
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="hud-card"
              style={{
                border: 'var(--stroke-w) solid var(--ink)',
                background: 'var(--paper)',
                padding: '20px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 44,
                    lineHeight: 1,
                    color: 'var(--accent-deep)',
                  }}
                >
                  {s.n}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-2)',
                  }}
                >
                  {s.t}
                </span>
              </div>
              <pre className="code" style={{ margin: 0, fontSize: 12, padding: 12 }}>
                <span style={{ color: 'var(--accent)' }}>{s.cmd}</span>
              </pre>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-1)', lineHeight: 1.55 }}>
                {s.caption}
              </p>
            </div>
          ))}
        </div>

        <div data-cal data-cal-label="docs preview" style={{ position: 'relative', marginBottom: 64 }}>
          <div className="embed-plate__caption">
            <span className="live" />
            EMBED · app = hudson/docs · status: live
          </div>
          <EmbedFrame height={520} padding={0}>
            <HudsonEmbed
              src="/embed/hudson/docs"
              surface="docs"
              sizing={{ mode: 'fill' }}
              density="comfy"
              template="drafting"
              consumerId="hudsonos"
              title="Hudson docs · getting started"
            />
          </EmbedFrame>
        </div>

        <div
          className="hud-card"
          data-cal
          data-cal-label="final CTA banner"
          style={{
            border: 'var(--stroke-w) solid var(--ink)',
            background: 'var(--ink)',
            color: 'var(--paper)',
            padding: '40px 48px',
            marginBottom: 64,
            display: 'flex',
            alignItems: 'center',
            gap: 36,
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                marginBottom: 12,
              }}
            >
              ⸻ Last sheet · first commit
            </div>
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontSize: 34,
                lineHeight: 1.15,
                color: 'var(--paper)',
              }}
            >
              Build software the way you&apos;d <em>draw</em> it.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 240 }}>
            <a className="btn btn--accent" href={WORKSPACE_URL} target="_blank" rel="noopener noreferrer">
              ↗ Open the workspace
            </a>
            <a
              className="btn"
              style={{
                background: 'transparent',
                color: 'var(--paper)',
                borderColor: 'var(--ink-2)',
              }}
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              ★ View on GitHub
            </a>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 32,
            paddingTop: 32,
            borderTop: '1px solid var(--line-strong)',
          }}
        >
          {FOOTER_COLS.map((c) => (
            <div key={c.h}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                  marginBottom: 12,
                }}
              >
                {c.h}
              </div>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {c.links.map((l) => {
                  const href =
                    l === 'License (MINE)'
                      ? '/license'
                      : l === 'GitHub'
                        ? GITHUB_URL
                        : '#';
                  return (
                    <li key={l}>
                      <a href={href} style={{ fontSize: 13, color: 'var(--ink)' }}>
                        {l}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
