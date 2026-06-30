'use client';

import { consumers } from '@/app/embed/registry';
import { HudTiling } from 'hudsonkit';

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

      {/* Test of web HudTiling primitive with arbitrary content */}
      <section className="max-w-4xl mt-12">
        <h2 className="text-xl font-semibold mb-2 text-cyan-300">Web HudTiling test (arbitrary content)</h2>
        <p className="text-sm text-slate-400 mb-4">
          Using the web version of the tiler with drag-to-reorder, resizable, and mixed content types (tree, code, image).
        </p>
        <HudTiling
          items={[
            { id: 'tree', label: 'Code tree' },
            { id: 'code', label: 'Code view' },
            { id: 'img', label: 'Image placeholder' },
          ]}
          itemKey={(i) => i.id}
          renderItem={(item) => {
            if (item.id === 'tree') {
              return (
                <div className="p-2 text-xs font-mono bg-black/40 rounded">
                  <div>project/</div>
                  <div>├─ src/</div>
                  <div>│  └─ main.ts</div>
                  <div>└─ README.md</div>
                </div>
              );
            }
            if (item.id === 'code') {
              return (
                <div className="p-2 text-xs font-mono bg-black/40 rounded">
                  <div>function tile() {'{'}</div>
                  <div>  return compute(...)</div>
                  <div>{'}'}</div>
                </div>
              );
            }
            return (
              <div className="flex items-center justify-center h-full bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 rounded text-center text-sm">
                Image / Visual Content
              </div>
            );
          }}
          constraints={{ maxColumns: 3, gap: 8 }}
          resizable
          className="h-64 border border-white/10 rounded-lg bg-slate-900/50"
        />
      </section>
    </main>
  );
}
