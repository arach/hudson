// ---------------------------------------------------------------------------
// Custom template parameter declaration
// ---------------------------------------------------------------------------
export interface TemplateParam {
  key: string;
  label: string;
  type: 'number' | 'color' | 'toggle' | 'enum';
  default: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  /** For enum type: list of allowed values */
  options?: string[];
}

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
