'use client';

import { useExplorer } from './IntentProvider';
import { CATEGORY_COLORS } from './types';

export function IntentRightPanel() {
  const { catalog, selectedIntentId } = useExplorer();

  if (!selectedIntentId) {
    return (
      <div className="p-4 space-y-2">
        <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
          Inspector
        </div>
        <div className="text-[11px] font-mono text-muted-foreground">
          Select an intent to inspect
        </div>
      </div>
    );
  }

  const entry = catalog.index[selectedIntentId];
  if (!entry) return null;

  const { intent, appId } = entry;
  const categoryColors = CATEGORY_COLORS[intent.category];

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full frame-scrollbar">
      {/* Title */}
      <div className="space-y-1">
        <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
          Intent
        </div>
        <div className="text-[13px] font-mono font-bold text-foreground tracking-wider">
          {intent.title}
        </div>
      </div>

      <div className="h-px bg-border/60" />

      {/* Attributes grid */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
          Attributes
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[11px] font-mono">
          <div className="text-muted-foreground">commandId</div>
          <div className="text-success font-mono truncate">{intent.commandId}</div>

          <div className="text-muted-foreground">app</div>
          <div className="text-foreground">{appId}</div>

          <div className="text-muted-foreground">category</div>
          <div>
            <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${categoryColors}`}>
              {intent.category}
            </span>
          </div>

          {intent.shortcut && (
            <>
              <div className="text-muted-foreground">shortcut</div>
              <div>
                <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[11px] font-mono">
                  {intent.shortcut}
                </span>
              </div>
            </>
          )}

          {intent.dangerous && (
            <>
              <div className="text-muted-foreground">dangerous</div>
              <div className="text-destructive">true</div>
            </>
          )}
        </div>
      </div>

      <div className="h-px bg-border/60" />

      {/* Description */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
          Description
        </div>
        <div className="text-[11px] font-mono text-foreground leading-relaxed">
          {intent.description}
        </div>
      </div>

      <div className="h-px bg-border/60" />

      {/* Keywords */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
          Keywords
        </div>
        <div className="text-[11px] font-mono text-muted-foreground">
          {intent.keywords.join(' \u00b7 ')}
        </div>
      </div>

      {/* Params table (if any) */}
      {intent.params && intent.params.length > 0 && (
        <>
          <div className="h-px bg-border/60" />
          <div className="space-y-2">
            <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
              Parameters
            </div>
            <div className="space-y-2">
              {intent.params.map(p => (
                <div key={p.name} className="bg-muted/40 rounded px-3 py-2 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] font-mono text-success">{p.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{p.type}</span>
                    {p.optional && (
                      <span className="text-[9px] font-mono text-muted-foreground/70">optional</span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">{p.description}</div>
                  {p.enum && (
                    <div className="text-[10px] font-mono text-muted-foreground">
                      enum: {p.enum.join(' | ')}
                    </div>
                  )}
                  {p.default !== undefined && (
                    <div className="text-[10px] font-mono text-muted-foreground">
                      default: {String(p.default)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
