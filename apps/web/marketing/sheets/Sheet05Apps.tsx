import { Eyebrow } from '@/marketing/primitives/Eyebrow';
import { Sheet } from '@/marketing/primitives/Sheet';
import { AppCard, type AppCardData } from './_components/AppCard';

const APPS: AppCardData[] = [
  {
    id: 'talkie',
    name: 'Talkie',
    tag: 'ios · macos',
    lede: 'Voice notes, transcribed.',
    body: 'A canvas of audio clips. Long-press to record, drag to arrange, ⌘K to find anything you said three weeks ago.',
    accent: 'oklch(0.62 0.16 162)',
    source: 'https://github.com/arach/usetalkie.com',
    href: 'https://usetalkie.com',
  },
  {
    id: 'scout',
    name: 'Scout',
    tag: 'macos · web',
    lede: 'Field notes that file themselves.',
    body: 'Local-first dictation built for agents. Speak, and the transcript lands wherever your tools are listening.',
    accent: 'oklch(0.66 0.18 50)',
    source: 'https://github.com/arach/scout',
  },
  {
    id: 'linea',
    name: 'Linea',
    tag: 'macos · web',
    lede: 'A line, finely drawn.',
    body: 'A drafting surface for precise strokes — bezier curves, dimensions, and marks over a millimetric grid.',
    accent: 'oklch(0.55 0.18 250)',
  },
  {
    id: 'lattices',
    name: 'Lattices',
    tag: 'macos',
    lede: 'Structure, made visible.',
    body: 'The agentic window manager. Tiles windows, runs tmux sessions, indexes screen text — a desktop API your AI can drive.',
    accent: 'oklch(0.60 0.20 18)',
    source: 'https://github.com/arach/lattices',
  },
];

export function Sheet05Apps() {
  return (
    <Sheet
      id="apps"
      num="06"
      slugTitle="APPS GALLERY"
      slugSub="real software, public"
      sheetTitle="Apps Built on Hudson"
      footer={{
        left: ['SHEET', '06 / 08'],
        mid: 'APPS GALLERY · 4 IN PRODUCTION · MORE IN-FLIGHT',
        right: ['INSTALLS', '2,847'],
      }}
    >
      <div style={{ maxWidth: 1300, margin: '60px auto 0' }}>
        <div style={{ marginBottom: 24 }}>
          <Eyebrow>06 / Apps gallery · in production</Eyebrow>
        </div>

        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, marginBottom: 56 }}
        >
          <h2 className="h-section">
            Four apps,
            <br />
            <em>one</em> kit.
          </h2>
          <p className="subhead" style={{ fontSize: 17, alignSelf: 'end' }}>
            Each ships independently — its own brand, its own scope, its own audience. They share
            Hudson the way print designers share a type system: identical bones, distinct
            identities.
          </p>
        </div>

        <div
          data-cal
          data-cal-label="apps gallery grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 32 }}
        >
          {APPS.map((a, i) => (
            <AppCard key={a.id} app={a} index={i + 1} />
          ))}
        </div>
      </div>
    </Sheet>
  );
}
