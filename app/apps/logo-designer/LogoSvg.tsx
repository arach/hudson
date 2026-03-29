'use client';
import { AlertTriangle, RefreshCw, ChevronRight } from 'lucide-react';
import type { LogoParams } from './LogoProvider';
import { useLogo } from './LogoProvider';
import { TemplateSvg, useTemplateRender } from './TemplateSvg';

interface Props {
  params: LogoParams;
  size: number;
}

export function LogoSvg({ params, size }: Props) {
  const { templates, customParamValues, backgroundSvg, setVariant, refreshTemplates } = useLogo();
  const template = templates.find(t => t.id === params.variant);

  if (!template) {
    const fallback = templates[0];
    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={size} height={size}>
          <rect width="512" height="512" rx="40" fill="#1a1a1a" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <AlertTriangle size={24} className="text-amber-400/60" />
          <span className="text-[13px] text-white/50 font-mono">Template not found</span>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => refreshTemplates()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.10] text-[11px] font-mono text-white/50 hover:text-white/70 transition-colors"
            >
              <RefreshCw size={10} /> Reload
            </button>
            {fallback && (
              <button
                onClick={() => setVariant(fallback.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.10] text-[11px] font-mono text-white/50 hover:text-white/70 transition-colors"
              >
                {fallback.name} <ChevronRight size={10} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <LogoSvgInner
      template={template}
      params={params}
      customParamValues={customParamValues[template.id] ?? {}}
      backgroundSvg={backgroundSvg}
      size={size}
      templates={templates}
      setVariant={setVariant}
      refreshTemplates={refreshTemplates}
    />
  );
}

/** Inner component that can call useTemplateRender (needs a valid template). */
function LogoSvgInner({
  template,
  params,
  customParamValues,
  backgroundSvg,
  size,
  templates,
  setVariant,
  refreshTemplates,
}: {
  template: Parameters<typeof TemplateSvg>[0]['template'];
  params: LogoParams;
  customParamValues: Record<string, number | string | Record<string, unknown>[]>;
  backgroundSvg?: string | null;
  size: number;
  templates: { id: string; name: string }[];
  setVariant: (v: string) => void;
  refreshTemplates: () => void;
}) {
  const { error } = useTemplateRender(template, params, customParamValues, backgroundSvg);

  // Find adjacent templates for quick switching
  const currentIdx = templates.findIndex(t => t.id === template.id);
  const prevTemplate = currentIdx > 0 ? templates[currentIdx - 1] : null;
  const nextTemplate = currentIdx < templates.length - 1 ? templates[currentIdx + 1] : null;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <TemplateSvg
        template={template}
        params={params}
        customParamValues={customParamValues}
        backgroundSvg={backgroundSvg}
        size={size}
      />
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 backdrop-blur-sm rounded-[inherit]">
          <AlertTriangle size={20} className="text-red-400/70" />
          <div className="text-center px-8 max-w-[80%]">
            <div className="text-[13px] text-red-400/80 font-mono mb-1">Render Error</div>
            <div className="text-[11px] text-white/40 font-mono break-all leading-relaxed">{error}</div>
          </div>
          <div className="flex gap-2 mt-1 flex-wrap justify-center">
            <button
              onClick={() => refreshTemplates()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.10] text-[11px] font-mono text-white/50 hover:text-white/70 transition-colors"
            >
              <RefreshCw size={10} /> Reload
            </button>
            {prevTemplate && (
              <button
                onClick={() => setVariant(prevTemplate.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.10] text-[11px] font-mono text-white/50 hover:text-white/70 transition-colors"
              >
                <ChevronRight size={10} className="rotate-180" /> {prevTemplate.name}
              </button>
            )}
            {nextTemplate && (
              <button
                onClick={() => setVariant(nextTemplate.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.10] text-[11px] font-mono text-white/50 hover:text-white/70 transition-colors"
              >
                {nextTemplate.name} <ChevronRight size={10} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
