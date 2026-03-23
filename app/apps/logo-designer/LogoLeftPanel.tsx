'use client';
import { X } from 'lucide-react';
import { useLogo } from './LogoProvider';
import { isBuiltinVariant } from './types';

// ---------------------------------------------------------------------------
// Left panel — variant selection + presets (navigation only)
// ---------------------------------------------------------------------------

export function LogoLeftPanel() {
  const {
    params, setParam, setVariant, resetDefaults, presets, templates, deleteTemplate,
  } = useLogo();

  return (
    <div className="flex flex-col gap-4 p-3 text-sm overflow-y-auto h-full">
      {/* Template picker */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-widest text-white/30">Variant</span>
        {templates.length === 0 && (
          <div className="text-[11px] text-white/25 px-2 py-3 text-center border border-dashed border-white/8 rounded-lg">
            Loading templates...
          </div>
        )}
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
