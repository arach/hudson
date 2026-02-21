'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  X,
  ChevronDown,
  ChevronRight,
  Move,
  LayoutList,
  LayoutGrid,
  Settings,
  RotateCcw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ComponentEntry, ViewMode, HudsonSettings } from './types';

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
  const Icon = entry.icon;
  const g = glowIntensity / 100;
  const selectedShadow = `0 0 40px rgba(16,185,129,${(0.3*g).toFixed(3)}), 0 0 80px rgba(16,185,129,${(0.15*g).toFixed(3)}), inset 0 1px 0 rgba(16,185,129,${(0.2*g).toFixed(3)})`;
  return (
    <div
      onClick={onSelect}
      onMouseDown={onDragStart}
      style={{ boxShadow: isSelected ? selectedShadow : '0 0 40px rgba(0,0,0,0.6)' }}
      className={`w-[340px] border rounded-lg bg-neutral-800/80 backdrop-blur-md overflow-hidden transition-all pointer-events-auto cursor-grab active:cursor-grabbing ${
        isSelected
          ? 'border-emerald-500/80'
          : 'border-neutral-700/60 hover:border-neutral-600/80'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700/50">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-emerald-400" />
          <div>
            <span className="text-[13px] font-mono font-bold text-white tracking-wider">{entry.label}</span>
            <div className="text-[10px] font-mono text-neutral-400">{entry.ns}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded transition-colors text-neutral-400 hover:text-white pointer-events-auto"
        >
          <X size={12} />
        </button>
      </div>

      {/* Overview */}
      <div className="px-4 py-3 border-b border-neutral-700/30">
        <div className="text-[11px] font-mono text-neutral-200 leading-relaxed">{entry.overview}</div>
      </div>

      {/* Props table */}
      <div className="px-4 py-3 border-b border-neutral-700/30">
        <div className="text-[10px] font-mono text-neutral-300 tracking-widest uppercase mb-2">Props</div>
        <div className="space-y-2">
          {entry.props.map(p => (
            <div key={p.name}>
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] font-mono text-emerald-400">{p.name}</span>
                <span className="text-[10px] font-mono text-neutral-400">{p.type}</span>
              </div>
              <div className="text-[10px] font-mono text-neutral-300 mt-0.5">{p.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Usage */}
      <div className="px-4 py-3 border-b border-neutral-700/30">
        <div className="text-[10px] font-mono text-neutral-300 tracking-widest uppercase mb-2">Usage</div>
        <pre className="text-[10px] font-mono text-neutral-200 bg-neutral-900/60 rounded px-3 py-2 overflow-x-auto whitespace-pre">{entry.usage}</pre>
      </div>

      {/* Notes */}
      {entry.notes && entry.notes.length > 0 && (
        <div className="px-4 py-3">
          <div className="text-[10px] font-mono text-neutral-300 tracking-widest uppercase mb-2">Notes</div>
          <ul className="space-y-1">
            {entry.notes.map((n, i) => (
              <li key={i} className="text-[10px] font-mono text-neutral-300 flex items-start gap-1.5">
                <span className="text-emerald-500/60 mt-px">-</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
    <div className="flex bg-neutral-800/80 rounded border border-neutral-700 overflow-hidden">
      {modes.map((m, i) => {
        const MIcon = m.icon;
        const active = value === m.value;
        return (
          <button
            key={m.value}
            onClick={() => onChange(m.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono transition-colors ${
              active
                ? 'bg-emerald-600/20 text-emerald-400'
                : 'text-neutral-300 hover:text-neutral-200 hover:bg-white/5'
            } ${i > 0 ? 'border-l border-neutral-700' : ''}`}
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
          <div className="text-center text-neutral-400 text-[12px] font-mono py-12">No components match &quot;{searchValue}&quot;</div>
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
                  ? 'border-emerald-500/60 bg-neutral-800/80 backdrop-blur-md ring-1 ring-emerald-500/20'
                  : isExpanded ? 'border-emerald-500/30 bg-neutral-800/80 backdrop-blur-md' : 'border-neutral-700/40 bg-neutral-800/50 hover:border-neutral-700/60 hover:bg-neutral-800/60'
              }`}
            >
              <button
                onClick={(e) => { e.stopPropagation(); onSelect(c.id); setExpandedId(isExpanded ? null : c.id); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <Icon size={14} className={isSelected || isExpanded ? 'text-emerald-400' : 'text-neutral-400'} />
                <div className="flex-1 min-w-0">
                  <div>
                    <span className={`text-[13px] font-mono font-bold tracking-wider ${isSelected || isExpanded ? 'text-emerald-400' : 'text-white'}`}>{c.label}</span>
                    <span className="text-[11px] font-mono text-neutral-300 ml-3">{c.desc}</span>
                  </div>
                  <div className="text-[10px] font-mono text-neutral-400">{c.ns}</div>
                </div>
                {isExpanded ? <ChevronDown size={14} className="text-neutral-400" /> : <ChevronRight size={14} className="text-neutral-400" />}
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-neutral-700/30">
                  <div className="pt-3">
                    <div className="text-[11px] font-mono text-neutral-200 leading-relaxed">{c.overview}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-neutral-300 tracking-widest uppercase mb-2">Props</div>
                    <div className="space-y-2">
                      {c.props.map(p => (
                        <div key={p.name}>
                          <div className="flex items-baseline gap-2">
                            <span className="text-[11px] font-mono text-emerald-400">{p.name}</span>
                            <span className="text-[10px] font-mono text-neutral-400">{p.type}</span>
                          </div>
                          <div className="text-[10px] font-mono text-neutral-300 mt-0.5">{p.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-neutral-300 tracking-widest uppercase mb-2">Usage</div>
                    <pre className="text-[10px] font-mono text-neutral-200 bg-neutral-900/60 rounded px-3 py-2 overflow-x-auto whitespace-pre">{c.usage}</pre>
                  </div>
                  {c.notes && c.notes.length > 0 && (
                    <div>
                      <div className="text-[10px] font-mono text-neutral-300 tracking-widest uppercase mb-2">Notes</div>
                      <ul className="space-y-1">
                        {c.notes.map((n, i) => (
                          <li key={i} className="text-[10px] font-mono text-neutral-300 flex items-start gap-1.5">
                            <span className="text-emerald-500/60 mt-px">-</span>
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
          <LayoutGrid size={24} className="text-neutral-500 mx-auto" />
          <div className="text-[12px] font-mono text-neutral-400">No components tiled</div>
          <div className="text-[11px] font-mono text-neutral-400">Open components from the left panel to tile them here</div>
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
              className={`border rounded-lg bg-neutral-800/80 backdrop-blur-md overflow-hidden flex flex-col cursor-pointer transition-all ${
                isSelected
                  ? 'border-emerald-500/80 ring-1 ring-emerald-500/20'
                  : 'border-emerald-500/30'
              }`}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700/50 shrink-0">
                <div className="flex items-center gap-2">
                  <Icon size={14} className="text-emerald-400" />
                  <div>
                    <span className="text-[13px] font-mono font-bold text-white tracking-wider">{c.label}</span>
                    <div className="text-[10px] font-mono text-neutral-400">{c.ns}</div>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onClose(c.id); }}
                  className="p-1 hover:bg-white/10 rounded transition-colors text-neutral-400 hover:text-white"
                >
                  <X size={12} />
                </button>
              </div>
              <div className="overflow-y-auto frame-scrollbar flex-1">
                <div className="px-4 py-3 border-b border-neutral-700/30">
                  <div className="text-[11px] font-mono text-neutral-200 leading-relaxed">{c.overview}</div>
                </div>
                <div className="px-4 py-3 border-b border-neutral-700/30">
                  <div className="text-[10px] font-mono text-neutral-300 tracking-widest uppercase mb-2">Props</div>
                  <div className="space-y-2">
                    {c.props.map(p => (
                      <div key={p.name}>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[11px] font-mono text-emerald-400">{p.name}</span>
                          <span className="text-[10px] font-mono text-neutral-400">{p.type}</span>
                        </div>
                        <div className="text-[10px] font-mono text-neutral-300 mt-0.5">{p.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="px-4 py-3 border-b border-neutral-700/30">
                  <div className="text-[10px] font-mono text-neutral-300 tracking-widest uppercase mb-2">Usage</div>
                  <pre className="text-[10px] font-mono text-neutral-200 bg-neutral-900/60 rounded px-3 py-2 overflow-x-auto whitespace-pre">{c.usage}</pre>
                </div>
                {c.notes && c.notes.length > 0 && (
                  <div className="px-4 py-3">
                    <div className="text-[10px] font-mono text-neutral-300 tracking-widest uppercase mb-2">Notes</div>
                    <ul className="space-y-1">
                      {c.notes.map((n, i) => (
                        <li key={i} className="text-[10px] font-mono text-neutral-300 flex items-start gap-1.5">
                          <span className="text-emerald-500/60 mt-px">-</span>
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

// ---------------------------------------------------------------------------
// Settings sub-components
// ---------------------------------------------------------------------------
export function SettingsSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-4 border-b border-neutral-700/50">
      <div className="text-[10px] font-mono text-neutral-300 tracking-widest uppercase mb-4">{label}</div>
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
      <div className="text-[12px] font-mono text-neutral-200 w-[140px] shrink-0">{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 appearance-none bg-neutral-700 rounded-full cursor-pointer accent-emerald-500
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500
          [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(16,185,129,0.4)]"
      />
      <div className="text-[11px] font-mono text-neutral-200 w-[48px] text-right tabular-nums">{format(value)}</div>
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
      <div className="text-[12px] font-mono text-neutral-200">{label}</div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-9 h-5 rounded-full relative transition-colors ${checked ? 'bg-emerald-600' : 'bg-neutral-700'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'left-[18px]' : 'left-0.5'}`} />
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
      <div className="text-[12px] font-mono text-neutral-200 w-[140px] shrink-0">{label}</div>
      <div className="flex bg-neutral-800 rounded border border-neutral-700 overflow-hidden">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-[11px] font-mono transition-colors ${
              value === opt.value
                ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            } ${opt.value !== options[0].value ? 'border-l border-neutral-700' : ''}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
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
        className="w-[480px] max-w-[90vw] bg-[#161616] border border-neutral-700 shadow-2xl rounded-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700">
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-emerald-400" />
            <span className="text-[13px] font-mono font-bold text-white tracking-wider">SETTINGS</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors text-neutral-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
        <div className="overflow-y-auto max-h-[60vh] frame-scrollbar">
          <SettingsSection label="Appearance">
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
          </SettingsSection>
          <SettingsSection label="Navigation">
            <SettingsSlider
              label="Zoom Sensitivity"
              value={settings.zoomSensitivity}
              min={0.5} max={3} step={0.1}
              format={v => `${v.toFixed(1)}x`}
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
                ['Cmd + [', 'Toggle left panel'],
                ['Cmd + ]', 'Toggle right panel'],
                ['Cmd + \\', 'Toggle crosshair guides'],
                ['Ctrl + `', 'Toggle terminal'],
                ['Cmd + M', 'Toggle mute'],
              ].map(([key, desc]) => (
                <div key={key} className="contents">
                  <div className="text-emerald-400/80 whitespace-nowrap">{key}</div>
                  <div className="text-neutral-300">{desc}</div>
                </div>
              ))}
            </div>
          </SettingsSection>
        </div>
        <div className="px-6 py-3 bg-neutral-800/90 backdrop-blur-sm border-t border-neutral-700 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-neutral-300">Settings</span>
            <div className="px-1.5 py-0.5 rounded bg-neutral-700 border border-neutral-700 text-[11px] text-neutral-200 font-mono">&#8984;,</div>
          </div>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono text-neutral-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <RotateCcw size={10} />
            Reset All
          </button>
        </div>
      </div>
    </div>
  );
}
