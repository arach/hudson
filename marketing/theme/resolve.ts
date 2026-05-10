import type { CSSProperties } from 'react';
import {
  DISPLAY_FONTS,
  BODY_FONTS,
  MONO_FONTS,
  ACCENTS,
  PAPERS,
  DEFAULTS,
  type StudioState,
} from './defaults';

export function resolveThemeStyle(state: StudioState): CSSProperties {
  const display = DISPLAY_FONTS.find((f) => f.id === state.display) ?? DISPLAY_FONTS[0];
  const body = BODY_FONTS.find((f) => f.id === state.body) ?? BODY_FONTS[0];
  const mono = MONO_FONTS.find((f) => f.id === state.mono) ?? MONO_FONTS[0];
  const accent = ACCENTS.find((a) => a.id === state.accent) ?? ACCENTS[0];
  const paper = PAPERS.find((p) => p.id === state.paper) ?? PAPERS[0];

  return {
    ...paper.vars,
    ...accent.vars,
    '--font-display': display.cssValue,
    '--font-body': body.cssValue,
    '--font-mono': mono.cssValue,
    '--font-weight-body': String(state.bodyWeight ?? DEFAULTS.bodyWeight),
    '--grid-opacity-minor': String(state.gridMinor),
    '--grid-opacity-major': String(state.gridMajor),
    '--stroke-w': `${state.strokeW ?? DEFAULTS.strokeW}px`,
    '--radius-ui': `${state.radiusUI ?? DEFAULTS.radiusUI}px`,
    '--radius-card': `${state.radiusCard ?? DEFAULTS.radiusCard}px`,
  } as CSSProperties;
}
