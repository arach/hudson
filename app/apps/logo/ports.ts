import { useCallback } from 'react';
import { isBuiltinVariant, type LogoTemplate, type TemplateParam } from './types';
import { useLogo, type LogoParams, type MatrixPick } from './LogoProvider';

const VB = 512;

type LogoAnimationFx = { presets?: string[]; prompt?: string };
type LogoAnimationSfx = { presets?: string[]; prompt?: string; mute?: boolean };

interface LogoCodeDocumentPayload {
  id: string;
  title: string;
  uri: string;
  mediaType: string;
  language: 'javascript';
  kind: 'code';
  value: string;
  readOnly?: boolean;
  source: {
    appId: 'logo';
    objectType: 'logo-template';
    objectId: string;
    portId: 'active-template-document';
  };
  metadata: {
    templateId: string;
    templateName: string;
    builtin: boolean;
  };
}

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

function templateParamsToRecord(params: TemplateParam[]): Record<string, Omit<TemplateParam, 'key'>> | undefined {
  if (params.length === 0) return undefined;
  const record: Record<string, Omit<TemplateParam, 'key'>> = {};
  for (const param of params) {
    const { key, ...definition } = param;
    record[key] = definition;
  }
  return record;
}

function templateSourceFile(template: LogoTemplate): string {
  const params = templateParamsToRecord(template.params);
  const builtin = template.builtin === true || isBuiltinVariant(template.id);
  const meta: Record<string, unknown> = {
    name: template.name,
    description: template.description,
    ...(builtin ? { builtin: true } : {}),
    ...(template.kind ? { kind: template.kind } : {}),
    ...(template.parentId ? { parentId: template.parentId } : {}),
    ...(params ? { params } : {}),
  };

  return [
    `const meta = ${JSON.stringify(meta, null, 2)};`,
    '',
    template.sourceCode ?? template.renderBody,
    '',
  ].join('\n');
}

export function logoTemplateToCodeDocumentPayload(template: LogoTemplate): LogoCodeDocumentPayload {
  const builtin = template.builtin === true || isBuiltinVariant(template.id);
  return {
    id: `logo-template:${template.id}`,
    title: `${template.id}.js`,
    uri: `hudson://logo/templates/${template.id}.js`,
    mediaType: 'text/javascript',
    language: 'javascript',
    kind: 'code',
    value: templateSourceFile(template),
    readOnly: builtin,
    source: {
      appId: 'logo',
      objectType: 'logo-template',
      objectId: template.id,
      portId: 'active-template-document',
    },
    metadata: {
      templateId: template.id,
      templateName: template.name,
      builtin,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function templateIdFromDocument(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const source = isRecord(data.source) ? data.source : null;
  if (source?.objectType === 'logo-template' && typeof source.objectId === 'string') {
    return source.objectId;
  }
  if (typeof data.id === 'string' && data.id.startsWith('logo-template:')) {
    return data.id.slice('logo-template:'.length);
  }
  if (typeof data.uri === 'string') {
    const match = data.uri.match(/^hudson:\/\/logo\/templates\/(.+)\.js$/);
    if (match) return match[1];
  }
  if (isRecord(data.metadata) && typeof data.metadata.templateId === 'string') {
    return data.metadata.templateId;
  }
  return null;
}

export function resolveLogoTemplateDocumentUpdate(
  data: unknown,
  fallbackTemplateId: string,
): { templateId: string; sourceCode: string } | null {
  if (typeof data === 'string') {
    return { templateId: fallbackTemplateId, sourceCode: data };
  }

  if (!isRecord(data) || typeof data.value !== 'string') return null;
  return {
    templateId: templateIdFromDocument(data) ?? fallbackTemplateId,
    sourceCode: data.value,
  };
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
    if (portId === 'active-template-document') {
      const template = templates.find(t => t.id === params.variant);
      return template ? logoTemplateToCodeDocumentPayload(template) : null;
    }
    if (portId === 'active-template-source') {
      const template = templates.find(t => t.id === params.variant);
      return template ? templateSourceFile(template) : null;
    }
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
  const { params, setBackgroundSvg, templates, updateTemplate } = useLogo();

  return useCallback((portId: string, data: unknown) => {
    if (portId === 'active-template-document' || portId === 'active-template-source') {
      const update = resolveLogoTemplateDocumentUpdate(data, params.variant);
      if (!update) return;
      const template = templates.find(item => item.id === update.templateId);
      if (template?.builtin || isBuiltinVariant(update.templateId)) {
        console.warn(`[logo] Refusing to edit built-in template "${update.templateId}" from a port update.`);
        return;
      }
      void updateTemplate(update.templateId, { sourceCode: update.sourceCode }).catch(error => {
        console.warn('[logo] Failed to apply template document update:', error);
      });
      return;
    }

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
  }, [params.variant, setBackgroundSvg, templates, updateTemplate]);
}
