'use client';

import { RotateCcw } from 'hudsonkit/icons';
import {
  TOKEN_GROUPS,
  parseOklchValue,
  setOklchPart,
  tokenSwatchValue,
} from './model';
import { useThemeDesigner } from './ThemeDesignerProvider';

function tokenGroupFor(key: string) {
  return TOKEN_GROUPS.find(group => group.tokens.includes(key as never)) ?? TOKEN_GROUPS[TOKEN_GROUPS.length - 1];
}

function Slider({ label, value, min, max, step, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 rounded-md border border-border bg-background p-2">
      <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span className="text-foreground/80">{value.toFixed(label === 'H' ? 1 : 3)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        className="w-full accent-accent"
      />
    </label>
  );
}

export function ThemeDesignerInspector() {
  const designer = useThemeDesigner();
  const value = designer.effective[designer.selectedToken] ?? '';
  const resolver = (name: string) => designer.effective[name];
  const parsed = parseOklchValue(value, resolver);
  const swatch = tokenSwatchValue(value, resolver);
  const changed = designer.changedKeys.includes(designer.selectedToken);
  const group = tokenGroupFor(designer.selectedToken);
  const groupedKeys = TOKEN_GROUPS.map(tokenGroup => ({
    group: tokenGroup,
    keys: designer.tokenKeys.filter(key => tokenGroup.tokens.includes(key as never)),
  })).filter(section => section.keys.length > 0);
  const ungroupedKeys = designer.tokenKeys.filter(key => !TOKEN_GROUPS.some(tokenGroup => tokenGroup.tokens.includes(key as never)) && key !== 'color-scheme');

  const updatePart = (part: 'l' | 'c' | 'h' | 'alpha', nextValue: number) => {
    designer.updateToken(designer.selectedToken, setOklchPart(value, { [part]: nextValue }, resolver));
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      <div className="flex-1 overflow-y-auto p-3 frame-scrollbar">
        <section className="mb-4 rounded-lg border border-border bg-card/75 p-3">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Inspector</div>
              <div className="mt-1 truncate font-mono text-[12px] text-foreground">{designer.selectedToken}</div>
              <div className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{group.label}</div>
            </div>
            <div className="h-10 w-10 shrink-0 rounded-lg border border-border bg-muted" style={{ background: swatch ?? undefined }} />
          </div>

          <div className="mb-3 flex items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${changed ? 'border-warning/50 bg-warning/10 text-warning' : 'border-border bg-muted text-muted-foreground'}`}>
              {changed ? 'changed' : 'saved'}
            </span>
            {parsed?.alias && (
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                alias {parsed.alias}
              </span>
            )}
          </div>

          {parsed ? (
            <div className="space-y-2">
              <Slider label="L" value={Math.max(0, Math.min(1, parsed.l))} min={0} max={1} step={0.001} onChange={next => updatePart('l', next)} />
              <Slider label="C" value={Math.max(0, Math.min(0.4, parsed.c))} min={0} max={0.4} step={0.001} onChange={next => updatePart('c', next)} />
              <Slider label="H" value={((parsed.h % 360) + 360) % 360} min={0} max={360} step={0.1} onChange={next => updatePart('h', next)} />
              {(parsed.alpha !== undefined || /-(soft|line)$/.test(designer.selectedToken)) && (
                <Slider label="A" value={parsed.alpha ?? 1} min={0} max={1} step={0.01} onChange={next => updatePart('alpha', next)} />
              )}
            </div>
          ) : (
            <div className="rounded-md border border-border bg-muted/50 p-2 text-[10px] leading-relaxed text-muted-foreground">
              This value is not a direct OKLCH color. Edit the raw token string below; shadows, radii, fonts, and rgba grid tokens are preserved as text.
            </div>
          )}

          <label className="mt-3 block space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Raw value</span>
            <textarea
              value={value}
              onChange={event => designer.updateToken(designer.selectedToken, event.target.value)}
              className="min-h-20 w-full resize-y rounded-md border border-border bg-background p-2 font-mono text-[11px] leading-relaxed text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
          </label>

          <button
            type="button"
            onClick={() => designer.resetToken(designer.selectedToken)}
            disabled={!changed}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-foreground/80 transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCcw size={12} /> Reset token
          </button>
        </section>

        <section className="space-y-3">
          {groupedKeys.map(section => (
            <div key={section.group.id} className="rounded-lg border border-border bg-card/70 p-2">
              <button
                type="button"
                onClick={() => designer.setSelectedGroup(section.group.id)}
                className="mb-1 flex w-full items-center justify-between rounded px-1.5 py-1 text-left text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>{section.group.label}</span>
                <span>{section.keys.filter(key => designer.changedKeys.includes(key)).length}</span>
              </button>
              <div className="space-y-1">
                {section.keys.map(key => {
                  const tokenValue = designer.effective[key] ?? '';
                  const tokenSwatch = tokenSwatchValue(tokenValue, resolver);
                  const isSelected = key === designer.selectedToken;
                  const isChanged = designer.changedKeys.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => designer.setSelectedToken(key)}
                      className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isSelected
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-transparent text-foreground/80 hover:border-border hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <span className="h-4 w-4 shrink-0 rounded border border-border bg-muted" style={{ background: tokenSwatch ?? undefined }} />
                      <span className="min-w-0 flex-1 truncate font-mono text-[10px]">{key}</span>
                      {isChanged && <span className="h-1.5 w-1.5 rounded-full bg-warning" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {ungroupedKeys.length > 0 && (
            <div className="rounded-lg border border-border bg-card/70 p-2">
              <div className="mb-1 px-1.5 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Other</div>
              <div className="space-y-1">
                {ungroupedKeys.map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => designer.setSelectedToken(key)}
                    className="flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-foreground/80 transition hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px]">{key}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
