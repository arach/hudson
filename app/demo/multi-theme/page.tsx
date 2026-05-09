import { consumers } from '@/app/embed/registry';

export default function MultiThemePage() {
  const entries = Object.values(consumers);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-12">
      {/* Header */}
      <section className="max-w-3xl mb-12">
        <h1 className="text-3xl font-semibold tracking-tight text-cyan-300 mb-3">
          Multi-tenant theming
        </h1>
        <p className="text-slate-400 text-base leading-relaxed">
          Each iframe below is the same Hudson workspace, themed for a different
          consumer via{' '}
          <code className="text-emerald-400 bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono">
            ?ref=
          </code>
          . They share a tab; tokens are scoped by{' '}
          <code className="text-emerald-400 bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono">
            [data-hudson-template]
          </code>{' '}
          attribute selectors, so any number of themed subtrees can coexist on
          one page.
        </p>
      </section>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {entries.map((consumer) => (
          <div key={consumer.ref} className="flex flex-col gap-2">
            {/* Caption */}
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-slate-200">
                {consumer.ref}
              </span>
              <span className="text-xs text-slate-500">
                {consumer.template} / {consumer.theme}
              </span>
            </div>

            {/* Iframe */}
            <iframe
              src={`/embed/hudson/workspace?ref=${consumer.ref}`}
              width="100%"
              height="500"
              style={{ border: 0, borderRadius: 8 }}
              loading="lazy"
              title={`${consumer.ref} — ${consumer.template} / ${consumer.theme}`}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
