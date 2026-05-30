'use client';

import { useRef, useCallback, useState, useMemo, useEffect, type CSSProperties } from 'react';
import { RotateCcw, Sun, Moon, Type, Grid3X3, Sparkles, Shuffle, Pencil, Wand2, X, Minimize2, Maximize2, Zap, Send, Lightbulb, ScrollText, ChevronDown, ChevronRight, ChevronLeft, LayoutGrid, Film, MousePointer2, Square, Circle, Minus, Trash2 } from 'lucide-react';
import { buildPersistedMatrixSession, useLogo } from './LogoProvider';
import type { LogoParams } from './LogoProvider';
import type { LogoEditorTool, WordmarkConfig } from './types';
import { LogoSvg } from './LogoSvg';
import { WordmarkSvg } from './WordmarkSvg';
import { LogoComparisonSheet, type LogoComparisonCellMeta } from './LogoComparisonSheet';
import { LogoVersionGrid } from './LogoVersionGrid';
import { MATRIX_PRESETS } from './LogoMatrixPresets';
import { useOptionalDataBus } from '../../shell/DataBusContext';

const LOGO_WORK_SURFACE_STYLE: CSSProperties = {
  background: [
    'radial-gradient(',
    'circle at 50% 42%, ',
    'color-mix(in oklab, oklch(var(--card)) 78%, oklch(var(--background)) 22%) 0%, ',
    'oklch(var(--background)) 58%, ',
    'color-mix(in oklab, oklch(var(--secondary)) 72%, oklch(var(--background)) 28%) 100%',
    ')',
  ].join(''),
};

const LOGO_GRID_DOT_FILL = 'color-mix(in oklab, oklch(var(--foreground)) 16%, transparent)';
const LOGO_PREVIEW_LABEL_CLASS = 'text-[11px] text-muted-foreground/70';
const LOGO_TOOLBAR_BUTTON_BASE = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-mono transition-colors';
const LOGO_TOOLBAR_BUTTON_ACTIVE = 'bg-muted text-foreground';
const LOGO_TOOLBAR_BUTTON_IDLE = 'text-muted-foreground hover:text-foreground hover:bg-muted/70';
const LOGO_TOOLBAR_DIVIDER_CLASS = 'w-px h-4 bg-border/70';
const LOGO_DARK_PREVIEW_STAGE_CLASS = 'rounded-[48px] bg-neutral-950 shadow-lg ring-1 ring-border/70';

type AiAction = 'polish' | 'explore' | 'simplify' | 'elevate' | 'remix' | 'edit';

const COMPONENT_TOOLS: { id: LogoEditorTool; icon: typeof MousePointer2; label: string; title: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', title: 'Select and move components' },
  { id: 'rect', icon: Square, label: 'Rect', title: 'Draw rectangle' },
  { id: 'ellipse', icon: Circle, label: 'Oval', title: 'Draw circle or ellipse' },
  { id: 'line', icon: Minus, label: 'Line', title: 'Draw line' },
  { id: 'text', icon: Type, label: 'Text', title: 'Place text' },
];

const AI_ACTIONS: { id: AiAction; icon: typeof Wand2; label: string; desc: string; color: string; prompt: (ctx: string, name: string) => string }[] = [
  {
    id: 'polish', icon: Wand2, label: 'Polish', desc: 'Subtle refinements', color: 'text-emerald-400',
    prompt: (ctx) => `Polish this logo with subtle improvements. Adjust colors for better harmony, refine proportions, improve spacing and balance. Keep the same concept — just make it cleaner and more intentional. Apply changes directly.\n\n${ctx}`,
  },
  {
    id: 'explore', icon: Shuffle, label: 'Explore', desc: 'Create 3 variations', color: 'text-cyan-400',
    prompt: (ctx, name) => `Create 3 distinct variations of this logo by modifying the template's renderBody. Explore different visual approaches — different geometries, compositions, or effects. Save each as "${name}-v1", "${name}-v2", "${name}-v3". Keep the color palette.\n\n${ctx}`,
  },
  {
    id: 'simplify', icon: Minimize2, label: 'Simplify', desc: 'Remove complexity', color: 'text-amber-400',
    prompt: (ctx) => `Simplify this logo. Remove decorative elements, reduce the number of shapes, increase negative space. The mark should read clearly at 16px. Less is more — find the essential geometry and remove everything else. Apply changes directly.\n\n${ctx}`,
  },
  {
    id: 'elevate', icon: Maximize2, label: 'Elevate', desc: 'Add sophistication', color: 'text-teal-500',
    prompt: (ctx) => `Elevate this logo to feel more premium and sophisticated. Add subtle depth through layered opacity, refine the geometry for better mathematical harmony, improve the color palette for more richness. Think Pentagram or Wolff Olins level. Apply changes directly.\n\n${ctx}`,
  },
  {
    id: 'remix', icon: Zap, label: 'Remix', desc: 'Fresh take, same spirit', color: 'text-rose-400',
    prompt: (ctx, name) => `Remix this logo — keep the core concept and color palette but reimagine the visual execution. Try a completely different geometric approach. Create a fresh take that feels related but distinctly new. Save as "${name}-remix". \n\n${ctx}`,
  },
];

// ---------------------------------------------------------------------------
// Mini pan/zoom canvas
// ---------------------------------------------------------------------------
function useCanvasControls(initial = { x: 0, y: 0, zoom: 1 }) {
  const [pan, setPan] = useState(initial);
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setPan(p => ({ ...p, zoom: Math.min(8, Math.max(0.1, p.zoom * delta)) }));
    } else {
      setPan(p => ({ ...p, x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && (e.currentTarget as HTMLElement).dataset.panning === 'true')) {
      e.preventDefault();
      isPanning.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);
  const reset = useCallback(() => setPan(initial), [initial]);

  return { pan, handleWheel, handleMouseDown, handleMouseMove, handleMouseUp, reset };
}

// ---------------------------------------------------------------------------
// Draggable wordmark wrapper — mouse drag updates offsetX/offsetY
// ---------------------------------------------------------------------------
function DraggableWordmark({ params, size, mode, zoom, onOffsetChange }: {
  params: LogoParams;
  size: number;
  mode: 'dark' | 'light';
  zoom: number;
  onOffsetChange: (dx: number, dy: number) => void;
}) {
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  // Convert pixel delta to SVG viewBox units
  // The WordmarkSvg renders at `size` px height = 512 viewBox units
  const pxToSvg = 512 / (size * zoom);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Only left click, not during pan
    if (e.button !== 0) return;
    e.stopPropagation();
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = (e.clientX - lastPos.current.x) * pxToSvg;
    const dy = (e.clientY - lastPos.current.y) * pxToSvg;
    lastPos.current = { x: e.clientX, y: e.clientY };
    onOffsetChange(dx, dy);
  }, [pxToSvg, onOffsetChange]);

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    dragging.current = false;
    (e.currentTarget as HTMLElement).style.cursor = '';
  }, []);

  return (
    <div
      className="cursor-grab active:cursor-grabbing relative group"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <WordmarkSvg params={params} size={size} mode={mode} />
      {/* Drag hint — preview stage is always dark per template bg, so this text needs to read on dark */}
      <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-mono text-white/30 whitespace-nowrap pointer-events-none">
        drag to reposition text
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Geometry overlay — shows param hints on icon hover
// ---------------------------------------------------------------------------
function GeometryOverlay({ params, size }: { params: LogoParams; size: number }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const scale = size / 512;
  const p = params;

  // Compute positions in pixels (scaled from 512 viewBox)
  const s = (v: number) => v * scale;
  const content = 512 - p.padding * 2;
  const vGap = p.padding + content * p.splitX;
  const hGap = p.padding + content * p.splitY;

  const zones: { id: string; label: string; value: string; rect: [number, number, number, number]; color: string }[] = [
    // Padding — top edge
    { id: 'padding', label: 'padding', value: `${p.padding}px`, rect: [0, 0, 512, p.padding], color: 'rgba(56,189,248,0.12)' },
    // Padding — left edge
    { id: 'padding-l', label: 'padding', value: `${p.padding}px`, rect: [0, 0, p.padding, 512], color: 'rgba(56,189,248,0.12)' },
    // Gap vertical
    { id: 'gapWidth-v', label: 'gapWidth', value: `${p.gapWidth}px`, rect: [vGap, p.padding, p.gapWidth, content], color: 'rgba(251,191,36,0.15)' },
    // Gap horizontal
    { id: 'gapWidth-h', label: 'gapWidth', value: `${p.gapWidth}px`, rect: [p.padding, hGap, content, p.gapWidth], color: 'rgba(251,191,36,0.15)' },
    // Split X marker (vertical line)
    { id: 'splitX', label: 'splitX', value: `${(p.splitX * 100).toFixed(0)}%`, rect: [vGap - 2, p.padding, 4, content], color: 'rgba(52,211,153,0.30)' },
    // Split Y marker (horizontal line)
    { id: 'splitY', label: 'splitY', value: `${(p.splitY * 100).toFixed(0)}%`, rect: [p.padding, hGap - 2, content, 4], color: 'rgba(52,211,153,0.30)' },
  ];

  return (
    <div
      className="absolute inset-0 pointer-events-auto"
      onMouseLeave={() => setHovered(null)}
    >
      {zones.map(z => (
        <div
          key={z.id}
          className="absolute transition-opacity duration-150"
          style={{
            left: s(z.rect[0]),
            top: s(z.rect[1]),
            width: s(z.rect[2]),
            height: s(z.rect[3]),
            background: hovered === z.id ? z.color : 'transparent',
            opacity: hovered ? (hovered === z.id ? 1 : 0.3) : 0,
          }}
          onMouseEnter={() => setHovered(z.id)}
        />
      ))}
      {/* Tooltip */}
      {hovered && (() => {
        const zone = zones.find(z => z.id === hovered);
        if (!zone) return null;
        return (
          <div
            className="absolute z-20 pointer-events-none px-2 py-1 rounded bg-black/80 backdrop-blur-sm border border-white/10 text-[10px] font-mono text-white/80 whitespace-nowrap"
            style={{
              left: s(zone.rect[0] + zone.rect[2] / 2),
              top: s(zone.rect[1]) - 24,
              transform: 'translateX(-50%)',
            }}
          >
            <span className="text-emerald-400">{zone.label}</span>
            <span className="text-white/40 ml-1.5">{zone.value}</span>
          </div>
        );
      })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trace panel — structured turn-by-turn view of the AI conversation
// ---------------------------------------------------------------------------

type TracePart =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; toolName: string; state: string; input?: unknown; output?: unknown; toolCallId: string };

interface TraceTurn {
  role: 'user' | 'assistant';
  parts: TracePart[];
}

function normalizeTrace(messages: unknown[]): TraceTurn[] {
  const turns: TraceTurn[] = [];
  for (const raw of messages) {
    const m = raw as { role?: string; parts?: unknown[] };
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
    const parts: TracePart[] = [];
    for (const p of m.parts ?? []) {
      const part = p as Record<string, unknown>;
      const t = String(part.type ?? '');
      if (t === 'text' && typeof part.text === 'string') {
        parts.push({ kind: 'text', text: part.text });
      } else if (t.startsWith('tool-') || t === 'dynamic-tool') {
        const toolName = String(part.toolName ?? t.replace(/^tool-/, ''));
        parts.push({
          kind: 'tool',
          toolName,
          state: String(part.state ?? 'unknown'),
          input: part.input,
          output: part.output,
          toolCallId: String(part.toolCallId ?? ''),
        });
      }
    }
    if (parts.length > 0) turns.push({ role: m.role, parts });
  }
  return turns;
}

function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function TraceText({ text, role }: { text: string; role: 'user' | 'assistant' }) {
  const cleaned = role === 'assistant' ? stripThink(text) : text;
  const [expanded, setExpanded] = useState(role === 'assistant');
  const truncate = role === 'user' && cleaned.length > 320;
  const shown = !expanded && truncate ? cleaned.slice(0, 320) + '…' : cleaned;
  return (
    <div className="text-[11px] font-mono leading-relaxed text-foreground/80 whitespace-pre-wrap break-words">
      {shown}
      {truncate && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="ml-1 text-accent/80 hover:text-accent text-[10px] underline-offset-2 hover:underline"
        >
          {expanded ? 'collapse' : 'expand'}
        </button>
      )}
    </div>
  );
}

function TraceToolBlock({ part }: { part: Extract<TracePart, { kind: 'tool' }> }) {
  const [expanded, setExpanded] = useState(false);
  const inputStr = part.input !== undefined ? JSON.stringify(part.input, null, 2) : null;
  const outputStr = part.output !== undefined ? JSON.stringify(part.output, null, 2) : null;
  const inputPreview = inputStr ? inputStr.replace(/\s+/g, ' ').slice(0, 110) : null;
  const isDone = part.state === 'output-available' || part.state === 'result';
  const isError = part.state === 'output-error';
  return (
    <div className={`rounded border ${isError ? 'border-red-500/30 bg-red-500/5' : isDone ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-cyan-500/25 bg-cyan-500/5'} px-2 py-1.5`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 w-full text-left"
      >
        {expanded ? <ChevronDown size={11} className="opacity-60 shrink-0" /> : <ChevronRight size={11} className="opacity-60 shrink-0" />}
        <span className={`font-mono text-[10.5px] ${isError ? 'text-red-300' : isDone ? 'text-emerald-300' : 'text-cyan-300'}`}>
          {part.toolName}
        </span>
        <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground/60 shrink-0">
          {part.state}
        </span>
        {!expanded && inputPreview && (
          <span className="font-mono text-[10px] text-muted-foreground/65 truncate ml-1">
            {inputPreview}
          </span>
        )}
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1">
          {inputStr && (
            <div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-mono mb-0.5">input</div>
              <pre className="text-[10px] font-mono bg-background/40 rounded p-1.5 overflow-x-auto leading-snug whitespace-pre-wrap break-all">{inputStr}</pre>
            </div>
          )}
          {outputStr && (
            <div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-mono mb-0.5">output</div>
              <pre className="text-[10px] font-mono bg-background/40 rounded p-1.5 overflow-x-auto leading-snug whitespace-pre-wrap break-all max-h-[180px] overflow-y-auto">{outputStr}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LogoMatrixTrace({
  aiMessages,
  aiStatus,
  onClose,
}: {
  aiMessages: unknown[];
  aiStatus: string;
  onClose: () => void;
}) {
  const turns = useMemo(() => normalizeTrace(aiMessages), [aiMessages]);
  return (
    <aside className="absolute right-0 top-0 h-full w-[440px] z-20 border-l border-border/60 bg-card/95 backdrop-blur-xl flex flex-col pointer-events-auto">
      <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-1.5">
          <ScrollText size={12} className="text-accent" />
          <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-foreground/85">AI Trace</span>
          <span className="text-[10px] font-mono text-muted-foreground/60">· {turns.length} turn{turns.length === 1 ? '' : 's'}</span>
          {aiStatus === 'streaming' && (
            <span className="inline-flex items-center gap-1 ml-1 text-[9.5px] font-mono uppercase tracking-wider text-cyan-300">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              streaming
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground/70 hover:text-foreground/80 transition-colors"
          title="Close trace"
        >
          <X size={12} />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto frame-scrollbar px-3 py-2 space-y-3">
        {turns.length === 0 && (
          <p className="text-[11px] text-muted-foreground/70 leading-snug">
            No AI activity yet. Pick variants and send to AI — the prompt, assistant response, and tool calls will appear here.
          </p>
        )}
        {turns.map((turn, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className={`font-mono text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 rounded ${
                turn.role === 'user' ? 'bg-muted/40 text-muted-foreground/80' : 'bg-accent/15 text-accent'
              }`}>
                {turn.role}
              </span>
              <span className="font-mono text-[9px] text-muted-foreground/45">turn {i + 1}</span>
            </div>
            {turn.parts.map((part, j) =>
              part.kind === 'text' ? (
                <TraceText key={j} text={part.text} role={turn.role} />
              ) : (
                <TraceToolBlock key={j} part={part} />
              ),
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Matrix view — comparison grid for the current template
// ---------------------------------------------------------------------------
function LogoMatrixView({
  templateId: initialTemplateId,
  picks,
  onTogglePick,
  aiStatus,
  aiActivity,
  aiMessages,
  onAnimateSelected,
}: {
  templateId: string;
  picks: { key: string }[];
  onTogglePick: (pick: LogoComparisonCellMeta) => void;
  aiStatus: string;
  aiActivity: { id: number; tool: string; summary: string; timestamp: number }[];
  aiMessages: { role: string; parts: { type: string; text?: string }[] }[];
  onAnimateSelected: () => void;
}) {
  // Snapshot the matrix's templateId on mount so AI tool calls that flip
  // `params.variant` (via setVariant after create_template) don't blank out
  // the matrix. Toggle preview → matrix to refresh the snapshot.
  const [templateId] = useState(initialTemplateId);
  const { templates, setVariant, setView: setViewFromCtx, sessions, activeSession, setActiveSession, dismissSession } = useLogo();
  const preset = MATRIX_PRESETS[templateId];
  const selectedKeys = new Set(picks.map(p => p.key));
  const [traceOpen, setTraceOpen] = useState(false);

  // Seed v1 (the preset session) once on mount. Subsequent versions are
  // stamped by `beginAiSession` from the Inspector when picks are sent.
  useEffect(() => {
    if (sessions.length === 0) {
      // Reach into context: setSessions isn't exposed, but the matrix only
      // needs to display v1 — we synthesize it inline below if absent.
    }
  }, [sessions.length]);

  // The displayed session — v1 falls back to a synthesized preset session.
  const persistedSession = useMemo(
    () => buildPersistedMatrixSession(templates, templateId, sessions),
    [templates, templateId, sessions],
  );
  const activeSessionObj = useMemo(() => {
    const real = sessions.find(s => s.version === activeSession);
    if (real) return real;
    if (persistedSession && activeSession === persistedSession.version) return persistedSession;
    // Synthetic v1 if sessions is empty
    return {
      version: 1,
      label: 'v1 · base',
      kind: 'preset' as const,
      templateIds: [templateId],
      sourceTemplateId: templateId,
      createdAt: 0,
    };
  }, [sessions, activeSession, persistedSession, templateId]);
  const isPresetView = activeSessionObj.kind === 'preset';
  // Templates for v2+ sessions, resolved against the current templates list.
  const sessionTemplates = useMemo(() => {
    if (isPresetView) return [];
    return activeSessionObj.templateIds
      .map(id => templates.find(t => t.id === id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));
  }, [isPresetView, activeSessionObj, templates]);

  // Tabs to render: always include v1, then any AI sessions.
  const tabs = useMemo(() => {
    const out: { version: number; label: string; kind: 'preset' | 'ai'; count: number; persisted?: boolean }[] = [
      { version: 1, label: 'v1 · base', kind: 'preset', count: 0 },
    ];
    for (const s of sessions) {
      if (s.version === 1) continue;
      out.push({ version: s.version, label: s.label, kind: s.kind, count: s.templateIds.length });
    }
    if (persistedSession) {
      out.push({
        version: persistedSession.version,
        label: persistedSession.label,
        kind: persistedSession.kind,
        count: persistedSession.templateIds.length,
        persisted: true,
      });
    }
    return out;
  }, [sessions, persistedSession]);

  // Detect new templates that landed after this matrix view mounted.
  // The IDs we knew about at mount-time become the baseline; anything new
  // since is treated as "AI-spawned" and surfaced in a banner.
  const [baselineIds] = useState(() => new Set(templates.map(t => t.id)));
  const [dismissedSet, setDismissedSet] = useState<Set<string>>(new Set());
  const newTemplates = templates.filter(
    t => !baselineIds.has(t.id) && !dismissedSet.has(t.id),
  );
  const handleDismissBanner = useCallback(() => {
    setDismissedSet(prev => {
      const next = new Set(prev);
      for (const t of newTemplates) next.add(t.id);
      return next;
    });
  }, [newTemplates]);
  const handlePreviewLatest = useCallback(() => {
    const latest = newTemplates[newTemplates.length - 1];
    if (!latest) return;
    setVariant(latest.id);
    setViewFromCtx('preview');
  }, [newTemplates, setVariant, setViewFromCtx]);

  // Latest assistant text, stripped of <think> blocks (same as preview view's HUD)
  const lastAssistant = [...(aiMessages ?? [])].reverse().find(m => m.role === 'assistant');
  const rawText = lastAssistant?.parts
    ?.filter(p => p.type === 'text')
    .map(p => p.text ?? '')
    .join('') ?? '';
  const streamText = rawText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const showHud = aiStatus === 'streaming' || aiActivity.length > 0;

  return (
    <div className="relative h-full">
      <div
        className="h-full overflow-y-auto overflow-x-hidden frame-scrollbar"
        style={LOGO_WORK_SURFACE_STYLE}
      >
        {/* Matrix toolbar — back-to-preview + (conditional) version tabs + trace.
            Sticky so it rides scroll. Tabs only render when there's something to switch between. */}
        <div className="logo-matrix-toolbar">
          <button
            type="button"
            onClick={() => setViewFromCtx('preview')}
            className="logo-matrix-back"
            title="Back to preview"
          >
            <ChevronLeft size={12} />
            <span>Preview</span>
          </button>
          {tabs.length >= 2 && (
            <div className="logo-matrix-tabs" role="tablist" aria-label="Matrix versions">
              {tabs.map(tab => {
                const active = tab.version === activeSession;
                const closable = tab.version !== 1 && !tab.persisted;
                return (
                  <div
                    key={tab.version}
                    className={`logo-matrix-tab${active ? ' logo-matrix-tab--active' : ''}${tab.kind === 'preset' ? ' logo-matrix-tab--preset' : ''}`}
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveSession(tab.version)}
                      className="logo-matrix-tab__main"
                      title={tab.kind === 'preset' ? 'Base preset matrix' : `${tab.count} AI-spawned variant${tab.count === 1 ? '' : 's'}`}
                    >
                      <span className="logo-matrix-tab__label">{tab.label}</span>
                      {tab.kind === 'ai' && (
                        <span className="logo-matrix-tab__badge">{tab.count}</span>
                      )}
                    </button>
                    {closable && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); dismissSession(tab.version); }}
                        className="logo-matrix-tab__close"
                        aria-label={`Dismiss ${tab.label}`}
                        title={`Dismiss ${tab.label}`}
                      >
                        <X size={9} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={onAnimateSelected}
            disabled={picks.length === 0}
            className={`logo-matrix-trace ${picks.length > 0 ? 'border-cyan-400/30 text-cyan-200' : 'opacity-40 cursor-not-allowed'}`}
            title={picks.length > 0 ? 'Send selected variant(s) to Preframe' : 'Select at least one variant to animate'}
          >
            <Film size={11} />
            <span>Animate{picks.length > 0 ? ` ${picks.length}` : ''}</span>
          </button>
          <button
            onClick={() => setTraceOpen(o => !o)}
            className={`logo-matrix-trace${traceOpen ? ' logo-matrix-trace--active' : ''}`}
            title="Toggle AI trace panel"
          >
            <ScrollText size={11} />
            <span>Trace</span>
            {aiStatus === 'streaming' && (
              <span className="logo-matrix-trace__pulse" aria-hidden="true" />
            )}
          </button>
        </div>
        <div style={{ padding: '20px 28px 64px', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
          {newTemplates.length > 0 && (
            <div
              className="mb-6 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3"
              role="status"
            >
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2">
                  <Sparkles size={12} className="text-emerald-300" />
                  <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-emerald-300">
                    AI saved {newTemplates.length} new variant{newTemplates.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePreviewLatest}
                    className="rounded border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-1 text-[10.5px] font-medium text-emerald-200 transition-colors hover:bg-emerald-500/25"
                  >
                    Preview latest →
                  </button>
                  <button
                    type="button"
                    onClick={handleDismissBanner}
                    className="rounded p-1 text-emerald-300/70 transition-colors hover:bg-emerald-500/15 hover:text-emerald-200"
                    title="Dismiss"
                  >
                    <X size={11} />
                  </button>
                </div>
              </div>
              <ul className="space-y-0.5">
                {newTemplates.slice(-5).map(t => (
                  <li key={t.id} className="text-[10.5px] font-mono text-emerald-100/80 truncate">
                    <span className="text-emerald-300/60">+</span> {t.name}{' '}
                    <span className="text-emerald-300/50">· {t.id.slice(0, 8)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isPresetView ? (
            preset ? (
              <LogoComparisonSheet
                templateId={preset.templateId}
                baseParams={preset.baseParams}
                families={preset.families}
                cellSize={120}
                selectedKeys={selectedKeys}
                onToggleCell={onTogglePick}
              />
            ) : (
              <div className="logo-comparison-sheet logo-comparison-sheet--missing">
                No matrix preset defined for <code>{templateId}</code>. Add one in{' '}
                <code>LogoMatrixPresets.ts</code> or switch to a template with a preset (e.g., <code>t-decoration</code>).
              </div>
            )
          ) : (
            <LogoVersionGrid
              templates={sessionTemplates}
              cellSize={120}
              emptyHint={aiStatus === 'streaming'
                ? 'AI is generating variants for this round'
                : 'No variants in this round yet.'}
            />
          )}
        </div>
      </div>

      {/* AI HUD — streaming response + tool calls. Stays pinned to the bottom
          of the matrix viewport, independent of scroll. Mirrors the preview
          view's HUD so the same activity is visible in both modes. */}
      {showHud && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-col gap-1" style={{ maxWidth: 420 }}>
          {aiStatus === 'streaming' && streamText && (
            <div className="text-[10px] font-mono leading-relaxed px-3 py-2 rounded-lg bg-card/90 backdrop-blur-xl border border-border/70 text-muted-foreground max-h-[140px] overflow-y-auto frame-scrollbar pointer-events-auto shadow-lg">
              {streamText.slice(-360)}
              <span className="inline-block w-1.5 h-3 bg-emerald-400/70 ml-0.5 animate-pulse" />
            </div>
          )}
          {aiActivity.slice(-3).map((entry, i) => {
            const fading = false;
            return (
              <div
                key={entry.id}
                className={`text-[9.5px] font-mono px-2 py-0.5 rounded bg-card/80 border border-border/50 backdrop-blur-sm transition-opacity duration-1000 ${
                  fading && i < 2 ? 'opacity-25' : 'opacity-80'
                }`}
              >
                <span className={entry.tool === 'error' ? 'text-red-500/80' : 'text-emerald-500/80'}>{entry.tool}</span>
                <span className={`ml-1.5 ${entry.tool === 'error' ? 'text-red-500/65' : 'text-muted-foreground'}`}>{entry.summary}</span>
              </div>
            );
          })}
        </div>
      )}

      {traceOpen && (
        <LogoMatrixTrace
          aiMessages={aiMessages}
          aiStatus={aiStatus}
          onClose={() => setTraceOpen(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main content
// ---------------------------------------------------------------------------
export function LogoContent() {
  const {
    params,
    setParam,
    lightParams,
    showPreviews,
    togglePreviews,
    sendAiMessage,
    aiStatus,
    aiActivity,
    aiError,
    aiMessages,
    templates,
    inspectMode,
    view,
    picks,
    togglePick,
    setView,
    editorTool,
    setEditorTool,
    drawingShapes,
    selectedDrawingId,
    deleteDrawingShape,
  } = useLogo();
  const dataBus = useOptionalDataBus();
  const hasMatrixPreset = Boolean(MATRIX_PRESETS[params.variant]);
  const activeDrawingShapes = drawingShapes[params.variant] ?? [];
  const selectedDrawing = activeDrawingShapes.find(shape => shape.id === selectedDrawingId) ?? null;

  const [spaceHeld, setSpaceHeld] = useState(false);
  const [spotlight, setSpotlight] = useState(false);
  const gridOpacity = 0.4; // Fixed — workspace-level grid opacity is in shell settings
  const canvas = useCanvasControls();
  const containerRef = useRef<HTMLDivElement>(null);

  // When an AI-saved template is opened from the chat, flash the canvas so
  // the user notices the workspace has just become the result-viewing context.
  useEffect(() => {
    const onSpotlight = () => {
      setSpotlight(false);
      // Force a re-trigger of the keyframe even if it's already running.
      requestAnimationFrame(() => setSpotlight(true));
      window.setTimeout(() => setSpotlight(false), 1400);
    };
    window.addEventListener('hudson:logo-spotlight', onSpotlight);
    return () => window.removeEventListener('hudson:logo-spotlight', onSpotlight);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.code === 'Space' && !e.repeat && !(e.target as HTMLElement).closest('input, textarea, select')) {
      e.preventDefault();
      setSpaceHeld(true);
    }
  }, []);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.code === 'Space') setSpaceHeld(false);
  }, []);

  const hasWordmark = params.wordmark.layout !== 'icon-only' && params.wordmark.text.length > 0;

  // --- AI action system ---
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editInput, setEditInput] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const buildContext = useCallback(() => {
    const svgEl = containerRef.current?.querySelector('svg[viewBox]');
    const svgMarkup = svgEl ? svgEl.outerHTML : '(SVG not available)';
    const tmpl = templates.find(t => t.id === params.variant);
    const paramSummary = JSON.stringify({
      bgColor: params.bgColor, paneColor: params.paneColor, dimPaneColor: params.dimPaneColor,
      channelColor: params.channelColor, strokeColor: params.strokeColor,
      borderRadius: params.borderRadius, paneRadius: params.paneRadius,
      gapWidth: params.gapWidth, splitX: params.splitX, splitY: params.splitY, padding: params.padding,
    });
    return { svgMarkup, tmplName: tmpl?.name ?? params.variant, paramSummary };
  }, [params, templates]);

  const handleAiAction = useCallback((action: AiAction, editText?: string) => {
    const { svgMarkup, tmplName, paramSummary } = buildContext();
    const ctx = `Template: "${tmplName}"\nParams: ${paramSummary}\nCurrent SVG:\n\`\`\`svg\n${svgMarkup}\n\`\`\``;

    let prompt: string;
    if (action === 'edit') {
      prompt = `${editText}\n\n${ctx}`;
    } else {
      const actionDef = AI_ACTIONS.find(a => a.id === action)!;
      prompt = actionDef.prompt(ctx, tmplName);
    }

    sendAiMessage(prompt);
    setAiMenuOpen(false);
    setEditOpen(false);
    setEditInput('');
  }, [buildContext, sendAiMessage]);

  const handleWordmarkOffset = useCallback((dx: number, dy: number) => {
    setParam('wordmark', {
      ...params.wordmark,
      offsetX: Math.round(params.wordmark.offsetX + dx),
      offsetY: Math.round(params.wordmark.offsetY + dy),
    });
  }, [params.wordmark, setParam]);

  const handleAnimateSelected = useCallback(() => {
    if (picks.length === 0) {
      console.warn('[logo] Select at least one matrix variant before animating.');
      return;
    }
    const pushed = dataBus?.pushDirect('logo', 'animation-job', 'preframe-catalog', 'logo-animation-job');
    if (!pushed) {
      console.warn('[logo] Preframe animation port is not available. Start/register Preframe and try again.');
    }
  }, [dataBus, picks.length]);

  if (view === 'matrix') {
    return (
      <LogoMatrixView
        templateId={params.variant}
        picks={picks}
        onTogglePick={togglePick}
        aiStatus={aiStatus}
        aiActivity={aiActivity}
        aiMessages={aiMessages}
        onAnimateSelected={handleAnimateSelected}
      />
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div
        ref={containerRef}
        data-logo-content-root
        className={`flex-1 relative overflow-hidden min-w-0 ${spaceHeld ? 'cursor-grab active:cursor-grabbing' : ''} ${spotlight ? 'logo-canvas-spotlight' : ''}`}
        style={LOGO_WORK_SURFACE_STYLE}
        tabIndex={0}
        data-panning={spaceHeld ? 'true' : 'false'}
        onWheel={canvas.handleWheel}
        onMouseDown={canvas.handleMouseDown}
        onMouseMove={canvas.handleMouseMove}
        onMouseUp={canvas.handleMouseUp}
        onMouseLeave={canvas.handleMouseUp}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={() => setSpaceHeld(false)}
      >
        {/* Dot grid background */}
        {gridOpacity > 0 && (
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: gridOpacity }}>
          <svg width="100%" height="100%">
            <defs>
              <pattern id="logo-grid" width={20 * canvas.pan.zoom} height={20 * canvas.pan.zoom} patternUnits="userSpaceOnUse"
                patternTransform={`translate(${canvas.pan.x % (20 * canvas.pan.zoom)} ${canvas.pan.y % (20 * canvas.pan.zoom)})`}>
                <circle cx={10 * canvas.pan.zoom} cy={10 * canvas.pan.zoom} r={0.8} fill={LOGO_GRID_DOT_FILL} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#logo-grid)" />
          </svg>
        </div>
        )}

        {/* Logo toolbar */}
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-px rounded-lg border border-border/70 bg-card/85 text-muted-foreground shadow-lg backdrop-blur-xl p-0.5">
          <button
            onClick={() => setParam('lightEnabled', !params.lightEnabled)}
            className={`${LOGO_TOOLBAR_BUTTON_BASE} ${
              params.lightEnabled ? LOGO_TOOLBAR_BUTTON_ACTIVE : LOGO_TOOLBAR_BUTTON_IDLE
            }`}
            title={params.lightEnabled ? 'Disable light mode' : 'Enable light mode'}
          >
            {params.lightEnabled ? <Sun size={11} /> : <Moon size={11} />}
            Light
          </button>

          <div className={LOGO_TOOLBAR_DIVIDER_CLASS} />

          <button
            onClick={() => setParam('lightingEnabled', !params.lightingEnabled)}
            className={`${LOGO_TOOLBAR_BUTTON_BASE} ${
              params.lightingEnabled ? 'bg-amber-500/15 text-amber-600' : LOGO_TOOLBAR_BUTTON_IDLE
            }`}
            title={params.lightingEnabled ? 'Disable lighting' : 'Enable lighting'}
          >
            <Lightbulb size={11} />
            Lighting
          </button>

          <div className={LOGO_TOOLBAR_DIVIDER_CLASS} />

          <button
            onClick={() => {
              const cycle: WordmarkConfig['layout'][] = ['icon-only', 'horizontal', 'stacked'];
              const idx = cycle.indexOf(params.wordmark.layout);
              setParam('wordmark', { ...params.wordmark, layout: cycle[(idx + 1) % cycle.length] });
            }}
            className={`${LOGO_TOOLBAR_BUTTON_BASE} ${
              params.wordmark.layout !== 'icon-only' ? LOGO_TOOLBAR_BUTTON_ACTIVE : LOGO_TOOLBAR_BUTTON_IDLE
            }`}
            title={`Wordmark: ${params.wordmark.layout}`}
          >
            <Type size={11} />
            {params.wordmark.layout === 'icon-only' ? 'Wordmark' : params.wordmark.layout === 'horizontal' ? 'Horiz' : 'Stack'}
          </button>

          <div className={LOGO_TOOLBAR_DIVIDER_CLASS} />

          <button
            onClick={togglePreviews}
            className={`${LOGO_TOOLBAR_BUTTON_BASE} ${
              showPreviews ? LOGO_TOOLBAR_BUTTON_ACTIVE : LOGO_TOOLBAR_BUTTON_IDLE
            }`}
            title={showPreviews ? 'Hide asset catalog' : 'Show asset catalog'}
          >
            <Grid3X3 size={11} />
            Sizes
          </button>

          {hasMatrixPreset && (
            <>
              <div className={LOGO_TOOLBAR_DIVIDER_CLASS} />
              <button
                onClick={() => setView('matrix')}
                className={`${LOGO_TOOLBAR_BUTTON_BASE} ${LOGO_TOOLBAR_BUTTON_IDLE}`}
                title="Open the variation matrix for this template"
              >
                <LayoutGrid size={11} />
                Matrix
              </button>
            </>
          )}

          <div className={LOGO_TOOLBAR_DIVIDER_CLASS} />

          <button
            onClick={handleAnimateSelected}
            disabled={picks.length === 0}
            className={`${LOGO_TOOLBAR_BUTTON_BASE} ${
              picks.length > 0 ? 'bg-cyan-500/15 text-cyan-600 hover:bg-cyan-500/25' : 'text-muted-foreground cursor-not-allowed opacity-55'
            }`}
            title={picks.length > 0 ? 'Send selected variant(s) to Preframe' : 'Select at least one matrix variant to animate'}
          >
            <Film size={11} />
            Animate{picks.length > 0 ? ` ${picks.length}` : ''}
          </button>

          <div className={LOGO_TOOLBAR_DIVIDER_CLASS} />

          {/* AI actions */}
          <div className="relative">
            <button
              onClick={() => setAiMenuOpen(o => !o)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-mono transition-colors ${
                aiError ? 'bg-red-500/15 text-red-400'
                : aiStatus === 'streaming' ? 'bg-emerald-500/20 text-emerald-400 animate-pulse'
                : aiMenuOpen ? 'bg-emerald-500/15 text-emerald-400'
                : 'text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10'
              }`}
              title="AI actions"
            >
              <Sparkles size={11} className={aiStatus === 'streaming' ? 'animate-spin' : ''} />
              {aiStatus === 'streaming' ? 'Working' : aiError ? 'Error' : 'AI'}
            </button>
            {aiMenuOpen && (
              <div className="absolute top-full mt-2 right-0 w-[220px] rounded-xl border border-border/70 bg-popover/95 text-popover-foreground backdrop-blur-2xl shadow-2xl shadow-foreground/10 overflow-hidden z-50">
                <div className="px-3 pt-2.5 pb-1.5">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/70">Actions</div>
                </div>
                {AI_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      onClick={() => handleAiAction(action.id)}
                      disabled={aiStatus === 'streaming'}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/70 active:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Icon size={14} className={`${action.color} shrink-0`} />
                      <div className="min-w-0">
                        <div className="text-[11px] text-foreground/90">{action.label}</div>
                        <div className="text-[9px] text-muted-foreground">{action.desc}</div>
                      </div>
                    </button>
                  );
                })}
                <div className="border-t border-border/60 mt-1" />
                <button
                  onClick={() => { setAiMenuOpen(false); setEditOpen(true); }}
                  disabled={aiStatus === 'streaming'}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted/70 transition-colors disabled:opacity-30"
                >
                  <Pencil size={14} className="text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] text-foreground/90">Edit</div>
                    <div className="text-[9px] text-muted-foreground">Describe what to change</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <div className={LOGO_TOOLBAR_DIVIDER_CLASS} />

          <button
            onClick={canvas.reset}
            className="px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
            title="Reset view"
          >
            <RotateCcw size={11} />
          </button>
        </div>

        {/* Drawing toolbar */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-10 flex items-center gap-px rounded-lg border border-cyan-500/25 bg-card/85 text-muted-foreground shadow-lg shadow-cyan-950/10 backdrop-blur-xl p-0.5">
          {COMPONENT_TOOLS.map((tool) => {
            const Icon = tool.icon;
            const active = editorTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setEditorTool(tool.id)}
                className={`${LOGO_TOOLBAR_BUTTON_BASE} ${
                  active ? 'bg-cyan-500/15 text-cyan-600' : LOGO_TOOLBAR_BUTTON_IDLE
                }`}
                title={tool.title}
              >
                <Icon size={11} />
                {tool.label}
              </button>
            );
          })}

          {selectedDrawing && (
            <>
              <div className={LOGO_TOOLBAR_DIVIDER_CLASS} />
              <button
                type="button"
                onClick={() => deleteDrawingShape(params.variant, selectedDrawing.id)}
                className="flex items-center justify-center rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                title={`Delete ${selectedDrawing.name}`}
              >
                <Trash2 size={11} />
              </button>
            </>
          )}
        </div>

        {/* Edit modal */}
        {editOpen && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/50 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setEditOpen(false); }}>
            <div className="w-[440px] rounded-xl border border-border/70 bg-popover/95 text-popover-foreground backdrop-blur-2xl shadow-2xl shadow-foreground/10 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Pencil size={14} className="text-muted-foreground" />
                  <span className="text-[13px] text-foreground/90 font-medium">Edit with AI</span>
                </div>
                <button onClick={() => setEditOpen(false)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                  <X size={14} />
                </button>
              </div>
              <form onSubmit={e => { e.preventDefault(); if (editInput.trim()) handleAiAction('edit', editInput.trim()); }}>
                <input
                  ref={editInputRef}
                  type="text"
                  value={editInput}
                  onChange={e => setEditInput(e.target.value)}
                  placeholder="Make the gaps wider, soften the corners, try a warmer palette"
                  autoFocus
                  className="w-full px-4 py-3 rounded-lg bg-muted/60 border border-border text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-emerald-500/40 transition-colors"
                />
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[9px] text-muted-foreground/70 font-mono">Enter to send</span>
                  <button
                    type="submit"
                    disabled={!editInput.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-medium hover:bg-emerald-500/25 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <Send size={11} />
                    Send
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Zoom indicator */}
        <div className="absolute bottom-2 right-2 z-10 text-[10px] font-mono text-muted-foreground/70">
          {Math.round(canvas.pan.zoom * 100)}%
        </div>

        {/* AI HUD — streaming text + activity */}
        {(aiStatus === 'streaming' || aiActivity.length > 0) && (() => {
          // Extract latest assistant text (strip <think> blocks)
          const lastAssistant = [...(aiMessages ?? [])].reverse().find(m => m.role === 'assistant');
          const rawText = lastAssistant?.parts
            ?.filter((p: { type: string }) => p.type === 'text')
            .map((p: { text?: string }) => p.text ?? '')
            .join('') ?? '';
          const streamText = rawText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

          return (
            <div className="absolute bottom-2 left-2 z-10 flex flex-col gap-1 max-w-[380px]">
              {/* Streaming thought */}
              {aiStatus === 'streaming' && streamText && (
                <div className="text-[10px] font-mono leading-relaxed px-3 py-2 rounded-lg bg-card/90 backdrop-blur-xl border border-border/70 text-muted-foreground max-h-[120px] overflow-y-auto frame-scrollbar shadow-lg">
                  {streamText.slice(-300)}
                  <span className="inline-block w-1.5 h-3 bg-emerald-400/60 ml-0.5 animate-pulse" />
                </div>
              )}
              {/* Tool calls */}
              {aiActivity.slice(-3).map((entry, i) => {
                const fading = false;
                return (
                  <div
                    key={entry.id}
                    className={`text-[9px] font-mono px-2 py-0.5 rounded bg-card/80 border border-border/50 backdrop-blur-sm transition-opacity duration-1000 ${
                      fading && i < 2 ? 'opacity-20' : 'opacity-70'
                    }`}
                  >
                    <span className={entry.tool === 'error' ? 'text-red-500/80' : 'text-emerald-500/80'}>{entry.tool}</span>
                    <span className={`ml-1.5 ${entry.tool === 'error' ? 'text-red-500/65' : 'text-muted-foreground'}`}>{entry.summary}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Canvas world */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${canvas.pan.x}px, ${canvas.pan.y}px) scale(${canvas.pan.zoom})`,
            transformOrigin: 'center center',
          }}
        >
          <div className="flex flex-col items-center gap-12">

            {/* ── Main preview ── */}
            {hasWordmark ? (
              <div className="flex flex-col items-center gap-8">
                <div className="flex flex-col items-center gap-2">
                  <div className={`${LOGO_DARK_PREVIEW_STAGE_CLASS} p-8`}>
                    <DraggableWordmark
                      params={params}
                      size={400}
                      mode="dark"
                      zoom={canvas.pan.zoom}
                      onOffsetChange={handleWordmarkOffset}
                    />
                  </div>
                  <span className={LOGO_PREVIEW_LABEL_CLASS}>
                    {params.lightEnabled ? 'Dark' : params.wordmark.layout}
                  </span>
                </div>
                {params.lightEnabled && (
                  <div className="flex flex-col items-center gap-2 rounded-xl bg-white/90 p-6">
                    <DraggableWordmark
                      params={params}
                      size={400}
                      mode="light"
                      zoom={canvas.pan.zoom}
                      onOffsetChange={handleWordmarkOffset}
                    />
                    <span className="text-[10px] text-black/25">Light</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-8 items-start">
                {/* Dark icon with geometry overlay */}
                <div className="flex flex-col items-center gap-2">
                  <div className={`${LOGO_DARK_PREVIEW_STAGE_CLASS} relative`}>
                    <LogoSvg params={params} size={512} interactive />
                    {inspectMode && <GeometryOverlay params={params} size={512} />}
                  </div>
                  <span className={LOGO_PREVIEW_LABEL_CLASS}>
                    {params.lightEnabled ? 'Dark' : '512px'}
                  </span>
                </div>
                {params.lightEnabled && (
                  <div className="flex flex-col items-center gap-2">
                    <LogoSvg params={lightParams} size={512} />
                    <span className={LOGO_PREVIEW_LABEL_CLASS}>Light</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Asset catalog (Xcode-style rows) ── */}
            {showPreviews && (
              <div className="rounded-lg border border-border/70 bg-card/90 text-card-foreground overflow-hidden shadow-lg">
                <div className="flex items-center px-4 py-2 border-b border-border/60 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  <span className="w-[80px] shrink-0">Size</span>
                  <span className="flex-1">Dark</span>
                  {params.lightEnabled && <span className="flex-1">Light</span>}
                </div>
                {[512, 256, 128, 64, 32, 16].map((sz, i) => (
                  <div
                    key={sz}
                    className={`flex items-center px-4 py-3 ${i > 0 ? 'border-t border-border/50' : ''}`}
                    style={{ minHeight: Math.max(sz + 16, 48) }}
                  >
                    <div className="w-[80px] shrink-0 flex flex-col">
                      <span className="text-[11px] font-mono text-muted-foreground">{sz}px</span>
                      <span className="text-[9px] font-mono text-muted-foreground/60">{sz}&times;{sz}</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                      <div
                        className="rounded border border-border/60 flex items-center justify-center"
                        style={{
                          width: sz + 8, height: sz + 8,
                          backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.03) 75%), linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.03) 75%)',
                          backgroundSize: '8px 8px', backgroundPosition: '0 0, 4px 4px',
                        }}
                      >
                        <LogoSvg params={params} size={sz} />
                      </div>
                    </div>
                    {params.lightEnabled && (
                      <div className="flex-1 flex items-center justify-center">
                        <div
                          className="rounded border border-black/10 flex items-center justify-center"
                          style={{
                            width: sz + 8, height: sz + 8,
                            backgroundImage: 'linear-gradient(45deg, rgba(0,0,0,0.04) 25%, #f0f0f0 25%, #f0f0f0 75%, rgba(0,0,0,0.04) 75%), linear-gradient(45deg, rgba(0,0,0,0.04) 25%, #f0f0f0 25%, #f0f0f0 75%, rgba(0,0,0,0.04) 75%)',
                            backgroundSize: '8px 8px', backgroundPosition: '0 0, 4px 4px',
                            backgroundColor: '#f5f5f5',
                          }}
                        >
                          <LogoSvg params={lightParams} size={sz} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
