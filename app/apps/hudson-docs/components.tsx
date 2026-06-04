'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  X,
  ChevronDown,
  ChevronRight,
  Move,
  LayoutList,
  LayoutGrid,
  Bot,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AgentDocEntry, ComponentEntry, ViewMode } from './types';
import { AGENT_DOCS } from './data';
import '@/app/docs/docs.css';

export type { AppSettingsEntry } from 'hudsonkit/settings';

// ---------------------------------------------------------------------------
// Shared resize hook + handle
// ---------------------------------------------------------------------------
function useResize(defaults: { w: number; h: number }, min: { w: number; h: number }) {
  const [size, setSize] = useState(defaults);
  const resizingRef = useRef(false);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.w;
    const startH = size.h;

    // Read zoom from the world layer
    const worldEl = document.querySelector('[data-hudson-world]');
    const zoomEl = worldEl?.parentElement?.parentElement;
    const scale = zoomEl ? parseFloat((zoomEl as HTMLElement).style.zoom || '1') : 1;

    const onMove = (ev: MouseEvent) => {
      const dw = (ev.clientX - startX) / scale;
      const dh = (ev.clientY - startY) / scale;
      setSize({
        w: Math.max(min.w, startW + dw),
        h: Math.max(min.h, startH + dh),
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setTimeout(() => { resizingRef.current = false; }, 0);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [size.w, size.h, min.w, min.h]);

  return { size, onResizeStart, resizingRef };
}

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize pointer-events-auto z-10 group"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" className="absolute bottom-0.5 right-0.5 text-muted-foreground/60 group-hover:text-foreground/70 transition-colors">
        <path d="M9 1L1 9M9 5L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component doc sheet (floating card in world space)
// ---------------------------------------------------------------------------
export function ComponentSheet({ entry, onClose, isSelected, onSelect, onDragStart, glowIntensity = 30 }: {
  entry: ComponentEntry;
  onClose: () => void;
  isSelected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  glowIntensity?: number;
}) {
  const { size, onResizeStart } = useResize({ w: 340, h: 420 }, { w: 260, h: 200 });
  const Icon = entry.icon;
  const g = glowIntensity / 100;
  const selectedShadow = `0 0 40px rgba(16,185,129,${(0.3*g).toFixed(3)}), 0 0 80px rgba(16,185,129,${(0.15*g).toFixed(3)}), inset 0 1px 0 rgba(16,185,129,${(0.2*g).toFixed(3)})`;
  return (
    <div
      onClick={onSelect}
      onMouseDown={onDragStart}
      style={{ boxShadow: isSelected ? selectedShadow : '0 24px 60px color-mix(in srgb, oklch(var(--foreground)) 14%, transparent)', width: size.w, height: size.h }}
      className={`relative border rounded-lg bg-card/88 backdrop-blur-md overflow-hidden flex flex-col pointer-events-auto cursor-grab active:cursor-grabbing ${
        isSelected
          ? 'border-accent/80'
          : 'border-border/70 hover:border-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/70 shrink-0 bg-card/92">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-accent" />
          <div>
            <span className="text-[13px] font-mono font-bold text-foreground tracking-wider">{entry.label}</span>
            <div className="text-[10px] font-mono text-muted-foreground">{entry.ns}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-accent/10 rounded transition-colors text-muted-foreground hover:text-foreground pointer-events-auto"
        >
          <X size={12} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto frame-scrollbar">
        {/* Overview */}
        <div className="px-4 py-3 border-b border-border/60">
          <div className="text-[11px] font-mono text-foreground/82 leading-relaxed">{entry.overview}</div>
        </div>

        {/* Props table */}
        <div className="px-4 py-3 border-b border-border/60">
          <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Props</div>
          <div className="space-y-2">
            {entry.props.map(p => (
              <div key={p.name}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-mono text-accent">{p.name}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{p.type}</span>
                </div>
                <div className="text-[10px] font-mono text-foreground/74 mt-0.5">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Usage */}
        <div className="px-4 py-3 border-b border-border/60">
          <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Usage</div>
          <pre className="text-[10px] font-mono text-foreground/82 bg-secondary/90 rounded px-3 py-2 overflow-x-auto whitespace-pre">{entry.usage}</pre>
        </div>

        {/* Notes */}
        {entry.notes && entry.notes.length > 0 && (
          <div className="px-4 py-3">
            <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Notes</div>
            <ul className="space-y-1">
              {entry.notes.map((n, i) => (
                <li key={i} className="text-[10px] font-mono text-foreground/74 flex items-start gap-1.5">
                  <span className="text-accent/60 mt-px">-</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <ResizeHandle onMouseDown={onResizeStart} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent doc sheet (floating card in world space — fetches markdown content)
// ---------------------------------------------------------------------------
export function AgentDocSheet({ slug, onClose, isSelected, onSelect, onDragStart, glowIntensity = 30 }: {
  slug: string;
  onClose: () => void;
  isSelected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  glowIntensity?: number;
}) {
  const { size, onResizeStart } = useResize({ w: 340, h: 420 }, { w: 260, h: 200 });
  const entry = AGENT_DOCS.find(d => d.slug === slug);
  const [html, setHtml] = useState<string | null>(null);
  const [raw, setRaw] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setHtml(null);
    fetch(`/api/agent-docs/${slug}`)
      .then(r => r.json())
      .then(d => { setHtml(d.html); setRaw(d.raw); })
      .finally(() => setLoading(false));
  }, [slug]);

  const handleCopy = useCallback(async () => {
    if (!raw) return;
    await navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [raw]);

  const g = glowIntensity / 100;
  const selectedShadow = `0 0 40px rgba(16,185,129,${(0.3*g).toFixed(3)}), 0 0 80px rgba(16,185,129,${(0.15*g).toFixed(3)}), inset 0 1px 0 rgba(16,185,129,${(0.2*g).toFixed(3)})`;

  return (
    <div
      onClick={onSelect}
      onMouseDown={onDragStart}
      style={{ boxShadow: isSelected ? selectedShadow : '0 24px 60px color-mix(in srgb, oklch(var(--foreground)) 14%, transparent)', width: size.w, height: size.h }}
      className={`relative border rounded-lg bg-card/88 backdrop-blur-md overflow-hidden flex flex-col pointer-events-auto cursor-grab active:cursor-grabbing ${
        isSelected
          ? 'border-accent/80'
          : 'border-border/70 hover:border-border'
      }`}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/70 shrink-0 bg-card/92">
        <div className="flex items-center gap-1.5 min-w-0">
          <Bot size={9} className="text-accent/50 shrink-0" />
          <span className="text-[8px] font-mono text-muted-foreground tracking-widest uppercase truncate">{entry?.title ?? slug}</span>
        </div>
        <div className="flex items-center gap-0 shrink-0">
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="p-0.5 rounded transition-colors text-muted-foreground/70 hover:bg-accent/10 hover:text-foreground/80 pointer-events-auto"
            title="Open docs site"
          >
            <ExternalLink size={9} />
          </a>
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            className={`p-0.5 rounded transition-colors ${
              copied ? 'text-accent' : 'text-muted-foreground/70 hover:bg-accent/10 hover:text-foreground/80'
            } pointer-events-auto`}
            title={copied ? 'Copied!' : 'Copy raw markdown'}
          >
            {copied ? <Check size={9} /> : <Copy size={9} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-0.5 hover:bg-accent/10 rounded transition-colors text-muted-foreground/70 hover:text-foreground/80 pointer-events-auto"
            title="Close"
          >
            <X size={9} />
          </button>
        </div>
      </div>

      {/* Metadata preamble — warm tint to distinguish from content */}
      <div className="px-2.5 py-1.5 border-b border-border/60 shrink-0 bg-secondary/70 grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-px text-[8px] font-mono">
        <span className="text-muted-foreground">title</span>
        <span className="text-foreground/78 truncate">{entry?.title ?? slug}</span>
        <span className="text-muted-foreground">desc</span>
        <span className="text-foreground/78 truncate">{entry?.description ?? ''}</span>
        <span className="text-muted-foreground">source</span>
        <span className="text-foreground/62 truncate">{entry?.file ?? slug}</span>
      </div>

      <div className="flex-1 overflow-y-auto frame-scrollbar bg-background/55 px-3 py-2 [&>div>*:first-child]:!mt-0
        [&_.docs-prose]:!text-[10px] [&_.docs-prose]:!leading-[1.5]
        [&_.docs-prose_h2]:!text-[11px] [&_.docs-prose_h2]:!mt-3 [&_.docs-prose_h2]:!mb-1.5 [&_.docs-prose_h2]:!pb-1 [&_.docs-prose_h2]:!font-semibold
        [&_.docs-prose_h3]:!text-[10px] [&_.docs-prose_h3]:!mt-2.5 [&_.docs-prose_h3]:!mb-1 [&_.docs-prose_h3]:!font-semibold
        [&_.docs-prose_h4]:!text-[10px] [&_.docs-prose_h4]:!mt-2 [&_.docs-prose_h4]:!mb-1
        [&_.docs-prose_p]:!mb-2 [&_.docs-prose_p]:!text-[10px]
        [&_.docs-prose_li]:!text-[10px] [&_.docs-prose_li]:!mb-0.5
        [&_.docs-prose_ul]:!mb-2 [&_.docs-prose_ol]:!mb-2 [&_.docs-prose_ul]:!pl-3 [&_.docs-prose_ol]:!pl-3
        [&_.docs-prose_pre]:!text-[9px] [&_.docs-prose_pre]:!p-2 [&_.docs-prose_pre]:!mb-2 [&_.docs-prose_pre]:!rounded
        [&_.docs-prose_table]:!text-[9px] [&_.docs-prose_table]:!mb-2
        [&_.docs-prose_th]:!px-1.5 [&_.docs-prose_th]:!py-1 [&_.docs-prose_td]:!px-1.5 [&_.docs-prose_td]:!py-1
        [&_.docs-prose_code]:!text-[9px] [&_.docs-prose_code]:!px-1 [&_.docs-prose_code]:!py-0
        [&_.docs-prose_blockquote]:!mb-2 [&_.docs-prose_hr]:!my-3
        [&_.docs-prose_strong]:!font-medium
      ">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-muted-foreground font-mono text-[9px]">
              <div className="w-2.5 h-2.5 border border-accent/30 border-t-accent rounded-full animate-spin" />
              Loading
            </div>
          </div>
        ) : html ? (
          <div
            className="docs-prose font-sans"
            dangerouslySetInnerHTML={{ __html: html.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/, '') }}
          />
        ) : (
          <div className="text-muted-foreground font-mono text-[9px] text-center py-8">Document not found.</div>
        )}
      </div>

      <ResizeHandle onMouseDown={onResizeStart} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// View mode toggle (center slot in NavigationBar)
// ---------------------------------------------------------------------------
export function ViewModeToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const modes: { value: ViewMode; label: string; icon: LucideIcon }[] = [
    { value: 'canvas', label: 'Canvas', icon: Move },
    { value: 'list', label: 'List', icon: LayoutList },
    { value: 'tiles', label: 'Tiles', icon: LayoutGrid },
  ];
  return (
    <div className="flex bg-card/82 rounded border border-border overflow-hidden shadow-[0_12px_30px_rgba(0,0,0,0.12)]">
      {modes.map((m, i) => {
        const MIcon = m.icon;
        const active = value === m.value;
        return (
          <button
            key={m.value}
            onClick={() => onChange(m.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono transition-colors ${
              active
                ? 'bg-accent/20 text-accent'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/8'
            } ${i > 0 ? 'border-l border-border' : ''}`}
          >
            <MIcon size={12} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// List view
// ---------------------------------------------------------------------------
export function ListView({ components, searchValue, selectedId, onSelect }: {
  components: ComponentEntry[];
  searchValue: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const filtered = useMemo(() => {
    if (!searchValue) return components;
    const q = searchValue.toLowerCase();
    return components.filter(c => c.label.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q) || c.ns.toLowerCase().includes(q));
  }, [components, searchValue]);

  return (
    <div className="pt-16 pb-16 px-4">
      <div className="max-w-3xl mx-auto space-y-1">
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground text-[12px] font-mono py-12">No components match &quot;{searchValue}&quot;</div>
        )}
        {filtered.map(c => {
          const Icon = c.icon;
          const isExpanded = expandedId === c.id;
          const isSelected = selectedId === c.id;
          return (
            <div
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`border rounded-lg transition-all cursor-pointer ${
                isSelected
                  ? 'border-accent/60 bg-card/88 backdrop-blur-md ring-1 ring-accent/20'
                  : isExpanded ? 'border-accent/30 bg-card/84 backdrop-blur-md' : 'border-border/60 bg-card/68 hover:border-border hover:bg-card/84'
              }`}
            >
              <button
                onClick={(e) => { e.stopPropagation(); onSelect(c.id); setExpandedId(isExpanded ? null : c.id); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <Icon size={14} className={isSelected || isExpanded ? 'text-accent' : 'text-muted-foreground'} />
                <div className="flex-1 min-w-0">
                  <div>
                    <span className={`text-[13px] font-mono font-bold tracking-wider ${isSelected || isExpanded ? 'text-accent' : 'text-foreground'}`}>{c.label}</span>
                    <span className="text-[11px] font-mono text-foreground/70 ml-3">{c.desc}</span>
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">{c.ns}</div>
                </div>
                {isExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border/60">
                  <div className="pt-3">
                    <div className="text-[11px] font-mono text-foreground/82 leading-relaxed">{c.overview}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Props</div>
                    <div className="space-y-2">
                      {c.props.map(p => (
                        <div key={p.name}>
                          <div className="flex items-baseline gap-2">
                            <span className="text-[11px] font-mono text-accent">{p.name}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">{p.type}</span>
                          </div>
                          <div className="text-[10px] font-mono text-foreground/74 mt-0.5">{p.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Usage</div>
                    <pre className="text-[10px] font-mono text-foreground/82 bg-secondary/90 rounded px-3 py-2 overflow-x-auto whitespace-pre">{c.usage}</pre>
                  </div>
                  {c.notes && c.notes.length > 0 && (
                    <div>
                      <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Notes</div>
                      <ul className="space-y-1">
                        {c.notes.map((n, i) => (
                          <li key={i} className="text-[10px] font-mono text-foreground/74 flex items-start gap-1.5">
                            <span className="text-accent/60 mt-px">-</span>
                            <span>{n}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiles view
// ---------------------------------------------------------------------------
export function TilesView({ components, openIds, onClose, glowIntensity, selectedId, onSelect }: {
  components: ComponentEntry[];
  openIds: Set<string>;
  onClose: (id: string) => void;
  glowIntensity: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const tiled = useMemo(() => components.filter(c => openIds.has(c.id)), [components, openIds]);
  const count = tiled.length;
  const g = glowIntensity / 100;

  const gridCols = count <= 1 ? 'grid-cols-1' : count === 2 ? 'grid-cols-1 md:grid-cols-2' : count <= 4 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';

  if (count === 0) {
    return (
      <div className="pt-16 pb-16 px-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <LayoutGrid size={24} className="text-muted-foreground mx-auto" />
          <div className="text-[12px] font-mono text-muted-foreground">No components tiled</div>
          <div className="text-[11px] font-mono text-muted-foreground">Open components from the left panel to tile them here</div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 pb-16 px-4">
      <div className={`max-w-7xl mx-auto grid ${gridCols} gap-3 auto-rows-min`}>
        {tiled.map(c => {
          const Icon = c.icon;
          const isSelected = selectedId === c.id;
          const tileShadow = isSelected
            ? `0 0 40px rgba(16,185,129,${(0.3*g).toFixed(3)}), 0 0 80px rgba(16,185,129,${(0.15*g).toFixed(3)})`
            : `0 0 30px rgba(16,185,129,${(0.15*g).toFixed(3)}), 0 0 60px rgba(16,185,129,${(0.08*g).toFixed(3)})`;
          return (
            <div
              key={c.id}
              onClick={() => onSelect(c.id)}
              style={{ boxShadow: tileShadow }}
              className={`border rounded-lg bg-card/88 backdrop-blur-md overflow-hidden flex flex-col cursor-pointer transition-all ${
                isSelected
                  ? 'border-accent/80 ring-1 ring-accent/20'
                  : 'border-border/70'
              }`}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/70 shrink-0">
                <div className="flex items-center gap-2">
                  <Icon size={14} className="text-accent" />
                  <div>
                    <span className="text-[13px] font-mono font-bold text-foreground tracking-wider">{c.label}</span>
                    <div className="text-[10px] font-mono text-muted-foreground">{c.ns}</div>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onClose(c.id); }}
                  className="p-1 hover:bg-accent/10 rounded transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X size={12} />
                </button>
              </div>
              <div className="overflow-y-auto frame-scrollbar flex-1">
                <div className="px-4 py-3 border-b border-border/60">
                  <div className="text-[11px] font-mono text-foreground/82 leading-relaxed">{c.overview}</div>
                </div>
                <div className="px-4 py-3 border-b border-border/60">
                  <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Props</div>
                  <div className="space-y-2">
                    {c.props.map(p => (
                      <div key={p.name}>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[11px] font-mono text-accent">{p.name}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{p.type}</span>
                        </div>
                        <div className="text-[10px] font-mono text-foreground/74 mt-0.5">{p.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="px-4 py-3 border-b border-border/60">
                  <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Usage</div>
                  <pre className="text-[10px] font-mono text-foreground/82 bg-secondary/90 rounded px-3 py-2 overflow-x-auto whitespace-pre">{c.usage}</pre>
                </div>
                {c.notes && c.notes.length > 0 && (
                  <div className="px-4 py-3">
                    <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Notes</div>
                    <ul className="space-y-1">
                      {c.notes.map((n, i) => (
                        <li key={i} className="text-[10px] font-mono text-foreground/74 flex items-start gap-1.5">
                          <span className="text-accent/60 mt-px">-</span>
                          <span>{n}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
