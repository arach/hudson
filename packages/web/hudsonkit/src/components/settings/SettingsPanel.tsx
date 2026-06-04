'use client';

import { useEffect, type ReactNode } from 'react';
import { RotateCcw, Settings, X } from 'lucide-react';
import type { AppSettingsConfig } from '../../types/app';
import type { AppSettingsValues } from '../../hooks/useAppSettings';
import type { HudsonSettings } from '../../types/settings';

// ---------------------------------------------------------------------------
// Settings sub-components
// ---------------------------------------------------------------------------
export function SettingsSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-6 py-4 border-b border-border/70">
      <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-4">{label}</div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function SettingsSlider({ label, value, min, max, step, format, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="text-[12px] font-mono text-foreground/84 w-[140px] shrink-0">{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 appearance-none bg-muted rounded-full cursor-pointer accent-accent
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent
          [&::-webkit-slider-thumb]:shadow-[0_0_6px_oklch(var(--accent)/0.4)]"
      />
      <div className="text-[11px] font-mono text-foreground/84 w-[48px] text-right tabular-nums">{format(value)}</div>
    </div>
  );
}

export function SettingsToggle({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-[12px] font-mono text-foreground/84">{label}</div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-9 h-5 rounded-full relative transition-colors ${checked ? 'bg-accent' : 'bg-muted'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-card shadow transition-transform ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

export function SettingsSegment<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="text-[12px] font-mono text-foreground/84 w-[140px] shrink-0">{label}</div>
      <div className="flex bg-card rounded border border-border overflow-hidden">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-[11px] font-mono transition-colors ${
              value === opt.value
                ? 'bg-accent/20 text-accent border-accent/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/8'
            } ${opt.value !== options[0].value ? 'border-l border-border' : ''}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App settings entry passed from WorkspaceShell
// ---------------------------------------------------------------------------
export interface AppSettingsEntry {
  appId: string;
  appName: string;
  config: AppSettingsConfig;
  values: AppSettingsValues;
  onUpdate: (patch: Partial<AppSettingsValues>) => void;
}

export function SettingsText({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="text-[12px] font-mono text-foreground/84 w-[140px] shrink-0">{label}</div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 bg-card border border-border rounded px-2 py-1 text-[11px] font-mono text-foreground/84 focus:border-accent/50 focus:outline-none transition-colors"
      />
    </div>
  );
}

export function SettingsSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="text-[12px] font-mono text-foreground/84 w-[140px] shrink-0">{label}</div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 bg-card border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground/84 focus:border-accent/50 focus:outline-none transition-colors appearance-none cursor-pointer"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable font settings card — use at shell (global) or workspace level
// ---------------------------------------------------------------------------

const FONT_FAMILIES = [
  { value: 'system-ui', label: 'System UI' },
  { value: "'SF Pro', system-ui", label: 'SF Pro' },
  { value: "'SF Rounded', system-ui", label: 'SF Rounded' },
  { value: "'Inter', system-ui", label: 'Inter' },
  { value: "'JetBrains Mono', monospace", label: 'JetBrains Mono' },
  { value: "'Hack Nerd Font', monospace", label: 'Hack Nerd Font' },
  { value: "'SF Mono', monospace", label: 'SF Mono' },
  { value: "'IBM Plex Sans', system-ui", label: 'IBM Plex Sans' },
  { value: "'IBM Plex Mono', monospace", label: 'IBM Plex Mono' },
];

export function FontSettingsCard({ fontSize, fontFamily, onChangeFontSize, onChangeFontFamily }: {
  fontSize: number;
  fontFamily: string;
  onChangeFontSize: (size: number) => void;
  onChangeFontFamily: (family: string) => void;
}) {
  return (
    <>
      <SettingsSlider
        label="Font Size"
        value={fontSize}
        min={10}
        max={20}
        step={1}
        format={v => `${v}px`}
        onChange={onChangeFontSize}
      />
      <SettingsSelect
        label="Font Family"
        value={fontFamily}
        options={FONT_FAMILIES}
        onChange={onChangeFontFamily}
      />
      {/* Live preview */}
      <div className="mt-1 px-3 py-2 rounded bg-card/70 border border-border/60">
        <div
          className="text-foreground/78 leading-relaxed"
          style={{ fontSize: `${fontSize}px`, fontFamily }}
        >
          The quick brown fox jumps over the lazy dog
        </div>
        <div
          className="text-muted-foreground mt-1"
          style={{ fontSize: `${Math.max(fontSize - 2, 9)}px`, fontFamily }}
        >
          0123456789 — ABCDEF abcdef
        </div>
      </div>
    </>
  );
}

export function SettingsPanel({ isOpen, onClose, settings, onUpdate, onReset }: {
  isOpen: boolean;
  onClose: () => void;
  settings: HudsonSettings;
  onUpdate: (patch: Partial<HudsonSettings>) => void;
  onReset: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-black/60 backdrop-blur-[2px] pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="w-[480px] max-w-[90vw] bg-card border border-border shadow-2xl rounded-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-accent" />
            <span className="text-[13px] font-mono font-bold text-foreground tracking-wider">SETTINGS</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-accent/10 rounded transition-colors text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh] frame-scrollbar">
          <SettingsSection label="Appearance">
            <SettingsSegment
              label="Theme"
              value={settings.theme}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              onChange={v => onUpdate({ theme: v })}
            />
            <SettingsSegment
              label="Template"
              value={settings.template}
              options={[
                { value: 'hudson', label: 'Hudson' },
                { value: 'editorial', label: 'Editorial' },
                { value: 'drafting', label: 'Drafting' },
              ]}
              onChange={v => onUpdate({ template: v })}
            />
            <SettingsSlider
              label="Glow Intensity"
              value={settings.glowIntensity}
              min={0} max={100} step={1}
              format={v => `${v}%`}
              onChange={v => onUpdate({ glowIntensity: v })}
            />
            <SettingsSegment
              label="Connector Style"
              value={settings.connectorStyle}
              options={[
                { value: 'dashed', label: 'Dashed' },
                { value: 'solid', label: 'Solid' },
                { value: 'dotted', label: 'Dotted' },
              ]}
              onChange={v => onUpdate({ connectorStyle: v })}
            />
            <div className="rounded border border-border/60 bg-secondary/70 px-3 py-2 text-[10px] font-mono text-muted-foreground">
              Theme updates the workspace chrome immediately. Template swaps the token bundle that
              drives shell surfaces, accents, and radius.
            </div>
          </SettingsSection>
          <SettingsSection label="Navigation">
            <SettingsSlider
              label="Zoom Sensitivity"
              value={settings.zoomSensitivity ?? 1.0}
              min={0.5} max={3} step={0.1}
              format={v => `${(v ?? 1.0).toFixed(1)}x`}
              onChange={v => onUpdate({ zoomSensitivity: v })}
            />
          </SettingsSection>
          <SettingsSection label="Sound">
            <SettingsToggle label="Master Mute" checked={settings.masterMute} onChange={v => onUpdate({ masterMute: v })} />
            <SettingsToggle label="Click Sounds" checked={settings.uiClickSounds} onChange={v => onUpdate({ uiClickSounds: v })} />
            <SettingsToggle label="Transition Sounds" checked={settings.uiTransitionSounds} onChange={v => onUpdate({ uiTransitionSounds: v })} />
          </SettingsSection>
          <SettingsSection label="Shortcuts">
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[11px] font-mono">
              {[
                ['Space + Drag', 'Pan canvas'],
                ['Cmd + Scroll', 'Zoom in / out'],
                ['Cmd + 0', 'Reset view'],
                ['Cmd + 1 / 2 / 3', 'Canvas / List / Tiles view'],
                ['Cmd + K', 'Command palette'],
                ['Cmd + ,', 'Settings'],
                ['Cmd + Shift + ,', 'Workspace Manager'],
                ['Cmd + [', 'Toggle left panel'],
                ['Cmd + ]', 'Toggle right panel'],
                ['Cmd + \\', 'Toggle crosshair guides'],
                ['Ctrl + `', 'Toggle terminal'],
                ['Cmd + M', 'Toggle mute'],
              ].map(([key, desc]) => (
                  <div key={key} className="contents">
                    <div className="text-accent/80 whitespace-nowrap">{key}</div>
                  <div className="text-foreground/76">{desc}</div>
                </div>
              ))}
            </div>
          </SettingsSection>
        </div>
        <div className="px-6 py-3 bg-card/95 backdrop-blur-sm border-t border-border flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-foreground/76">Settings</span>
            <div className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[11px] text-foreground/82 font-mono">&#8984;,</div>
          </div>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono text-foreground/82 hover:text-foreground hover:bg-accent/10 transition-colors"
          >
            <RotateCcw size={10} />
            Reset All
          </button>
        </div>
      </div>
    </div>
  );
}

export function ServiceActionButton({ label, variant = 'primary', onClick, loading = false }: {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
  loading?: boolean;
}) {
  const colors = {
    primary: 'bg-accent/20 text-accent hover:bg-accent/30 border-accent/20',
    secondary: 'bg-card text-muted-foreground hover:bg-accent/10 border-border',
    danger: 'bg-destructive/20 text-destructive hover:bg-destructive/30 border-destructive/20',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`px-3 py-1 text-[11px] font-mono font-medium rounded border transition-colors inline-flex items-center gap-1.5 ${colors[variant]} ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      {loading && (
        <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
      )}
      {label}
    </button>
  );
}
