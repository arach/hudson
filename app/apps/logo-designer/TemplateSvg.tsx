'use client';

import { useMemo } from 'react';
import type { LogoTemplate } from './types';
import type { LogoParams } from './LogoProvider';

interface Props {
  template: LogoTemplate;
  params: LogoParams;
  customParamValues: Record<string, number | string | Record<string, unknown>[]>;
  size: number;
}

const VB = 512;

// Params that must be numbers — string values from localStorage/inputs break
// arithmetic (JS + operator concatenates strings instead of adding)
const NUMERIC_KEYS = new Set([
  'borderRadius', 'paneRadius', 'gapWidth', 'splitX', 'splitY', 'padding',
]);

export function TemplateSvg({ template, params, customParamValues, size }: Props) {
  const merged = useMemo(() => {
    const p: Record<string, unknown> = { ...params };
    // Coerce numeric params — prevents string concatenation bugs in templates
    for (const key of NUMERIC_KEYS) {
      if (key in p && typeof p[key] !== 'number') p[key] = Number(p[key]);
    }
    // Apply custom param defaults, then overrides
    for (const decl of template.params) {
      let val = customParamValues[decl.key] ?? decl.default;
      if (decl.type === 'number' && typeof val !== 'number') val = Number(val);
      p[decl.key] = val;
    }
    return p;
  }, [params, template.params, customParamValues]);

  const svgInner = useMemo(() => {
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('p', 'vb', template.renderBody);
      const result = fn(merged, VB);
      if (typeof result !== 'string') return errorSvg('renderBody must return a string');
      return result;
    } catch (err) {
      return errorSvg(err instanceof Error ? err.message : String(err));
    }
  }, [template.renderBody, merged]);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VB} ${VB}`}
      width={size}
      height={size}
      dangerouslySetInnerHTML={{ __html: svgInner }}
    />
  );
}

function errorSvg(message: string): string {
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return `<rect width="512" height="512" rx="40" fill="#1a1a1a"/>` +
    `<text x="256" y="240" text-anchor="middle" fill="#ef4444" font-size="18" font-family="monospace">Render Error</text>` +
    `<text x="256" y="280" text-anchor="middle" fill="#666" font-size="12" font-family="monospace">${escaped}</text>`;
}
