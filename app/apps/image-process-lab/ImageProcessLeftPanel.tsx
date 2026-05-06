'use client';

import {
  Columns2,
  FileJson,
  ImageIcon,
  Layers2,
} from 'lucide-react';
import { useImageProcess } from './ImageProcessProvider';
import type { ImageProcessView } from './types';

const VIEW_ITEMS: Array<{ id: ImageProcessView; label: string; detail: string; icon: typeof Columns2 }> = [
  { id: 'compare', label: 'Compare', detail: 'Source and processed image', icon: Columns2 },
  { id: 'source', label: 'Source', detail: 'Original input', icon: ImageIcon },
  { id: 'processed', label: 'Processed', detail: 'Signal Mosaic output', icon: Layers2 },
  { id: 'recipe', label: 'Recipe', detail: 'Program and parameters', icon: FileJson },
];

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-[10px] text-foreground/60">{value}</span>
    </div>
  );
}

export function ImageProcessLeftPanel() {
  const {
    sourceMeta,
    manifest,
    program,
    view,
    setView,
  } = useImageProcess();

  return (
    <div className="flex h-full flex-col overflow-y-auto py-2">
      <div className="px-3 pb-3">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Views</div>
        <div className="space-y-1">
          {VIEW_ITEMS.map(item => {
            const Icon = item.icon;
            const selected = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
                  selected
                    ? 'border-emerald-500/22 bg-emerald-500/[0.075]'
                    : 'border-transparent hover:border-border/70 hover:bg-accent/8'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon size={12} className={selected ? 'text-emerald-600' : 'text-muted-foreground'} />
                  <span className={`text-[12px] font-medium ${selected ? 'text-foreground/78' : 'text-muted-foreground'}`}>
                    {item.label}
                  </span>
                </div>
                <div className="ml-5 mt-0.5 text-[10px] text-muted-foreground/75">
                  {item.id === 'processed' ? `${program.name} output` : item.detail}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border/70 px-3 py-3">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Source</div>
        <div className="space-y-1.5 rounded-lg bg-card/86 px-3 py-2">
          <StatRow label="Name" value={sourceMeta?.name ?? 'No image'} />
          <StatRow
            label="Size"
            value={sourceMeta?.width && sourceMeta.height ? `${sourceMeta.width} x ${sourceMeta.height}` : 'Waiting'}
          />
        </div>
      </div>

      <div className="border-t border-border/70 px-3 py-3">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Output</div>
        <div className="space-y-1.5 rounded-lg bg-card/86 px-3 py-2">
          <StatRow
            label="PNG"
            value={manifest ? `${manifest.output.width} x ${manifest.output.height}` : 'Not ready'}
          />
          <StatRow label="Program" value={program.name} />
        </div>
      </div>
    </div>
  );
}
