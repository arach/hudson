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

// ---------------------------------------------------------------------------
// talkie-folded-frame-* — folded aperture / inverse / wireframe sweeps
// ---------------------------------------------------------------------------
const TALKIE_FOLDED_FRAME_01_BASE: Record<string, ParamValue> = {
  bgColor: '#090907',
  planeTop: '#F4EFE6',
  planeRight: '#D8D1C5',
  planeBottom: '#C7BFB1',
  planeLeft: '#E8E0D2',
  seamColor: '#0E0D0A',
  markScale: 0.68,
  innerRatio: 0.46,
  cornerCut: 0.09,
  innerShiftX: 0,
  innerShiftY: 0,
  foldDepth: 0.22,
  seamWidth: 1.2,
  edgeOpacity: 0.48,
  showGrid: false,
  showNodes: false,
  showTEcho: false,
  tEchoOpacity: 0.18,
};

const TALKIE_FOLDED_FRAME_01_FAMILIES: LogoComparisonFamily[] = [
  {
    label: 'Void ratio',
    paramKey: 'innerRatio',
    values: [0.34, 0.38, 0.42, 0.46, 0.52, 0.58],
    cellLabels: ['0.34 dense', '0.38', '0.42', '0.46 default', '0.52 open', '0.58 thin'],
    caption: 'Center aperture sweep. The middle cells keep the folded-frame read without thinning the walls too far.',
  },
  {
    label: 'Corner cut',
    paramKey: 'cornerCut',
    values: [0, 0.04, 0.07, 0.09, 0.12, 0.16],
    cellLabels: ['square', '0.04', '0.07', '0.09 default', '0.12', '0.16 hard'],
    caption: 'Outer-corner cut sweep. Larger cuts make the mark more mechanical; zero cut turns it into a plain frame.',
  },
  {
    label: 'Fold depth',
    paramKey: 'foldDepth',
    values: [0, 0.10, 0.18, 0.22, 0.34, 0.48],
    cellLabels: ['flat', '0.10', '0.18', '0.22 default', '0.34', '0.48 material'],
    caption: 'Plane-shading intensity. Useful for finding the line between flat logo and faux material.',
  },
  {
    label: 'Construction overlays',
    paramKey: 'showGrid',
    values: [false, true],
    cellLabels: ['clean', 'grid'],
    overrides: { showNodes: true, edgeOpacity: 0.62 },
    caption: 'Clean mark versus construction drawing. The overlay is for exploration, not the final app icon.',
  },
  {
    label: 'T echo',
    paramKey: 'showTEcho',
    values: [false, true],
    cellLabels: ['aperture only', 'T in void'],
    overrides: { tEchoOpacity: 0.22 },
    caption: 'Tests whether the folded-frame direction can nod back to the Talkie T without becoming a letter-logo again.',
  },
];

const TALKIE_FOLDED_FRAME_08_BASE: Record<string, ParamValue> = {
  fieldColor: '#F4EFE6',
  cutColor: '#0A0A08',
  cutMid: '#1A1813',
  highlightColor: '#FFFFFF',
  shadowColor: '#000000',
  markScale: 0.68,
  innerRatio: 0.45,
  cornerCut: 0.09,
  fieldRadius: 0,
  depth: 0.32,
  edgeWidth: 1,
  edgeOpacity: 0.42,
  showCenter: true,
  showGrid: false,
  showTEcho: false,
  tEchoOpacity: 0.2,
};

const TALKIE_FOLDED_FRAME_08_FAMILIES: LogoComparisonFamily[] = [
  {
    label: 'Cut depth',
    paramKey: 'depth',
    values: [0, 0.12, 0.22, 0.32, 0.48, 0.64],
    cellLabels: ['flat', '0.12', '0.22', '0.32 default', '0.48', '0.64 deep'],
    caption: 'Inverse-cut shading. Higher values move toward object render; lower values keep it graphic.',
  },
  {
    label: 'Center aperture',
    paramKey: 'innerRatio',
    values: [0.34, 0.39, 0.45, 0.50, 0.56, 0.61],
    cellLabels: ['small', '0.39', 'default', '0.50', '0.56', 'large'],
    caption: 'Light center size in the inverse mark. Small centers read more like a punched plate.',
  },
  {
    label: 'Polarity field',
    paramKey: 'fieldColor',
    values: ['#F4EFE6', '#FFFFFF', '#E8E0D2', '#D8D1C5', '#0E0D0A', '#101417'],
    cellLabels: ['cream', 'white', 'warm', 'graphite', 'black', 'blue-black'],
    overrides: { cutColor: '#0A0A08', cutMid: '#1A1813' },
    caption: 'Background polarity and temperature. Dark fields push this back toward 01.',
  },
  {
    label: 'T echo',
    paramKey: 'showTEcho',
    values: [false, true],
    cellLabels: ['cut only', 'T in center'],
    overrides: { tEchoOpacity: 0.24 },
    caption: 'Tests whether the inverse cut can carry a subtle letter cue inside the light center.',
  },
];

const TALKIE_FOLDED_FRAME_10_BASE: Record<string, ParamValue> = {
  bgColor: '#090907',
  lineColor: '#F4EFE6',
  dimLineColor: '#7A6E5C',
  nodeColor: '#F4EFE6',
  markScale: 0.83,
  innerRatio: 0.49,
  cornerCut: 0.085,
  strokeWidth: 2.8,
  foldStroke: 1.1,
  innerStroke: 2.2,
  foldOpacity: 0.55,
  showGrid: false,
  showAxes: true,
  showNodes: true,
  showTEcho: false,
  tEchoOpacity: 0.24,
};

const TALKIE_FOLDED_FRAME_10_FAMILIES: LogoComparisonFamily[] = [
  {
    label: 'Aperture scale',
    paramKey: 'markScale',
    values: [0.62, 0.70, 0.78, 0.83, 0.87, 0.90],
    cellLabels: ['0.62', '0.70', '0.78', '0.83 lead', '0.87', '0.90 max'],
    caption: 'Overall wireframe size. The lead state sits large enough to feel iconic without touching the canvas bounds.',
  },
  {
    label: 'Void ratio',
    paramKey: 'innerRatio',
    values: [0.38, 0.43, 0.46, 0.49, 0.54, 0.60],
    cellLabels: ['0.38 dense', '0.43', '0.46', '0.49 lead', '0.54', '0.60 open'],
    caption: 'Inner aperture size. The lead value keeps the center square calm and architectural.',
  },
  {
    label: 'Frame stroke',
    paramKey: 'strokeWidth',
    values: [1.2, 2, 2.8, 3.8, 5.2, 7],
    cellLabels: ['hairline', '2', '2.8 lead', '3.8', '5.2', '7 bold'],
    caption: 'Outer stroke weight. This is the key wireframe axis: blueprint versus app-icon silhouette.',
  },
  {
    label: 'Fold visibility',
    paramKey: 'foldOpacity',
    values: [0, 0.18, 0.36, 0.55, 0.74, 0.92],
    cellLabels: ['none', '0.18', '0.36', 'default', '0.74', '0.92'],
    caption: 'Construction diagonals. The default should feel intentional but not busy.',
  },
  {
    label: 'Guides',
    paramKey: 'showGrid',
    values: [false, true],
    cellLabels: ['clean', 'grid'],
    overrides: { showAxes: true, showNodes: true },
    caption: 'Wireframe clean mark versus full construction mode.',
  },
  {
    label: 'T guide',
    paramKey: 'showTEcho',
    values: [false, true],
    cellLabels: ['frame only', 'T guide'],
    overrides: { tEchoOpacity: 0.32 },
    caption: 'The most code-oriented way to connect the shape back to Talkie without filling a letter.',
  },
];

const TALKIE_FOLDED_FRAME_12_BASE: Record<string, ParamValue> = {
  bgColor: '#090907',
  fillColor: '#F4EFE6',
  shadeColor: '#BFB7AA',
  lineColor: '#0E0D0A',
  markScale: 0.70,
  innerRatio: 0.40,
  cornerCut: 0.075,
  weightBoost: 0.04,
  simplify: true,
  seamWidth: 0.8,
  shadeOpacity: 0.34,
  showTEcho: false,
  tEchoOpacity: 0.22,
};

const TALKIE_FOLDED_FRAME_12_FAMILIES: LogoComparisonFamily[] = [
  {
    label: 'Small-size weight',
    paramKey: 'weightBoost',
    values: [-0.02, 0, 0.025, 0.04, 0.075, 0.11],
    cellLabels: ['thin', '0', '0.025', 'default', '0.075', 'heavy'],
    caption: 'Optical wall-weight correction for 16-64px rendering.',
  },
  {
    label: 'Simplification',
    paramKey: 'simplify',
    values: [true, false],
    cellLabels: ['simple', 'seams'],
    overrides: { seamWidth: 1 },
    caption: 'Small glyph with seams removed versus retained. This tests where detail starts to hurt the icon.',
  },
  {
    label: 'Shade opacity',
    paramKey: 'shadeOpacity',
    values: [0, 0.12, 0.24, 0.34, 0.48, 0.64],
    cellLabels: ['flat', '0.12', '0.24', 'default', '0.48', '0.64'],
    caption: 'Reduced plane shading for the small-size companion glyph.',
  },
  {
    label: 'T echo',
    paramKey: 'showTEcho',
    values: [false, true],
    cellLabels: ['aperture', 'T echo'],
    overrides: { tEchoOpacity: 0.26 },
    caption: 'A small-size test of the letter cue. If it blurs, the final small glyph should stay aperture-only.',
  },
];

// ---------------------------------------------------------------------------
// talkie-signal-gate — geometric T beam + central channel.
// ---------------------------------------------------------------------------
const TALKIE_SIGNAL_GATE_BASE: Record<string, ParamValue> = {
  bgColor: '#090907',
  markColor: '#F4EFE6',
  cutColor: '#090907',
  accentColor: '#2ED7F3',
  showCanvas: true,
  canvasRadius: 96,
  markScale: 0.72,
  beamY: 0.36,
  beamH: 0.16,
  stemW: 0.18,
  gateW: 0.16,
  slotW: 0.13,
  gateDrop: 0.08,
  chamfer: 0.028,
  microGap: 0.012,
  signalMode: 'pill',
  signalW: 0.035,
  signalH: 0.23,
  signalOffset: 0.42,
  showGuides: false,
  guideOpacity: 0.28,
};

const TALKIE_SIGNAL_GATE_FAMILIES: LogoComparisonFamily[] = [
  {
    label: 'Mark scale',
    paramKey: 'markScale',
    values: [0.58, 0.64, 0.69, 0.72, 0.78, 0.84],
    cellLabels: ['0.58 quiet', '0.64', '0.69', '0.72 lead', '0.78', '0.84 bold'],
    caption: 'Overall icon density. The lead leaves enough canvas to feel like an app icon, not a glyph crop.',
  },
  {
    label: 'Channel width',
    paramKey: 'slotW',
    values: [0.06, 0.09, 0.11, 0.13, 0.17, 0.22],
    cellLabels: ['tight', '0.09', '0.11', 'lead', 'open', 'wide'],
    caption: 'Negative-space channel between the T stem and gate. This is the main geometry axis.',
  },
  {
    label: 'Beam height',
    paramKey: 'beamH',
    values: [0.09, 0.12, 0.145, 0.16, 0.19, 0.23],
    cellLabels: ['thin', '0.12', '0.145', 'lead', '0.19', 'heavy'],
    caption: 'Horizontal beam weight. Too thin becomes UI chrome; too heavy becomes an H.',
  },
  {
    label: 'Chamfer',
    paramKey: 'chamfer',
    values: [0, 0.012, 0.02, 0.028, 0.044, 0.064],
    cellLabels: ['square', '0.012', '0.02', 'lead', 'hard cut', 'faceted'],
    caption: 'Corner treatment without rounding. The lead gives a mechanical cut while staying flat.',
  },
  {
    label: 'Signal cue',
    paramKey: 'signalMode',
    values: ['none', 'pill', 'dot', 'bars'],
    cellLabels: ['none', 'pill lead', 'dot', 'bars'],
    caption: 'Voice cue sweep. Pill is the strongest Talkie recall; none tests the pure geometry.',
  },
  {
    label: 'Construction',
    paramKey: 'showGuides',
    values: [false, true],
    cellLabels: ['ship', 'guides'],
    overrides: { guideOpacity: 0.32 },
    caption: 'Final mark versus layout guides for judging the math.',
  },
];

// ---------------------------------------------------------------------------
// talkie-keywave — centered t + waveform on a keycap surface.
// ---------------------------------------------------------------------------
const TALKIE_KEYWAVE_BASE: Record<string, ParamValue> = {
  bgColor: '#090907',
  keyColor: '#11110E',
  keyEdge: '#242018',
  markColor: '#F4EFE6',
  cutColor: '#090907',
  accentColor: '#2ED7F3',
  surface: 'keycap',
  canvasRadius: 96,
  keyInset: 0.095,
  keyRadius: 0.105,
  keyDepth: 0.045,
  markScale: 0.72,
  stemW: 0.17,
  crossW: 0.74,
  crossH: 0.14,
  crossY: 0.38,
  stemTop: 0.14,
  stemBottom: 0.82,
  footW: 0.43,
  footH: 0.13,
  cornerCut: 0.026,
  waveMode: 'cut-bars',
  waveCount: 7,
  waveWidth: 0.28,
  waveHeight: 0.095,
  waveOffsetX: 0.17,
  micMode: 'none',
  opticalShiftX: 0,
  opticalShiftY: 0.018,
};

const TALKIE_KEYWAVE_FAMILIES: LogoComparisonFamily[] = [
  {
    label: 'Surface',
    paramKey: 'surface',
    values: ['keycap', 'flat', 'transparent'],
    cellLabels: ['keycap', 'flat icon', 'mark only'],
    caption: 'Keyboard key as container versus pure logo mark. Keycap should support the idea without becoming the logo.',
  },
  {
    label: 'Wave treatment',
    paramKey: 'waveMode',
    values: ['cut-bars', 'accent-bars', 'solid-bar', 'none'],
    cellLabels: ['cut waveform', 'accent bars', 'signal dash', 'no wave'],
    caption: 'Voice signal in the crossbar. Cut-bars keeps the mark monochrome; accent-bars is louder.',
  },
  {
    label: 'T weight',
    paramKey: 'stemW',
    values: [0.11, 0.14, 0.17, 0.20, 0.23, 0.26],
    cellLabels: ['thin', '0.14', 'lead', '0.20', '0.23', 'heavy'],
    caption: 'Stem weight sweep. The lead is sturdy at icon sizes without becoming blocky.',
  },
  {
    label: 'Crossbar width',
    paramKey: 'crossW',
    values: [0.52, 0.62, 0.70, 0.74, 0.82, 0.90],
    cellLabels: ['short', '0.62', '0.70', 'lead', 'wide', 'max'],
    caption: 'How much the T reads as type versus signal rail.',
  },
  {
    label: 'Wave position',
    paramKey: 'waveOffsetX',
    values: [-0.12, -0.04, 0.06, 0.17, 0.25, 0.32],
    cellLabels: ['left', '-0.04', 'near stem', 'lead', 'right', 'edge'],
    caption: 'Moves the waveform across the crossbar. Right-of-stem keeps the T read clean.',
  },
  {
    label: 'Mic cue',
    paramKey: 'micMode',
    values: ['none', 'pill', 'dot'],
    cellLabels: ['none lead', 'pill', 'dot'],
    caption: 'Mic hint as tertiary cue only. The default stays t/waveform first.',
  },
];

// ---------------------------------------------------------------------------
// hudson-bridge-* — Hudson Bridge family. Schematic H with slotted rails.
// ---------------------------------------------------------------------------
const HUDSON_BRIDGE_SCHEMATIC_BASE: Record<string, ParamValue> = {
  bgColor: '#0E0D0A',
  inkColor: '#F4EFE6',
  slotInk: '#0E0D0A',
  showCanvas: true,
  canvasRadius: 0,
  markScale: 0.62,
  railWidth: 0.16,
  railGap: 0.40,
  showSlots: true,
  slotInsetX: 0.34,
  slotInsetY: 0.12,
  bridgeHeight: 0.075,
  bridgeOffsetY: 0,
  cornerRadius: 0,
  slotRadius: 0,
};

const HUDSON_BRIDGE_SCHEMATIC_FAMILIES: LogoComparisonFamily[] = [
  {
    label: 'Rail gap',
    paramKey: 'railGap',
    values: [0.26, 0.32, 0.36, 0.40, 0.46, 0.54],
    cellLabels: ['0.26 tight', '0.32', '0.36', '0.40 default', '0.46', '0.54 wide'],
    caption: 'Distance between the two vertical rails. Drives how much air the bridge spans.',
  },
  {
    label: 'Rail width',
    paramKey: 'railWidth',
    values: [0.10, 0.13, 0.16, 0.19, 0.22, 0.26],
    cellLabels: ['0.10 thin', '0.13', '0.16 default', '0.19', '0.22', '0.26 heavy'],
    caption: 'Rail thickness as a fraction of mark width. Past 0.22 the mark starts reading block rather than line.',
  },
  {
    label: 'Slot inset X',
    paramKey: 'slotInsetX',
    values: [0.22, 0.27, 0.30, 0.34, 0.38, 0.42],
    cellLabels: ['0.22 open', '0.27', '0.30', '0.34 default', '0.38', '0.42 hairline'],
    caption: 'Slot wall thickness. Lower = open frame; higher = narrow slot, heavier rail edges.',
  },
  {
    label: 'Bridge height',
    paramKey: 'bridgeHeight',
    values: [0.035, 0.05, 0.065, 0.075, 0.10, 0.14],
    cellLabels: ['0.035 wire', '0.05', '0.065', '0.075 default', '0.10', '0.14 plank'],
    caption: 'Bridge bar weight. Anything above 0.10 starts to compete with the rails for attention.',
  },
  {
    label: 'Slot / no slot',
    paramKey: 'showSlots',
    values: [true, false],
    cellLabels: ['schematic', 'solid'],
    caption: 'Toggles the hollow-rail read. Off = solid block H; on = the lead schematic direction.',
  },
  {
    label: 'Corner rounding',
    paramKey: 'cornerRadius',
    values: [0, 2, 4, 8, 12, 20],
    cellLabels: ['sharp', '2', '4 icon', '8', '12', '20 soft'],
    overrides: { slotRadius: 0 },
    caption: 'Outer rail rounding sweep. Sharp keeps the schematic / circuit read; soft drifts toward generic app icon.',
  },
];

const HUDSON_BRIDGE_WIREFRAME_BASE: Record<string, ParamValue> = {
  bgColor: '#0E0D0A',
  lineColor: '#F4EFE6',
  dimLineColor: '#7A6E5C',
  nodeColor: '#F4EFE6',
  markScale: 0.62,
  railWidth: 0.16,
  railGap: 0.40,
  slotInsetX: 0.34,
  slotInsetY: 0.12,
  bridgeHeight: 0.075,
  bridgeOffsetY: 0,
  railStroke: 2.6,
  slotStroke: 1.4,
  bridgeStroke: 2.2,
  showGrid: false,
  showAxes: true,
  showNodes: true,
  showSlots: true,
};

const HUDSON_BRIDGE_WIREFRAME_FAMILIES: LogoComparisonFamily[] = [
  {
    label: 'Rail stroke',
    paramKey: 'railStroke',
    values: [1.0, 1.6, 2.2, 2.6, 3.4, 5.0],
    cellLabels: ['1.0 thin', '1.6', '2.2', '2.6 default', '3.4', '5.0 heavy'],
    caption: 'Outer-rail line weight. Tradeoff between technical drawing and graphic mark.',
  },
  {
    label: 'Construction overlays',
    paramKey: 'showGrid',
    values: [false, true],
    cellLabels: ['axes + nodes', 'full grid'],
    overrides: { showAxes: true, showNodes: true },
    caption: 'Drafting-board view depth. Grid on is best for proportion review, off for the cleaner construction read.',
  },
  {
    label: 'Slot stroke',
    paramKey: 'slotStroke',
    values: [0, 0.8, 1.4, 2.0, 2.8, 4.0],
    cellLabels: ['off', '0.8', '1.4 default', '2.0', '2.8', '4.0 strong'],
    caption: 'Slot outline weight. Setting to 0 hides the slot construction lines and leaves just the rail outlines.',
  },
  {
    label: 'Bridge offset Y',
    paramKey: 'bridgeOffsetY',
    values: [-0.20, -0.10, 0, 0.10, 0.20, 0.28],
    cellLabels: ['-0.20', '-0.10', '0 center', '+0.10', '+0.20', '+0.28'],
    caption: 'Bridge vertical position sweep — tests whether the mark survives a non-centered bridge bar (instrument / readout feel).',
  },
];

// ---------------------------------------------------------------------------
// hudson-native-tiles — current native app/menu-bar tile mark study
// ---------------------------------------------------------------------------
const HUDSON_NATIVE_TILES_BASE: Record<string, ParamValue> = {
  surfaceMode: 'native-neutral',
  bgColor: '#0D171F',
  tileColor: '#2EC7D8',
  creamColor: '#F4EFE6',
  templateColor: '#111111',
  dotColor: '#E7FCFF',
  outerFrameColor: '#0A0A0A',
  innerPanelColor: '#EBEBEB',
  nativeTileColor: '#686868',
  nativeDotColor: '#F6F6F6',
  showCanvas: true,
  canvasInset: 0.04,
  canvasRadius: 0.18,
  outerFrameInset: 0,
  outerFrameRadius: 0.095,
  innerPanelInset: 0.041,
  innerPanelRadius: 0.18,
  gridInset: 0.125,
  tileGap: 0.035,
  tileRadius: 0.022,
  alphaNE: 0.60,
  alphaSW: 0.60,
  alphaSE: 0.38,
  bridgeMode: 'none',
  bridgeHeight: 0.045,
  bridgeOpacity: 0.82,
  bridgeRadius: 0.012,
  signalMode: 'active-dot',
  showActiveDot: true,
  dotSize: 0.095,
  dotX: 0.105,
  dotY: 0.105,
};

const HUDSON_NATIVE_TILES_FAMILIES: LogoComparisonFamily[] = [
  {
    label: 'Surface mode',
    paramKey: 'surfaceMode',
    values: ['native-neutral', 'app-color', 'menu-template', 'cream'],
    cellLabels: ['native capture', 'app color', 'menu template', 'cream mark'],
    caption: 'The captured native icon state alongside color, template, and cream translations.',
  },
  {
    label: 'Bridge mode',
    paramKey: 'bridgeMode',
    values: ['none', 'solid', 'cut'],
    cellLabels: ['captured grid', 'H bridge', 'channel cut'],
    caption: 'Tests whether the existing four-tile mark can absorb the Hudson Bridge idea without losing the native app-icon DNA.',
  },
  {
    label: 'Tile gap',
    paramKey: 'tileGap',
    values: [0.025, 0.035, 0.045, 0.055, 0.075, 0.10],
    cellLabels: ['tight', '0.035 capture', '0.045', '0.055', '0.075', 'wide'],
    caption: 'Gap sweep from compact menu-bar glyph to roomier app icon.',
  },
  {
    label: 'Tile radius',
    paramKey: 'tileRadius',
    values: [0, 0.012, 0.022, 0.035, 0.055, 0.08],
    cellLabels: ['sharp', '0.012', '0.022 capture', '0.035', '0.055', 'soft'],
    caption: 'Corner radius sweep. The captured icon keeps the tiles more mechanical than the earlier rounded app-color draft.',
  },
  {
    label: 'Opacity depth',
    paramKey: 'alphaSE',
    values: [0.18, 0.28, 0.38, 0.52, 0.70, 0.95],
    cellLabels: ['deep fade', '0.28', '0.38 current', '0.52', '0.70', 'flat'],
    overrides: { alphaNE: 0.60, alphaSW: 0.60 },
    caption: 'Bottom-right tile opacity. This controls how much the mark reads as a live system state versus a flat logo.',
  },
  {
    label: 'Signal mark',
    paramKey: 'signalMode',
    values: ['active-dot', 'waveform', 'none'],
    cellLabels: ['active dot', 'waveform', 'none'],
    caption: 'Current menu app uses a waveform symbol; the current app icon uses an active dot. This compares both native references.',
  },
  {
    label: 'Frame radius',
    paramKey: 'outerFrameRadius',
    values: [0.07, 0.085, 0.095, 0.11, 0.13, 0.16],
    cellLabels: ['0.07', '0.085', '0.095 capture', '0.11', '0.13', '0.16'],
    caption: 'Outer-shell radius sweep for the native app icon silhouette.',
  },
  {
    label: 'Panel inset',
    paramKey: 'innerPanelInset',
    values: [0, 0.02, 0.041, 0.06, 0.08, 0.12],
    cellLabels: ['flush', '0.02', '0.041 capture', '0.06', '0.08', '0.12'],
    overrides: { surfaceMode: 'native-neutral', outerFrameRadius: 0.095, innerPanelRadius: 0.18 },
    caption: 'Inner-panel inset sweep. 0 preserves the pre-frame geometry; the capture state creates the black native shell.',
  },
];

// ---------------------------------------------------------------------------
// openscout-aperture — iris-diaphragm brand mark. `opening` drives closed→wide,
// `blades` is the family lever, `accentMode` carries the active reading.
// ---------------------------------------------------------------------------
const OPENSCOUT_APERTURE_BASE: Record<string, ParamValue> = {
  bgColor: '#0B0F12',
  bladeColor: '#E8EDF0',
  apertureColor: '#070A0C',
  seamColor: '#0B0F12',
  ringColor: '#5B6B74',
  accentColor: '#2ED7F3',
  showCanvas: true,
  canvasColor: '#0B0F12',
  canvasRadius: 96,
  markScale: 0.78,
  blades: 8,
  opening: 0.46,
  bladeCurve: 0.18,
  rotation: 0,
  seamWidth: 0.4,
  showRing: true,
  ringWidth: 0.04,
  ringGap: 0.035,
  accentMode: 'blade',
  accentBlade: 0,
  accentStrength: 1,
};

/**
 * The three named states for round 1. Each is a full, reproducible param set
 * (base + state overrides) addressable by name — feed `{ renderBody, params }`
 * to POST /api/logo/export, or merge into the live template params.
 *   closed   — stopped down; reads as a mark, not a dot. Straight 6-blade hex opening.
 *   sighting — canonical resting state. One blade lit (the active 'sighting' read).
 *   wide     — fully open / broadcast. Curved blades, hot accent center in the opening.
 */
export const OPENSCOUT_APERTURE_VARIANTS: Record<'closed' | 'sighting' | 'wide', Record<string, ParamValue>> = {
  closed: { ...OPENSCOUT_APERTURE_BASE, opening: 0.17, blades: 6, bladeCurve: 0, accentMode: 'none' },
  sighting: { ...OPENSCOUT_APERTURE_BASE, opening: 0.46, blades: 8, bladeCurve: 0.18, accentMode: 'blade', accentBlade: 0 },
  wide: { ...OPENSCOUT_APERTURE_BASE, opening: 0.92, blades: 8, bladeCurve: 0.45, accentMode: 'center' },
};

const OPENSCOUT_APERTURE_FAMILIES: LogoComparisonFamily[] = [
  {
    label: 'Aperture state',
    paramKey: 'opening',
    values: [0.17, 0.46, 0.92],
    cellLabels: ['closed', 'sighting', 'wide'],
    caption: 'The three named round-1 states along the opening axis. The canonical sets also shift accent (none → lit blade → hot center) and curvature — see OPENSCOUT_APERTURE_VARIANTS.',
  },
  {
    label: 'Opening sweep',
    paramKey: 'opening',
    values: [0.07, 0.17, 0.32, 0.46, 0.68, 0.92],
    cellLabels: ['0.07 shut', '0.17 closed', '0.32', '0.46 sighting', '0.68', '0.92 wide'],
    caption: 'Fine opening sweep at the sighting accent. Below ~0.12 the opening reads as a dot at icon sizes; above ~0.85 the blade ring thins toward a band.',
  },
  {
    label: 'Blade count',
    paramKey: 'blades',
    values: [5, 6, 8, 10, 12],
    cellLabels: ['5', '6 hex', '8 lead', '10', '12'],
    overrides: { opening: 0.4, accentMode: 'none' },
    caption: 'The family lever. Fewer blades read more mechanical/faceted; more blades read more optical/round. 6 and 8 carry best at small sizes.',
  },
  {
    label: 'Blade curvature',
    paramKey: 'bladeCurve',
    values: [0, 0.2, 0.4, 0.6, 0.8, 1],
    cellLabels: ['straight', '0.2', '0.4', '0.6', '0.8', 'round'],
    overrides: { opening: 0.5, accentMode: 'none' },
    caption: 'Straight (mechanical, polygonal opening) → curved (optical, round opening). The trailing/aperture edge bows; the blade seams stay straight.',
  },
  {
    label: 'Accent state',
    paramKey: 'accentMode',
    values: ['none', 'blade', 'center', 'ring'],
    cellLabels: ['none', 'lit blade', 'hot center', 'lit ring'],
    overrides: { opening: 0.46 },
    caption: 'The active reading. Lit blade is the strongest "sighting" cue and survives to 16px; hot center suits the wide/broadcast state; lit ring is the quietest.',
  },
  {
    label: 'Mount ring',
    paramKey: 'ringWidth',
    values: [0.015, 0.025, 0.04, 0.07, 0.1, 0.12],
    cellLabels: ['0.015 hair', '0.025', '0.04 lead', '0.07', '0.1', '0.12 heavy'],
    overrides: { opening: 0.46, accentMode: 'none', showRing: true },
    caption: 'Outer lens-mount ring weight (toggle off entirely with showRing). The ring frames the mark as a lens; heavier rings push toward a camera-body read.',
  },
];

/** Map of templateId → ready-made matrix preset. */
export const MATRIX_PRESETS: Record<string, MatrixPreset> = {
  'openscout-aperture': {
    templateId: 'openscout-aperture',
    baseParams: OPENSCOUT_APERTURE_BASE,
    families: OPENSCOUT_APERTURE_FAMILIES,
  },
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
  'talkie-folded-frame-01-parametric': {
    templateId: 'talkie-folded-frame-01-parametric',
    baseParams: TALKIE_FOLDED_FRAME_01_BASE,
    families: TALKIE_FOLDED_FRAME_01_FAMILIES,
  },
  'talkie-folded-frame-08-inverse-cut': {
    templateId: 'talkie-folded-frame-08-inverse-cut',
    baseParams: TALKIE_FOLDED_FRAME_08_BASE,
    families: TALKIE_FOLDED_FRAME_08_FAMILIES,
  },
  'talkie-folded-frame-10-wireframe': {
    templateId: 'talkie-folded-frame-10-wireframe',
    baseParams: TALKIE_FOLDED_FRAME_10_BASE,
    families: TALKIE_FOLDED_FRAME_10_FAMILIES,
  },
  'talkie-folded-frame-12-small-glyph': {
    templateId: 'talkie-folded-frame-12-small-glyph',
    baseParams: TALKIE_FOLDED_FRAME_12_BASE,
    families: TALKIE_FOLDED_FRAME_12_FAMILIES,
  },
  'talkie-signal-gate': {
    templateId: 'talkie-signal-gate',
    baseParams: TALKIE_SIGNAL_GATE_BASE,
    families: TALKIE_SIGNAL_GATE_FAMILIES,
  },
  'talkie-keywave': {
    templateId: 'talkie-keywave',
    baseParams: TALKIE_KEYWAVE_BASE,
    families: TALKIE_KEYWAVE_FAMILIES,
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
  'hudson-bridge-schematic': {
    templateId: 'hudson-bridge-schematic',
    baseParams: HUDSON_BRIDGE_SCHEMATIC_BASE,
    families: HUDSON_BRIDGE_SCHEMATIC_FAMILIES,
  },
  'hudson-bridge-wireframe': {
    templateId: 'hudson-bridge-wireframe',
    baseParams: HUDSON_BRIDGE_WIREFRAME_BASE,
    families: HUDSON_BRIDGE_WIREFRAME_FAMILIES,
  },
  'hudson-native-tiles': {
    templateId: 'hudson-native-tiles',
    baseParams: HUDSON_NATIVE_TILES_BASE,
    families: HUDSON_NATIVE_TILES_FAMILIES,
  },
};
