import type {
  DrawingNode,
  DrawingNodeMap,
  DrawingTool,
  ElementTransformOffset,
} from '../../lib/drawing';

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
  /** For enum params: selecting an option may apply a bundle of sibling param values. */
  sets?: Record<string, Record<string, number | string | boolean>>;
}

// ---------------------------------------------------------------------------
// Per-element drag offsets. Layer above template params: the template still
// computes each element's natural position, and the offset map is applied as
// a transform on top. Keyed by stable shape ID (the `data-element-id` on the
// rendered SVG node), then templateId → shapeId at the provider level.
// ---------------------------------------------------------------------------
export type ShapeOffset = ElementTransformOffset;
export type LogoElementOffsets = Record<string, ShapeOffset>;

// ---------------------------------------------------------------------------
// Structured drawing components. These are document-level logo components,
// not template internals: they render into the final SVG and expose generic
// geometry/style controls regardless of the active template.
// ---------------------------------------------------------------------------
export type LogoEditorTool = DrawingTool;
export type LogoDrawingShape = DrawingNode;
export type LogoDrawingShapeMap = DrawingNodeMap;

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
// Lighting configuration — logo-wide directional light effect
// ---------------------------------------------------------------------------
export interface LightingConfig {
  /** Light direction in degrees (0=right, 90=top, 180=left, 270=bottom) */
  azimuth: number;
  /** Light height above surface in degrees (10=dramatic, 90=flat overhead) */
  elevation: number;
  /** Diffuse light strength (0=none, 2=strong) */
  intensity: number;
  /** Specular highlight strength (0=matte, 1=glossy) */
  specular: number;
  /** Specular sharpness — higher = tighter, more metallic (4=soft, 128=sharp) */
  specularExp: number;
  /** Perceived depth/height of shapes for the bump map */
  surfaceScale: number;
  /** Base illumination level that prevents shadows from going fully dark */
  ambient: number;
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
  'Inter', 'Geist Mono', 'JetBrains Mono', 'Noto Serif Display',
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
const LOCAL_FONTS = new Set(['Inter', 'Geist Mono', 'JetBrains Mono', 'Noto Serif Display']);

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
  /** True for shipped/read-only template files. */
  builtin?: boolean;
  /** Compiled JS function body: receives (p, vb) where p = merged params, vb = 512.
   *  Must return an SVG inner content string. */
  renderBody: string;
  /** Original TypeScript source (what the AI reads/edits). */
  sourceCode?: string;
  params: TemplateParam[];
  /** Classification: 'style' = abstract style templates, 'brand' = brand-specific marks.
   *  Drives the two-section sidebar tree. Optional; templates without `kind` fall back
   *  to 'style' for grouping purposes. */
  kind?: 'style' | 'brand';
  /** Optional: id of the template this was spawned from (AI iteration on picks).
   *  Builds a family-tree relationship — children render nested under their parent
   *  in the variant nav. Roots (built-ins, hand-authored, promoted variants) have
   *  no parentId. */
  parentId?: string;
  createdAt: number;
  updatedAt: number;
}

export type LogoTemplateKind = NonNullable<LogoTemplate['kind']>;

function normalizeTemplateNameForLineage(value: string): string {
  return value
    .toLowerCase()
    .replace(/[·—–:]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function hasTemplateNamePrefix(parentName: string, childName: string): boolean {
  const parent = normalizeTemplateNameForLineage(parentName);
  const child = normalizeTemplateNameForLineage(childName);
  return parent.length > 0 && child !== parent && child.startsWith(`${parent} `);
}

function findInferredParentId(template: LogoTemplate, templates: LogoTemplate[]): string | undefined {
  return templates
    .filter(candidate => candidate.id !== template.id && hasTemplateNamePrefix(candidate.name, template.name))
    .sort((a, b) => {
      const byLength = normalizeTemplateNameForLineage(b.name).length - normalizeTemplateNameForLineage(a.name).length;
      if (byLength !== 0) return byLength;
      return b.createdAt - a.createdAt;
    })[0]?.id;
}

/**
 * Heal template lineage for older AI-created files that omitted metadata.
 * Explicit parent/kind always win. Missing parentId is inferred from the
 * longest matching brand/name prefix, and missing kind inherits from parent.
 */
export function normalizeLogoTemplateLineage(templates: LogoTemplate[]): LogoTemplate[] {
  const byId = new Map(templates.map(template => [template.id, template]));
  const parentById = new Map<string, string | undefined>();

  for (const template of templates) {
    const explicitParentId = template.parentId && byId.has(template.parentId)
      ? template.parentId
      : undefined;
    parentById.set(template.id, explicitParentId ?? findInferredParentId(template, templates) ?? template.parentId);
  }

  const kindById = new Map<string, LogoTemplateKind | undefined>();
  const resolveKind = (templateId: string, seen = new Set<string>()): LogoTemplateKind | undefined => {
    if (kindById.has(templateId)) return kindById.get(templateId);
    if (seen.has(templateId)) return undefined;
    const template = byId.get(templateId);
    if (!template) return undefined;

    let kind = template.kind;
    const parentId = parentById.get(templateId);
    if (!kind && parentId && byId.has(parentId)) {
      kind = resolveKind(parentId, new Set(seen).add(templateId));
    }
    if (!kind && templates.some(candidate => candidate.kind === 'brand' && hasTemplateNamePrefix(candidate.name, template.name))) {
      kind = 'brand';
    }

    kindById.set(templateId, kind);
    return kind;
  };

  return templates.map(template => {
    const parentId = parentById.get(template.id);
    const kind = resolveKind(template.id);
    if (parentId === template.parentId && kind === template.kind) return template;
    return { ...template, parentId, kind };
  });
}

export function resolveLogoTemplatePlacement(
  templates: LogoTemplate[],
  activeTemplateId: string,
  requested?: {
    parentId?: unknown;
    kind?: unknown;
    name?: unknown;
  },
): { parentId?: string; kind: LogoTemplateKind } {
  const normalized = normalizeLogoTemplateLineage(templates);
  const byId = new Map(normalized.map(template => [template.id, template]));
  const requestedParentId = typeof requested?.parentId === 'string' && byId.has(requested.parentId)
    ? requested.parentId
    : undefined;
  const activeParentId = byId.has(activeTemplateId) ? activeTemplateId : undefined;
  const parentId = requestedParentId ?? activeParentId;
  const requestedKind = requested?.kind === 'brand' || requested?.kind === 'style'
    ? requested.kind
    : undefined;
  const parentKind = parentId ? byId.get(parentId)?.kind : undefined;
  const inferredKind = typeof requested?.name === 'string'
    ? normalized.find(candidate => candidate.kind === 'brand' && hasTemplateNamePrefix(candidate.name, requested.name as string))?.kind
    : undefined;

  return {
    parentId,
    kind: requestedKind ?? parentKind ?? inferredKind ?? 'style',
  };
}

export function compactLogoTemplateLabel(template: LogoTemplate, ancestors: LogoTemplate[]): string {
  if (ancestors.length === 0) return template.name;

  const names = ancestors
    .map(ancestor => ancestor.name.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const compacted = template.name
      .replace(new RegExp(`^${escaped}(?:\\s*[·:—–-]\\s*|\\s+)`, 'i'), '')
      .trim();
    if (compacted && compacted !== template.name) return compacted;
  }

  return template.name;
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
  't-decoration',
  't-texture-phosphor',
  't-texture-dot-matrix',
  't-texture-pixel',
  't-texture-halftone',
  't-texture-letterpress',
  't-texture-etched',
  't-texture-chrome',
  't-texture-particle',
]);

export function isBuiltinVariant(id: string): boolean {
  return BUILTIN_IDS.has(id);
}
