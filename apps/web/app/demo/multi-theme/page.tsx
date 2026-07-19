'use client';

import { useState, type ReactNode } from 'react';
import { consumers } from '@/app/embed/registry';
import { HudTiling, HudsonKitLockup } from 'hudsonkit';

export default function MultiThemePage() {
  const entries = Object.values(consumers);
  const [tileSizes, setTileSizes] = useState<Record<string, { width: number; height: number }>>({});

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-12">
      {/* Header */}
      <section className="max-w-3xl mb-12">
        <HudsonKitLockup markSize={22} gap={9} className="mb-6 text-slate-100" />
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

      {/* Test of web HudTiling primitive with real UI components */}
      <section className="max-w-4xl mt-12">
        <h2 className="text-xl font-semibold mb-2 text-cyan-300">Web HudTiling — real components</h2>
        <p className="text-sm text-slate-400 mb-4">
          Drag to reorder, resize with corner handles. These are real styled UI panels — not empty shells. Resize freely then hit Rebalance.
        </p>

        <div className="mb-1.5 flex justify-end">
          <button
            onClick={() => setTileSizes({})}
            className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-white/20 active:bg-white/30"
          >
            Rebalance
          </button>
        </div>

        <HudTiling
          sizes={tileSizes}
          onSizesChange={setTileSizes}
          items={[
            { id: 'nav', title: 'Navigator' },
            { id: 'editor', title: 'Editor' },
            { id: 'preview', title: 'Preview' },
            { id: 'inspector', title: 'Inspector' },
            { id: 'logs', title: 'Logs' },
          ]}
          itemKey={(i) => i.id}
          renderItem={(item) => {
            const Panel = ({ title, children }: { title: string; children: ReactNode }) => (
              <div className="flex h-full flex-col overflow-hidden rounded-lg border border-white/10 bg-slate-950 shadow-inner text-[10px]">
                <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-white/5 to-white/10 px-2 py-1 text-[9px] font-medium text-slate-200">
                  <span className="tracking-tight">{title}</span>
                  <span className="text-white/40">⋮</span>
                </div>
                <div className="flex-1 overflow-auto p-2 text-slate-200 leading-tight">
                  {children}
                </div>
              </div>
            );

            if (item.id === 'nav') {
              return (
                <Panel title={item.title}>
                  <div className="space-y-[1px] font-mono text-[9px]">
                    <div className="flex items-center gap-1 text-emerald-400">▸ hudson</div>
                    <div className="pl-3 flex items-center gap-1 text-cyan-400">▸ app</div>
                    <div className="pl-6 text-white/60 hover:text-white/90 cursor-default">page.tsx</div>
                    <div className="pl-6 text-emerald-400/70">demo/page.tsx</div>
                    <div className="pl-3 flex items-center gap-1 text-white/70">▸ components</div>
                    <div className="pl-6 text-white/60">Button.tsx</div>
                    <div className="pl-6 text-sky-400 font-medium">HudTiling.tsx</div>
                    <div className="pl-6 text-white/60">Panel.tsx</div>
                  </div>
                </Panel>
              );
            }

            if (item.id === 'editor') {
              return (
                <Panel title={item.title}>
                  <div className="mb-1 flex items-center justify-between border-b border-white/10 pb-1 text-[8px] text-white/50">
                    <span className="text-emerald-300">HudTiling.tsx</span>
                    <span className="rounded bg-white/10 px-1">TSX</span>
                  </div>
                  <pre className="font-mono text-[9px] leading-[1.05] text-slate-300">
{`export function HudTiling<Item>() {
  return (
    <div className="relative h-full">
      {layout.map(tile => (
        <div key={tile.key} style={{left: tile.x}}>
          {renderItem(tile)}
        </div>
      ))}
    </div>
  )
}`}
                  </pre>
                </Panel>
              );
            }

            if (item.id === 'preview') {
              return (
                <Panel title={item.title}>
                  <div className="space-y-1 text-[9px]">
                    <div className="rounded-md border border-white/15 bg-white/5 p-1.5 shadow-sm">
                      <div className="mb-1 flex items-center gap-1 text-[8px] font-medium text-white/80">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" /> Card Title
                      </div>
                      <div className="h-1.5 w-3/4 rounded bg-white/25" />
                      <div className="mt-1.5 flex items-center gap-1 text-[8px]">
                        <div className="rounded bg-emerald-500/90 px-1.5 py-px text-[8px] font-medium text-black">Apply</div>
                        <div className="rounded border border-white/30 px-1.5 py-px">Cancel</div>
                      </div>
                    </div>
                    <div className="text-[8px] text-white/50">Resizes beautifully</div>
                  </div>
                </Panel>
              );
            }

            if (item.id === 'inspector') {
              return (
                <Panel title={item.title}>
                  <div className="space-y-px text-[9px]">
                    {['width', 'height', 'gap', 'cols'].map((k, i) => (
                      <div key={k} className="flex justify-between border-b border-white/10 py-px last:border-0">
                        <span className="text-white/60">{k}</span>
                        <span className="font-mono text-emerald-400">{i === 0 ? '240' : 'auto'}</span>
                      </div>
                    ))}
                    <div className="mt-1 text-[8px] text-white/40">Live on drag/resize</div>
                  </div>
                </Panel>
              );
            }

            // logs
            return (
              <Panel title={item.title}>
                <div className="font-mono text-[8px] leading-[1.15] text-slate-300">
                  <div><span className="text-emerald-400">[12:04]</span> mount 5 tiles</div>
                  <div><span className="text-amber-400">[12:04]</span> resize #3</div>
                  <div><span className="text-sky-400">[12:05]</span> reorder 3→1</div>
                  <div><span className="text-rose-400">[12:05]</span> drop complete</div>
                  <div className="text-white/40">... 4 more</div>
                </div>
              </Panel>
            );
          }}
          constraints={{ maxColumns: 4, gap: 6 }}
          resizable
          className="h-96 border border-white/10 rounded-xl bg-slate-900/60 ring-1 ring-white/5 shadow-2xl"
        />
      </section>
    </main>
  );
}
