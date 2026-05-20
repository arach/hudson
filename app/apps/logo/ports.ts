import { useCallback } from 'react';
import type { LogoTemplate } from './types';
import { useLogo, type LogoParams, type MatrixPick } from './LogoProvider';

const VB = 512;

type LogoAnimationFx = { presets?: string[]; prompt?: string };
type LogoAnimationSfx = { presets?: string[]; prompt?: string; mute?: boolean };

export interface LogoAnimationJobPayload {
  sourceSvg: string;
  renderBody: string;
  params: Record<string, unknown>;
  targetParams?: Record<string, unknown>;
  prompt?: string;
  fx?: LogoAnimationFx;
  sfx?: LogoAnimationSfx;
  templateId: string;
}

function toRecord(value: LogoParams | MatrixPick['resolvedParams']): Record<string, unknown> {
  return { ...(value as Record<string, unknown>) };
}

function applyTemplateParams(
  template: LogoTemplate,
  params: Record<string, unknown>,
  customValues: Record<string, number | string | Record<string, unknown>[]>,
): Record<string, unknown> {
  const merged = { ...params };
  for (const decl of template.params) {
    if (decl.key in merged) continue;
    merged[decl.key] = customValues[decl.key] ?? decl.default;
  }
  return merged;
}

function renderSourceSvg(template: LogoTemplate, params: Record<string, unknown>): string {
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('p', 'vb', template.renderBody);
    const inner = fn(params, VB);
    if (typeof inner === 'string') {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}">${inner}</svg>`;
    }
  } catch {
    // Fall through to the neutral shell below; the render service can still use renderBody + params.
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}"></svg>`;
}

function readSelectedSvgSnapshot(): string | null {
  if (typeof document === 'undefined') return null;
  const selectedSvg = document.querySelector('.logo-comparison-sheet__cell--selected svg');
  if (selectedSvg instanceof SVGSVGElement) return selectedSvg.outerHTML;
  const previewSvg = document.querySelector('[data-logo-content-root] svg[viewBox]');
  if (previewSvg instanceof SVGSVGElement) return previewSvg.outerHTML;
  return null;
}

function buildPrompt(picks: MatrixPick[], template: LogoTemplate): string | undefined {
  if (picks.length === 0) return undefined;
  const instructions = picks
    .map(pick => pick.instruction?.trim())
    .filter((text): text is string => Boolean(text));
  const coords = picks.map(pick => pick.coordLabel).join(', ');
  return [
    `Animate Logo Designer ${template.name} variant${picks.length === 1 ? '' : 's'} (${coords}).`,
    instructions.length > 0 ? `Creative notes: ${instructions.join(' ')}` : '',
  ].filter(Boolean).join('\n');
}

function buildAnimationJobPayload(opts: {
  params: LogoParams;
  templates: LogoTemplate[];
  customParamValues: Record<string, Record<string, number | string | Record<string, unknown>[]>>;
  picks: MatrixPick[];
}): LogoAnimationJobPayload | null {
  const { params, templates, customParamValues, picks } = opts;
  if (picks.length === 0) return null;

  const template = templates.find(t => t.id === params.variant);
  if (!template) return null;

  const first = picks[0];
  const second = picks[1];
  const customValues = customParamValues[template.id] ?? {};
  const sourceParams = applyTemplateParams(template, {
    ...toRecord(params),
    ...toRecord(first.resolvedParams),
    variant: template.id,
  }, customValues);
  const targetParams = second
    ? applyTemplateParams(template, {
        ...toRecord(params),
        ...toRecord(second.resolvedParams),
        variant: template.id,
      }, customValues)
    : undefined;

  return {
    sourceSvg: readSelectedSvgSnapshot() ?? renderSourceSvg(template, sourceParams),
    renderBody: template.sourceCode || template.renderBody,
    params: sourceParams,
    ...(targetParams ? { targetParams } : {}),
    ...(buildPrompt(picks, template) ? { prompt: buildPrompt(picks, template) } : {}),
    templateId: template.id,
  };
}

/**
 * Port output hook for Logo.
 * - params: current logo SVG params as serialized JSON.
 * - animation-job: selected matrix variant payload for Preframe.
 */
export function useLogoPortOutput() {
  const { params, templates, customParamValues, picks } = useLogo();

  return useCallback((portId: string): unknown | null => {
    if (portId === 'params') return JSON.stringify(params);
    if (portId === 'animation-job') {
      return buildAnimationJobPayload({ params, templates, customParamValues, picks });
    }
    return null;
  }, [customParamValues, params, picks, templates]);
}

/**
 * Port input hook for Logo.
 * Accepts an SVG string on the 'background-svg' port.
 *
 * Also accepts SVG data URLs (e.g. `data:image/svg+xml;base64,...` or
 * `data:image/svg+xml;utf8,...`) emitted by apps like Assets — these are
 * decoded to raw SVG so the rasterizer can parse them.
 */
export function useLogoPortInput() {
  const { setBackgroundSvg } = useLogo();

  return useCallback((portId: string, data: unknown) => {
    if (portId !== 'background-svg' || typeof data !== 'string') return;

    // If the incoming string is an SVG data URL, decode it to raw SVG.
    const dataUrlMatch = data.match(/^data:image\/svg\+xml(?:;[^,]*)?,(.*)$/);
    if (dataUrlMatch) {
      const isBase64 = /;base64/i.test(data.slice(0, data.indexOf(',')));
      const payload = dataUrlMatch[1];
      try {
        const decoded = isBase64
          ? (typeof atob === 'function' ? atob(payload) : Buffer.from(payload, 'base64').toString('utf-8'))
          : decodeURIComponent(payload);
        setBackgroundSvg(decoded);
        return;
      } catch {
        // fall through to raw
      }
    }

    setBackgroundSvg(data);
  }, [setBackgroundSvg]);
}
