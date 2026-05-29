import { intent } from '../../lib/intent';
import {
  compileLogoRenderBody,
  normalizeLogoRenderSource,
  stripTemplateMetaBlock,
} from './renderCompiler';

const VALIDATION_PARAMS = {
  bgColor: '#111113',
  paneColor: '#ffffff',
  dimPaneColor: 'rgba(255,255,255,0.55)',
  channelColor: 'rgba(51,199,115,0.3)',
  borderRadius: 80,
  paneRadius: 14,
  gapWidth: 14,
  splitX: 0.37,
  splitY: 0.60,
  padding: 72,
};

export interface CompileLogoResult {
  js: string;
  jsBytes: number;
  svgBytes: number;
}

export const compileLogo = intent(
  {
    id: 'logo.compile',
    title: 'Compile a logo render body',
    description:
      'Validate and compile a logo render body source string into executable JavaScript ready to feed the Logo renderer.',
    category: 'tool',
    keywords: ['logo', 'compile', 'render', 'svg', 'template'],
    appId: 'logo',
    importPath: 'app/api/logo/intents',
    exportName: 'compileLogo',
    params: [
      {
        name: 'source',
        description:
          'Render body source — a string of TS/JS whose top-level body returns an SVG string given `(p, vb)`.',
        type: 'string',
      },
    ],
    body: `
Compiles a logo template render body — a string of TypeScript/JavaScript whose
top-level body returns SVG given a params object and a numeric viewBox.

Always:
- Strip the template meta block (the comment header) before compiling.
- Normalize LLM over-escapes (\\\\n, \\\\", etc.) — the input may come from an LLM stream.
- Validate the compiled output by invoking it once with a known parameter set.
  If validation fails, surface the runtime error to the caller — don't try to
  repair the source.

Don't:
- Mutate the source beyond the standard normalization.
- Cache. Compilation is cheap; the caller owns lifetime.
- Skip validation, even for trivially small inputs.
`.trim(),
  },
  async (source: string): Promise<CompileLogoResult> => {
    if (typeof source !== 'string' || !source.trim()) {
      throw new Error('source is required');
    }

    const stripped = stripTemplateMetaBlock(source).trim();
    const normalized = normalizeLogoRenderSource(stripped);
    const js = await compileLogoRenderBody(normalized);

    // eslint-disable-next-line no-new-func
    const fn = new Function('p', 'vb', js);
    const output = fn(VALIDATION_PARAMS, 512);
    if (typeof output !== 'string') {
      throw new Error(`renderBody must return a string, got ${typeof output}`);
    }

    return { js, jsBytes: js.length, svgBytes: output.length };
  },
);
