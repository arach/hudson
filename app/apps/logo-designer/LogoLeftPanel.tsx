'use client';
import { useState } from 'react';
import { X, RotateCcw, ChevronRight } from 'lucide-react';
import { useLogo } from './LogoProvider';
import { isBuiltinVariant } from './types';

// ---------------------------------------------------------------------------
// Left panel — variant selection + presets (navigation only)
// ---------------------------------------------------------------------------

export function LogoLeftPanel() {
  const {
    params, setParam, setVariant, resetDefaults, presets,
    templates, discardTemplate, restoreTemplate, discardedIds,
  } = useLogo();

  const [showDiscarded, setShowDiscarded] = useState(false);

  const activeTemplates = templates.filter(t => !discardedIds.has(t.id));
  const discardedTemplates = templates.filter(t => discardedIds.has(t.id));

  return (
    <div className="flex flex-col gap-4 p-3 text-sm overflow-y-auto h-full">
      {/* Template picker */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Variant</span>
        {templates.length === 0 && (
          <div className="text-[11px] text-muted-foreground px-2 py-3 text-center border border-dashed border-border/60 rounded-lg">
            Loading templates...
          </div>
        )}
        {activeTemplates.map(t => {
          const isActive = params.variant === t.id;
          const isBuiltin = isBuiltinVariant(t.id);
          return (
            <div key={t.id} className="flex items-stretch gap-1">
              <button
                onClick={() => setVariant(t.id)}
                className={`flex-1 text-left px-2.5 py-2 rounded-lg border text-[12px] transition-colors ${
                  isActive
                    ? 'border-accent/40 bg-accent/10 text-foreground'
                    : 'border-border/60 bg-muted/20 text-foreground/70 hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{t.name}</span>
                  {isBuiltin && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-muted/40 text-muted-foreground uppercase tracking-wider">built-in</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{t.description}</div>
              </button>
              {!isBuiltin && (
                <button
                  onClick={() => discardTemplate(t.id)}
                  className="flex items-center px-1.5 rounded-lg border border-border/60 bg-muted/20 text-muted-foreground/80 hover:text-warning hover:bg-warning/10 hover:border-warning/30 transition-colors"
                  title="Discard template (recoverable for 7 days)"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Discarded templates (collapsible) */}
      {discardedTemplates.length > 0 && (
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setShowDiscarded(v => !v)}
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground/80 hover:text-foreground/80 transition-colors"
          >
            <ChevronRight size={10} className={`transition-transform ${showDiscarded ? 'rotate-90' : ''}`} />
            Discarded ({discardedTemplates.length})
          </button>
          {showDiscarded && (
            <div className="flex flex-col gap-1 pl-1">
              {discardedTemplates.map(t => (
                <div key={t.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-border/60 bg-muted/20 text-muted-foreground">
                  <span className="flex-1 text-[11px] truncate">{t.name}</span>
                  <button
                    onClick={() => restoreTemplate(t.id)}
                    className="p-0.5 rounded text-muted-foreground/80 hover:text-accent hover:bg-accent/10 transition-colors"
                    title="Restore template"
                  >
                    <RotateCcw size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Presets */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Presets</span>
        <div className="flex flex-wrap gap-1">
          {presets.map(p => (
            <button
              key={p.label}
              onClick={() => { Object.entries(p.params).forEach(([k, v]) => setParam(k as keyof typeof params, v as never)); }}
              className="px-2 py-1 rounded text-[10px] border border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground/80 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={resetDefaults}
        className="mt-2 px-3 py-1.5 rounded-lg border border-border/60 bg-muted/20 text-[11px] text-muted-foreground hover:bg-muted/40 hover:text-foreground/80 transition-colors"
      >
        Reset defaults
      </button>
    </div>
  );
}
