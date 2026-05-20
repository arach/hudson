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

// ---------------------------------------------------------------------------
// talkie-letterpress — ink color / paper / bleed / shadow sweeps
// ---------------------------------------------------------------------------
const TALKIE_LETTERPRESS_BASE: Record<string, ParamValue> = {
  glyphLayout: 'icon',
  glyphScale: 0.85,
  inkColor: '#0E0D0A',
  paperColor: '#F4EFE6',
  showCanvas: true,
  canvasRadius: 40,
  inkBleed: 1.2,
  grainFreq: 0.65,
  shadowOffsetX: 3,
  shadowOffsetY: 5,
  shadowBlur: 3,
  showMicDot: true,
  micDotColor: '#FF5346',
  micDotSize: 10,
};

const TALKIE_LETTERPRESS_FAMILIES: LogoComparisonFamily[] = [
  {
    label: 'Ink + paper palette',
    paramKey: 'inkColor',
    values: ['#0E0D0A', '#5C3A1E', '#3A1F0C', '#C8351C', '#E68A3C', '#E84A8C'],
    cellLabels: ['ribbon', 'sepia', 'antique', 'poster red', 'cassette', 'riso pink'],
    caption: 'Six ink colors against default cream stock. Bleed and shadow stay constant.',
  },
  {
    label: 'Paper stock sweep',
    paramKey: 'paperColor',
    values: ['#F4EFE6', '#FFFFFF', '#E8D9B8', '#D9C9A3', '#EFE9DD', '#FFF4E8'],
    cellLabels: ['cream', 'white', 'aged', 'antique', 'newsprint', 'riso warm'],
    overrides: { inkColor: '#0E0D0A' },
    caption: 'Same black ink, six paper stocks. Sets brand temperature.',
  },
  {
    label: 'Ink bleed sweep',
    paramKey: 'inkBleed',
    values: [0.4, 0.8, 1.2, 1.8, 2.6, 3.4],
    cellLabels: ['0.4 dry', '0.8', '1.2 default', '1.8', '2.6 wet', '3.4 soaked'],
    caption: 'From hairline dry-press to soaked-ink. Hold everything else.',
  },
  {
    label: 'Shadow depth sweep',
    paramKey: 'shadowOffsetY',
    values: [0, 2, 4, 6, 8, 12],
    cellLabels: ['flat', '2px', '4px', '6px', '8px', '12px'],
    overrides: { shadowOffsetX: 0, shadowBlur: 4 },
    caption: 'Drop shadow Y-offset only. Conveys press depth.',
  },
  {
    label: 'Grain density',
    paramKey: 'grainFreq',
    values: [0.2, 0.45, 0.65, 0.95, 1.4, 1.8],
    cellLabels: ['smooth', 'fine', 'default', 'coarse', 'newsprint', 'rough'],
    caption: 'Paper grain frequency. Higher = rougher stock.',
  },
];

// ---------------------------------------------------------------------------
// talkie-pixel — color / chunkiness sweeps + retro hardware palettes
// ---------------------------------------------------------------------------
const TALKIE_PIXEL_BASE: Record<string, ParamValue> = {
  glyphLayout: 'icon',
  glyphScale: 0.85,
  fillColor: '#F4EFE6',
  showCanvas: true,
  canvasColor: '#0E0D0A',
  canvasRadius: 40,
  gridRes: '16',
  showMicDot: true,
  micDotColor: '#FF5346',
  micDotSize: 10,
};

const TALKIE_PIXEL_FAMILIES: LogoComparisonFamily[] = [
  {
    label: 'Grid resolution',
    paramKey: 'gridRes',
    values: ['8', '12', '16', '20', '24', '32'],
    cellLabels: ['8 mega', '12', '16 default', '20', '24', '32 fine'],
    caption: 'Chunky to fine bitmap quantization. Brand stays.',
  },
  {
    label: 'Retro hardware palette',
    paramKey: 'fillColor',
    values: ['#9BBC0F', '#E89B2C', '#7878D8', '#FF5346', '#FFCC33', '#A8E6CF'],
    cellLabels: ['Game Boy', 'amber CRT', 'C64', 'NES red', 'Atari', 'mint'],
    overrides: { canvasColor: '#0F380F', gridRes: '12' },
    caption: 'Pixel mark in 6 retro hardware tints. Canvas stays Game Boy dark.',
  },
  {
    label: 'Canvas color sweep',
    paramKey: 'canvasColor',
    values: ['#0E0D0A', '#F4EFE6', '#1A2E2A', '#0A0010', '#1F1B16', '#403CA4'],
    cellLabels: ['ribbon', 'cream', 'teal', 'arcade', 'tape dark', 'C64 dark'],
    overrides: { fillColor: '#F4EFE6', gridRes: '16' },
    caption: 'Cream pixels on six different canvases. Same grid res.',
  },
  {
    label: 'Polarity / inversion',
    paramKey: 'fillColor',
    values: ['#F4EFE6', '#0E0D0A', '#FF5346', '#E68A3C', '#7A6E5C', '#88FF99'],
    cellLabels: ['cream', 'black', 'hot mic', 'cassette', 'tape tan', 'phosphor'],
    overrides: { canvasColor: '#F4EFE6', gridRes: '16' },
    caption: 'Pixels on cream canvas — six fill colors. Same chunkiness.',
  },
  {
    label: 'Chunkiness × Mint',
    paramKey: 'gridRes',
    values: ['8', '12', '16', '20', '24', '32'],
    cellLabels: ['8', '12', '16', '20', '24', '32'],
    overrides: { fillColor: '#A8E6CF', canvasColor: '#1A2E2A' },
    caption: 'Mint pixel on dark teal across chunkiness range.',
  },
];

// ---------------------------------------------------------------------------
// talkie-d1-stencil — beam radius / symmetry / decoration sweeps
// ---------------------------------------------------------------------------
const TALKIE_D1_STENCIL_BASE: Record<string, ParamValue> = {
  glyphScale: 0.78,
  glyphInk: '#F4EFE6',
  showCanvas: true,
  canvasColor: '#0E0D0A',
  canvasRadius: 40,
  symmetryMode: 'shared',
  beamRadius: 0,
  stemRadius: 0,
  crossRadius: 0,
  decoration: 'none',
  decorationScale: 1.0,
  decorationInk: '#7A6E5C',
};

const TALKIE_D1_STENCIL_FAMILIES: LogoComparisonFamily[] = [
  {
    label: 'Beam radius (shared)',
    paramKey: 'beamRadius',
    values: [0, 0.02, 0.04, 0.06, 0.10, 0.15],
    cellLabels: ['sharp', '0.02', '0.04', '0.06', '0.10', '0.15'],
    caption: 'Shared beam-radius sweep. Past ~0.06u the mark starts reading soft.',
  },
  {
    label: 'Cross-only fillet (sharp stem)',
    paramKey: 'crossRadius',
    values: [0, 0.04, 0.08, 0.12, 0.16, 0.20],
    cellLabels: ['0', '0.04', '0.08', '0.12', '0.16', '0.20'],
    overrides: { symmetryMode: 'independent', stemRadius: 0 },
    caption: 'Stem held sharp; crossbar softens. The cap takes the touch better than the stem.',
  },
  {
    label: 'Stem-only fillet (sharp cross)',
    paramKey: 'stemRadius',
    values: [0, 0.04, 0.08, 0.12, 0.16, 0.20],
    cellLabels: ['0', '0.04', '0.08', '0.12', '0.16', '0.20'],
    overrides: { symmetryMode: 'independent', crossRadius: 0 },
    caption: 'Crossbar held sharp; stem softens. Tends toward novelty past 0.08u.',
  },
  {
    label: 'Construction-vocabulary decoration',
    paramKey: 'decoration',
    values: ['none', 'angle-brackets', 'corner-ticks', 'registration-crosshairs', 'set-square-corners'],
    cellLabels: ['bare', '< T >', 'L-ticks', 'crosshairs', 'crop marks'],
    caption: 'All five decoration slots at neutral scale, sharp T baseline.',
  },
  {
    label: 'Decoration scale (brackets)',
    paramKey: 'decorationScale',
    values: [0.5, 0.75, 1.0, 1.2, 1.4, 1.6],
    cellLabels: ['0.5×', '0.75×', '1.0×', '1.2×', '1.4×', '1.6×'],
    overrides: { decoration: 'angle-brackets' },
    caption: 'Bracket scale sweep at sharp T baseline. Calibrates how loud the construction reading should be.',
  },
];

/** Map of templateId → ready-made matrix preset. */
export const MATRIX_PRESETS: Record<string, MatrixPreset> = {
  't-decoration': {
    templateId: 't-decoration',
    baseParams: T_DECORATION_BASE,
    families: T_DECORATION_FAMILIES,
  },
  'talkie-d1-stencil': {
    templateId: 'talkie-d1-stencil',
    baseParams: TALKIE_D1_STENCIL_BASE,
    families: TALKIE_D1_STENCIL_FAMILIES,
  },
  'talkie-instrument-viewer': {
    templateId: 'talkie-instrument-viewer',
    baseParams: {
      glyphScale: 0.78,
      glyphInk: '#F4EFE6',
      tTreatment: 'd1-stencil',
      showCanvas: true,
      canvasColor: '#0E0D0A',
      canvasRadius: 40,
      viewerPlacement: 'crossbar-inset',
      viewerInk: '#0E0D0A',
      viewerChrome: 'chamfered',
      viewerGraticule: true,
      waveShape: 'attack-decay',
      waveInk: '#F4EFE6',
    },
    families: [
      {
        label: 'Viewer placement',
        paramKey: 'viewerPlacement',
        values: ['crossbar-inset', 'stem-replace', 'below-strip', 'right-float'],
        cellLabels: ['crossbar', 'stem', 'below', 'sidecar'],
        caption: 'Four placements at attack-decay default wave + chamfered chrome. Crossbar and below-strip survive the format ladder best.',
      },
      {
        label: 'Wave inside',
        paramKey: 'waveShape',
        values: ['sine', 'square-pulse', 'attack-decay', 'peak-hold', 'vu-bars', 'spectrum-strip'],
        cellLabels: ['sine', 'square', 'attack-decay', 'peak-hold', 'VU bars', 'spectrum'],
        caption: 'Six wave shapes inside the crossbar-inset viewer. VU bars and attack-decay carry the brand most specifically.',
      },
      {
        label: 'Viewer chrome',
        paramKey: 'viewerChrome',
        values: ['sharp', 'chamfered', 'thin-border', 'thick-border', 'register-corners'],
        cellLabels: ['sharp', 'chamfered', 'thin', 'thick', 'register'],
        caption: 'Frame vocabulary sweep. Chamfered matches D1; register-corners pulls drafting marks.',
      },
      {
        label: 'T treatment × placement',
        paramKey: 'tTreatment',
        values: ['d1-stencil', 'simplified'],
        cellLabels: ['D1 stencil', 'simplified'],
        overrides: { viewerPlacement: 'stem-replace', waveShape: 'peak-hold' },
        caption: 'Stem-replace at peak-hold, swept across T treatment. Simplified T tests the screen-with-T-on-it boundary.',
      },
      {
        label: 'Below-strip wave sweep',
        paramKey: 'waveShape',
        values: ['attack-decay', 'square-pulse', 'peak-hold', 'vu-bars', 'spectrum-strip', 'sine'],
        cellLabels: ['attack-decay', 'square', 'peak-hold', 'VU', 'spectrum', 'sine'],
        overrides: { viewerPlacement: 'below-strip', viewerChrome: 'register-corners' },
        caption: 'Below-strip lockup across all six wave shapes. The lockup-shaped variant.',
      },
    ],
  },
  'talkie-letterpress': {
    templateId: 'talkie-letterpress',
    baseParams: TALKIE_LETTERPRESS_BASE,
    families: TALKIE_LETTERPRESS_FAMILIES,
  },
  'talkie-pixel': {
    templateId: 'talkie-pixel',
    baseParams: TALKIE_PIXEL_BASE,
    families: TALKIE_PIXEL_FAMILIES,
  },
};
