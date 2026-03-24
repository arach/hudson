// ---------------------------------------------------------------------------
// Custom template parameter declaration
// ---------------------------------------------------------------------------
export interface TemplateParam {
  key: string;
  label: string;
  type: 'number' | 'color' | 'toggle' | 'enum' | 'text' | 'repeatable';
  default: number | string | boolean | Record<string, unknown>[];
  min?: number;
  max?: number;
  step?: number;
  /** For enum type: list of allowed values */
  options?: string[];
  /** For text type: placeholder text */
  placeholder?: string;
  /** For repeatable type: template for each item + fields within each item */
  itemTemplate?: Record<string, unknown>;
  itemFields?: TemplateParam[];
  /** Collapsible section group name — params with the same group render together */
  group?: string;
}

// ---------------------------------------------------------------------------
// Color-only subset that varies between light and dark modes
// ---------------------------------------------------------------------------
export interface ColorSet {
  bgColor: string;
  paneColor: string;
  dimPaneColor: string;
  channelColor: string;
  strokeColor: string;
}

// ---------------------------------------------------------------------------
// Wordmark configuration
// ---------------------------------------------------------------------------
export interface WordmarkConfig {
  text: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  letterSpacing: number;
  color: string;
  lightColor: string;
  layout: 'icon-only' | 'horizontal' | 'stacked';
  gap: number;
  offsetX: number;  // text X offset relative to default position
  offsetY: number;  // text Y offset relative to default position
}

/** Popular Google Fonts + local fonts for the picker */
export const GOOGLE_FONTS = [
  // Local fonts (already loaded)
  'Inter', 'AstroMono', 'Geist Mono', 'JetBrains Mono', 'Noto Serif Display',
  // Premium sans-serif
  'DM Sans', 'Plus Jakarta Sans', 'Space Grotesk', 'Outfit', 'Sora',
  'Figtree', 'Urbanist', 'Manrope', 'Work Sans', 'General Sans',
  'Instrument Sans', 'Satoshi', 'Switzer', 'Cabinet Grotesk',
  // Classic sans-serif
  'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Raleway', 'Nunito',
  // Premium serif
  'Fraunces', 'Instrument Serif', 'Newsreader', 'Literata', 'Brygada 1918',
  'Gloock', 'Bodoni Moda', 'Young Serif',
  // Classic serif
  'Playfair Display', 'Merriweather', 'Lora', 'Libre Baskerville',
  'Cormorant Garamond', 'EB Garamond', 'Crimson Text', 'Source Serif 4',
  // Display / brand
  'Bebas Neue', 'Oswald', 'Anton', 'Abril Fatface', 'Righteous',
  'Archivo Black', 'Permanent Marker', 'Dela Gothic One',
  'Unbounded', 'Bricolage Grotesque', 'Familjen Grotesk', 'Darker Grotesque',
  // Mono
  'Fira Code', 'Source Code Pro', 'IBM Plex Mono', 'Space Mono', 'Inconsolata',
  'Commit Mono', 'Monaspace Neon',
] as const;

/** Local fonts that don't need Google Fonts loading */
const LOCAL_FONTS = new Set(['Inter', 'AstroMono', 'Geist Mono', 'JetBrains Mono', 'Noto Serif Display']);

/** Load a Google Font via CSS link injection */
export function loadGoogleFont(family: string) {
  if (LOCAL_FONTS.has(family)) return;
  const id = `gfont-${family.replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

export const FONT_FAMILY_MAP: Record<string, string> = {
  'Inter': 'Inter, system-ui, sans-serif',
  'AstroMono': 'AstroMono, monospace',
  'Geist Mono': 'Geist Mono, monospace',
  'JetBrains Mono': 'JetBrains Mono, monospace',
  'Noto Serif Display': 'Noto Serif Display, Georgia, serif',
};

// ---------------------------------------------------------------------------
// AI-authored logo template
// ---------------------------------------------------------------------------
export interface LogoTemplate {
  id: string;
  name: string;
  description: string;
  /** Compiled JS function body: receives (p, vb) where p = merged params, vb = 512.
   *  Must return an SVG inner content string. */
  renderBody: string;
  /** Original TypeScript source (what the AI reads/edits). */
  sourceCode?: string;
  params: TemplateParam[];
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Built-in template IDs
// ---------------------------------------------------------------------------
export const BUILTIN_IDS = new Set([
  'negative-space',
  'green-channel',
  'grid-color',
  'interlocking',
  'lattice-grid',
  'app-windows',
  'dot-matrix',
  'mosaic',
]);

export function isBuiltinVariant(id: string): boolean {
  return BUILTIN_IDS.has(id);
}
