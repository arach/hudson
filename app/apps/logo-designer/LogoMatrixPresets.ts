import type { LogoComparisonFamily } from './LogoComparisonSheet';

type ParamValue = string | number | boolean;

export interface MatrixPreset {
  templateId: string;
  baseParams: Record<string, ParamValue>;
  families: LogoComparisonFamily[];
}

const T_DECORATION_BASE: Record<string, ParamValue> = {
  glyphScale: 0.82,
  glyphInk: '#F4EFE6',
  glyphFontWeight: '500',
  glyphFontFamily: 'JetBrains Mono',
  showCanvas: true,
  canvasColor: '#0E0D0A',
  canvasRadius: 40,
  decoration: 'stem-top-dot',
  decorationColor: '#FF5346',
  decorationScale: 1.0,
  decorationOpacity: 1.0,
  dotShape: 'circle',
  dotOffsetY: 0,
  showHalo: false,
  haloOpacity: 0.15,
};

const T_DECORATION_FAMILIES: LogoComparisonFamily[] = [
  {
    label: 'Quiet catalog',
    paramKey: 'decoration',
    values: ['none', 'cross-chip', 'cross-flush-cap', 'cross-registration', 'crossbar-pin', 'stem-dot'],
    cellLabels: ['bare', 'A · inset', 'E · flush', 'F · outline', 'L · pin', 'G · stem dot'],
    overrides: { decorationColor: '#E68A3C' },
    caption: 'Six treatments at brand weight. Marks A/E/F + iconlab L/G.',
  },
  {
    label: 'Cross + bar',
    paramKey: 'decoration',
    values: ['cross-knockout', 'cross-annotation', 'crossbar-caps', 'crossbar-slot', 'ascender-notch', 'stem-cross-hairline'],
    cellLabels: ['B · knockout', 'C · annot.', 'D · caps', 'H · slot', 'K · notch', 'J · hairline'],
    overrides: { decorationColor: '#7A6E5C' },
    caption: 'Knockouts, registration marks, and the diagonal calibration hairline.',
  },
  {
    label: 'Stem-top shape',
    paramKey: 'dotShape',
    values: ['circle', 'square', 'rounded-square', 'rect-wide', 'rect-tall'],
    overrides: { decoration: 'stem-top-dot', decorationColor: '#FF5346' },
    caption: 'Hot Mic indicator across shape variants. Same color, same size.',
  },
  {
    label: 'Brand color sweep',
    paramKey: 'decorationColor',
    values: ['#FF5346', '#E68A3C', '#E8C547', '#7A6E5C', '#F4EFE6', '#0E0D0A'],
    cellLabels: ['hot mic', 'cassette', 'caution', 'tape tan', 'cream', 'canvas'],
    overrides: { decoration: 'cross-chip' },
    caption: 'A single mark (cross-chip) across the full Talkie palette.',
  },
  {
    label: 'Scale sweep',
    paramKey: 'decorationScale',
    values: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0],
    cellLabels: ['0.5×', '0.75×', '1.0×', '1.25×', '1.5×', '2.0×'],
    overrides: { decoration: 'crossbar-caps', decorationColor: '#7A6E5C' },
    caption: 'Crossbar caps swept across decoration scale.',
  },
  {
    label: 'Loud surface',
    paramKey: 'decoration',
    values: ['gradient-fill', 'glow-halo', 'debossed', 'chrome', 'tape-spool', 'letterpress'],
    cellLabels: ['N · gradient', 'O · glow', 'P · deboss', 'Q · chrome', 'R · spool', 'S · press'],
    overrides: { decorationColor: '#E68A3C' },
    caption: 'Whole-glyph treatments. These trade restraint for material.',
  },
];

/** Map of templateId → ready-made matrix preset. */
export const MATRIX_PRESETS: Record<string, MatrixPreset> = {
  't-decoration': {
    templateId: 't-decoration',
    baseParams: T_DECORATION_BASE,
    families: T_DECORATION_FAMILIES,
  },
};
