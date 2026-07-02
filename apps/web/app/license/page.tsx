import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Eyebrow } from '@/marketing/primitives/Eyebrow';
import { DEFAULTS } from '@/marketing/theme/defaults';
import { resolveThemeStyle } from '@/marketing/theme/resolve';

export const metadata = {
  title: 'License (MINE) · HudsonKit',
  description:
    'The HudsonKit license — open by default. If you\'re going to use it commercially, talk to me first.',
};

const CONTACT_EMAIL = 'arach@tchoupani.com';
const REVISED = '2026-05-09';

const OPEN_ITEMS = [
  'Read the source. Run it locally. Fork it.',
  'School projects, hackathons, weekend builds, learning by doing.',
  'File issues, open PRs, tell people about it.',
  'Build something dumb with it for fun.',
];

const ASK_FIRST_ITEMS = [
  'Anything commercial — SaaS, paid product, anything you charge for.',
  'Forks that get redistributed at scale or rebranded as a product.',
  'Training a model on this code or anything it generates.',
];

const OWED_ITEMS = [
  'A link back if you ship something built on it.',
  'A line of credit somewhere visible.',
  'The truth about what you\'re doing.',
];

export default function LicensePage() {
  const themeStyle = resolveThemeStyle({ ...DEFAULTS });

  return (
    <main
      className="hudson-site"
      data-paper={DEFAULTS.paper}
      style={{ ...themeStyle, minHeight: '100vh', paddingBottom: 80 }}
      suppressHydrationWarning
    >
      <PageHeader />

      <article style={{ maxWidth: 880, margin: '60px auto 0', padding: '0 32px' }}>
        <Eyebrow>LIC / MINE · v0 · draft</Eyebrow>

        <h1
          className="h-section"
          style={{ marginTop: 24, marginBottom: 28 }}
        >
          License <em>(mine)</em>.
        </h1>

        <p
          className="subhead"
          style={{ fontSize: 18, lineHeight: 1.55, marginBottom: 56, maxWidth: 700 }}
        >
          Look — whatever&rsquo;s here, you can have a look. Run it. Hack on it. Build
          something dumb with it for fun. Just one thing:{' '}
          <strong style={{ color: 'var(--ink)' }}>
            if you&rsquo;re going to use it commercially, talk to me first.
          </strong>{' '}
          I&rsquo;m not trying to be precious about this — I just want to know who&rsquo;s
          building on top of my work and how. Most of the time I&rsquo;ll say yes.
        </p>

        <Section num="§1" title="What's open by default">
          <BulletList items={OPEN_ITEMS} />
        </Section>

        <Section num="§2" title="What asks first">
          <BulletList items={ASK_FIRST_ITEMS} />
        </Section>

        <Section num="§3" title="How to ask">
          <p style={SECTION_P}>
            One sentence is enough. What you&rsquo;re building, what you&rsquo;d like to do
            with HudsonKit. I&rsquo;ll write back. Most asks I&rsquo;ll say yes to. I just want to
            know.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 18, flexWrap: 'wrap' }}>
            <a
              className="btn btn--accent"
              href={`mailto:${CONTACT_EMAIL}?subject=Hudson%20license%20question`}
            >
              ✉ ask nicely → {CONTACT_EMAIL}
            </a>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
              }}
            >
              reply within ~1 wk
            </span>
          </div>
        </Section>

        <Section num="§4" title="What you owe me">
          <BulletList items={OWED_ITEMS} />
        </Section>

        <Section num="§5" title="Caveat — this is v0">
          <p style={SECTION_P}>
            This is a stub, written in good faith while I figure out the proper license.
            It&rsquo;ll move toward something codified (FSL, PolyForm, or a custom doc) as
            the project matures. If you&rsquo;re reading this with a contract in hand and
            need real certainty, email me and we&rsquo;ll talk like adults.
          </p>
        </Section>

        <SignatureBlock />
      </article>
    </main>
  );
}

// ─── Page chrome ─────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        background: 'var(--paper)',
        borderBottom: '1px solid var(--ink)',
      }}
    >
      <div
        style={{
          height: 4,
          background:
            'repeating-linear-gradient(to right, var(--ink) 0 1px, transparent 1px 12px)',
          opacity: 0.4,
        }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          padding: '14px 32px',
          gap: 16,
        }}
      >
        <Link
          href="/"
          style={{
            justifySelf: 'start',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          ← back to drawings
        </Link>
        <span
          style={{
            justifySelf: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--ink)',
            border: '1px solid var(--ink)',
            padding: '6px 12px',
            background: 'var(--paper-2)',
          }}
        >
          LICENSE · MINE · v0
        </span>
        <span
          style={{
            justifySelf: 'end',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ink-3)',
          }}
        >
          HUDSONKIT
        </span>
      </div>
    </header>
  );
}

function Section({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        marginBottom: 44,
        paddingBottom: 36,
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 16,
          marginBottom: 18,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 24,
            color: 'var(--accent-deep)',
            lineHeight: 1,
          }}
        >
          {num}
        </span>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ink)',
          }}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'grid',
        gap: 10,
      }}
    >
      {items.map((item) => (
        <li
          key={item}
          style={{
            display: 'grid',
            gridTemplateColumns: '20px 1fr',
            gap: 12,
            fontSize: 15,
            lineHeight: 1.55,
            color: 'var(--ink-1)',
          }}
        >
          <span
            aria-hidden
            style={{
              color: 'var(--accent)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            ◦
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SignatureBlock() {
  return (
    <div
      style={{
        marginTop: 12,
        border: 'var(--stroke-w) solid var(--ink)',
        background: 'var(--paper-2)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
      }}
    >
      <SigCell label="Drawn by" value="Arach Tchoupani" />
      <SigCell label="Last revised" value={REVISED} mid />
      <SigCell label="Revision" value="v0 · draft" />
    </div>
  );
}

function SigCell({ label, value, mid }: { label: string; value: string; mid?: boolean }) {
  return (
    <div
      style={{
        padding: '14px 18px',
        borderRight: mid ? '1px solid var(--ink)' : undefined,
        borderLeft: mid ? '1px solid var(--ink)' : undefined,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          color: 'var(--ink)',
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const SECTION_P: CSSProperties = {
  margin: 0,
  fontSize: 15,
  lineHeight: 1.6,
  color: 'var(--ink-1)',
  maxWidth: 720,
};
