'use client';

import { useMemo, useEffect } from 'react';
import { useLogo } from './LogoProvider';
import type { LogoParams } from './LogoProvider';
import type { LogoTemplate } from './types';
import { FONT_FAMILY_MAP, loadGoogleFont } from './types';

const VB = 512;

interface WordmarkSvgProps {
  params: LogoParams;
  size: number;
  mode?: 'dark' | 'light';
}

/**
 * Renders the icon + wordmark text composition.
 * For 'horizontal': wider viewBox with icon left, text right.
 * For 'stacked': taller viewBox with icon top, text below.
 */
export function WordmarkSvg({ params, size, mode = 'dark' }: WordmarkSvgProps) {
  const { templates, customParamValues, lightParams } = useLogo();

  const resolvedParams = mode === 'light' ? lightParams : params;
  const textColor = mode === 'light' ? params.wordmark.lightColor : params.wordmark.color;

  // Load Google Font on demand
  useEffect(() => { loadGoogleFont(params.wordmark.fontFamily); }, [params.wordmark.fontFamily]);

  const template = templates.find(t => t.id === params.variant);

  // Render the icon SVG inner HTML
  const iconInner = useMemo(() => {
    if (!template) return '';
    try {
      const p: Record<string, unknown> = { ...resolvedParams };
      const cpv = customParamValues[template.id] ?? {};
      for (const decl of template.params) {
        p[decl.key] = cpv[decl.key] ?? decl.default;
      }
      const fn = new Function('p', 'vb', template.renderBody);
      const result = fn(p, VB);
      return typeof result === 'string' ? result : '';
    } catch {
      return '';
    }
  }, [template, resolvedParams, customParamValues]);

  const wm = params.wordmark;
  const fontFamily = FONT_FAMILY_MAP[wm.fontFamily] ?? wm.fontFamily;
  const textFontSize = VB * wm.fontSize;

  if (wm.layout === 'horizontal') {
    // Generous text width estimate — accounts for letter-spacing and wide characters
    const charWidth = wm.fontFamily.includes('Mono') ? 0.65 : 0.58;
    const spacingExtra = wm.text.length * textFontSize * wm.letterSpacing;
    const textWidth = Math.max(wm.text.length * textFontSize * charWidth + spacingExtra + textFontSize * 0.5, VB * 0.5);
    const totalW = VB + wm.gap + textWidth;
    const scale = size / VB; // scale based on icon height
    const svgW = totalW * scale / (totalW / VB);

    const pad = textFontSize * 0.3; // breathing room around edges
    const fullW = totalW + pad;
    const fullH = VB + pad * 2;
    const svgWFull = fullW * (size / VB);

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`${-pad} ${-pad} ${fullW} ${fullH}`}
        width={svgWFull}
        height={size * (fullH / VB)}
      >
        {/* Full composition background */}
        <rect x={-pad} y={-pad} width={fullW} height={fullH}
          rx={resolvedParams.borderRadius * 0.4}
          fill={resolvedParams.bgColor} />
        {/* Icon */}
        <svg x="0" y="0" width={VB} height={VB} viewBox={`0 0 ${VB} ${VB}`}
          dangerouslySetInnerHTML={{ __html: iconInner }}
        />
        {/* Text */}
        <text
          x={VB + wm.gap + wm.offsetX}
          y={VB / 2 + wm.offsetY}
          dominantBaseline="central"
          fontFamily={fontFamily}
          fontWeight={wm.fontWeight}
          fontSize={textFontSize}
          letterSpacing={`${wm.letterSpacing}em`}
          fill={textColor}
        >
          {wm.text}
        </text>
      </svg>
    );
  }

  if (wm.layout === 'stacked') {
    const textHeight = textFontSize * 1.2;
    const totalH = VB + wm.gap + textHeight;
    const charWidth = wm.fontFamily.includes('Mono') ? 0.65 : 0.58;
    const spacingExtra = wm.text.length * textFontSize * wm.letterSpacing;
    const textWidth = wm.text.length * textFontSize * charWidth + spacingExtra + textFontSize * 0.5;
    const totalW = Math.max(VB, textWidth + 40);
    const pad = textFontSize * 0.3;
    const fullW = totalW + pad * 2;
    const fullH = totalH + pad * 2;

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`${-pad} ${-pad} ${fullW} ${fullH}`}
        width={size * (fullW / fullH)}
        height={size * (fullH / VB)}
      >
        {/* Full composition background */}
        <rect x={-pad} y={-pad} width={fullW} height={fullH}
          rx={resolvedParams.borderRadius * 0.4}
          fill={resolvedParams.bgColor} />
        {/* Icon centered */}
        <svg x={(totalW - VB) / 2} y="0" width={VB} height={VB} viewBox={`0 0 ${VB} ${VB}`}
          dangerouslySetInnerHTML={{ __html: iconInner }}
        />
        {/* Text centered below */}
        <text
          x={totalW / 2 + wm.offsetX}
          y={VB + wm.gap + textHeight * 0.75 + wm.offsetY}
          textAnchor="middle"
          fontFamily={fontFamily}
          fontWeight={wm.fontWeight}
          fontSize={textFontSize}
          letterSpacing={`${wm.letterSpacing}em`}
          fill={textColor}
        >
          {wm.text}
        </text>
      </svg>
    );
  }

  // icon-only fallback — shouldn't be used (LogoContent renders LogoSvg directly)
  return null;
}
