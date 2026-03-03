'use client';
import { X } from 'lucide-react';
import { useLogo } from './LogoProvider';
import { isBuiltinVariant } from './types';

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/50">{label}</span>
        <span className="text-[11px] font-mono text-white/30">{value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-emerald-500 h-1"
      />
    </label>
  );
}

function ColorInput({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  const isRgba = value.startsWith('rgba');
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-white/50">{label}</span>
      {isRgba ? (
        <span className="text-[10px] font-mono text-white/25 truncate max-w-[120px]">{value}</span>
      ) : (
        <div className="flex items-center gap-1.5">
          <input type="color" value={value} onChange={e => onChange(e.target.value)}
            className="w-5 h-5 rounded border border-white/10 cursor-pointer bg-transparent" />
          <span className="text-[10px] font-mono text-white/30">{value}</span>
        </div>
      )}
    </label>
  );
}

export function LogoLeftPanel() {
  const {
    params, setParam, setVariant, resetDefaults, presets,
    templates, deleteTemplate, customParamValues, setCustomParam,
  } = useLogo();

  const activeTemplate = templates.find(t => t.id === params.variant);

  return (
    <div className="flex flex-col gap-4 p-3 text-sm overflow-y-auto h-full">
      {/* Template picker */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-widest text-white/30">Variant</span>
        {templates.map(t => {
          const isActive = params.variant === t.id;
          const isBuiltin = isBuiltinVariant(t.id);
          return (
            <div key={t.id} className="flex items-stretch gap-1">
              <button
                onClick={() => setVariant(t.id)}
                className={`flex-1 text-left px-2.5 py-2 rounded-lg border text-[12px] transition-colors ${
                  isActive
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-white'
                    : 'border-white/6 bg-white/3 text-white/50 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{t.name}</span>
                  {isBuiltin && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-white/5 text-white/25 uppercase tracking-wider">built-in</span>
                  )}
                </div>
                <div className="text-[10px] text-white/30 mt-0.5">{t.description}</div>
              </button>
              {!isBuiltin && (
                <button
                  onClick={() => deleteTemplate(t.id)}
                  className="flex items-center px-1.5 rounded-lg border border-white/6 bg-white/3 text-white/20 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-colors"
                  title="Delete template"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Presets */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-widest text-white/30">Presets</span>
        <div className="flex flex-wrap gap-1">
          {presets.map(p => (
            <button
              key={p.label}
              onClick={() => { Object.entries(p.params).forEach(([k, v]) => setParam(k as keyof typeof params, v as never)); }}
              className="px-2 py-1 rounded text-[10px] border border-white/6 bg-white/3 text-white/40 hover:bg-white/6 hover:text-white/60 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom template params */}
      {activeTemplate && activeTemplate.params.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-widest text-white/30">
            {activeTemplate.name} params
          </span>
          {activeTemplate.params.map(p => {
            const values = customParamValues[activeTemplate.id] ?? {};
            const val = values[p.key] ?? p.default;
            if (p.type === 'number') {
              return (
                <Slider
                  key={p.key}
                  label={p.label}
                  value={val as number}
                  min={p.min ?? 0}
                  max={p.max ?? 100}
                  step={p.step ?? 1}
                  onChange={v => setCustomParam(activeTemplate.id, p.key, v)}
                />
              );
            }
            if (p.type === 'color') {
              return (
                <ColorInput
                  key={p.key}
                  label={p.label}
                  value={val as string}
                  onChange={v => setCustomParam(activeTemplate.id, p.key, v)}
                />
              );
            }
            return null;
          })}
        </div>
      )}

      {/* Proportions */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] uppercase tracking-widest text-white/30">Proportions</span>
        <Slider label="Gap width" value={params.gapWidth} min={4} max={32} step={1}
          onChange={v => setParam('gapWidth', v)} />
        <Slider label="Split X (vertical arm)" value={params.splitX} min={0.2} max={0.5} step={0.01}
          onChange={v => setParam('splitX', v)} />
        <Slider label="Split Y (horizontal arm)" value={params.splitY} min={0.4} max={0.8} step={0.01}
          onChange={v => setParam('splitY', v)} />
        <Slider label="Padding" value={params.padding} min={40} max={120} step={2}
          onChange={v => setParam('padding', v)} />
        <Slider label="Border radius (outer)" value={params.borderRadius} min={0} max={128} step={2}
          onChange={v => setParam('borderRadius', v)} />
        <Slider label="Pane radius" value={params.paneRadius} min={0} max={32} step={1}
          onChange={v => setParam('paneRadius', v)} />
      </div>

      {/* Colors */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] uppercase tracking-widest text-white/30">Colors</span>
        <ColorInput label="Background" value={params.bgColor} onChange={v => setParam('bgColor', v)} />
        <ColorInput label="Pane fill" value={params.paneColor} onChange={v => setParam('paneColor', v)} />
        <ColorInput label="Dim pane" value={params.dimPaneColor} onChange={v => setParam('dimPaneColor', v)} />
        <ColorInput label="Channel" value={params.channelColor} onChange={v => setParam('channelColor', v)} />
      </div>

      {/* Reset */}
      <button
        onClick={resetDefaults}
        className="mt-2 px-3 py-1.5 rounded-lg border border-white/8 bg-white/3 text-[11px] text-white/40 hover:bg-white/6 hover:text-white/60 transition-colors"
      >
        Reset defaults
      </button>
    </div>
  );
}
