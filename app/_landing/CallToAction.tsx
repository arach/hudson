import { GlyphWavesBg } from './GlyphWavesBg';

const CONTACT_URL = 'https://x.com/aaboreal';

export function CallToAction() {
  return (
    <section className="py-32 relative overflow-hidden">
      <GlyphWavesBg />

      <div className="relative flex flex-col items-center text-center px-6">
        <h2 className="text-2xl font-mono font-bold tracking-wide text-neutral-100 mb-4">
          Interested?
        </h2>
        <p className="text-sm text-neutral-500 font-mono mb-8 max-w-[400px]">
          Hudson is in invite-only preview. Reach out to get early access.
        </p>
        <a
          href={CONTACT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary font-mono"
        >
          Get in Touch
        </a>
      </div>
    </section>
  );
}
