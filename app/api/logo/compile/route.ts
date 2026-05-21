import { NextResponse } from 'next/server';
import { compileLogoRenderBody, normalizeLogoRenderSource, stripTemplateMetaBlock } from '../renderCompiler';

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] logo/compile: ${msg}`);
}

export async function POST(request: Request) {
  try {
    const { source: rawSource } = (await request.json()) as { source: string };

    if (typeof rawSource !== 'string' || !rawSource.trim()) {
      log('ERROR: empty source');
      return NextResponse.json({ error: 'source is required' }, { status: 400 });
    }

    const strippedSource = stripTemplateMetaBlock(rawSource).trim();
    const source = normalizeLogoRenderSource(strippedSource);
    if (source !== strippedSource) {
      log(`normalized LLM over-escapes (${strippedSource.length} → ${source.length} chars)`);
    }
    log(`compiling ${source.length} chars`);

    const js = await compileLogoRenderBody(source);

    // Validate: the compiled JS must be executable as a function body (p, vb) => string
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('p', 'vb', js);
      const testParams = {
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
      const output = fn(testParams, 512);
      if (typeof output !== 'string') {
        log(`ERROR: renderBody returned ${typeof output} instead of string`);
        return NextResponse.json(
          { error: `renderBody must return a string, got ${typeof output}` },
          { status: 422 },
        );
      }
      log(`OK: compiled ${js.length} chars, renders ${output.length} char SVG`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`ERROR runtime: ${msg}`);
      log(`source preview: ${source.slice(0, 200)}`);
      return NextResponse.json(
        { error: `Runtime validation failed: ${msg}` },
        { status: 422 },
      );
    }

    return NextResponse.json({ js });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`ERROR compile: ${msg}`);
    return NextResponse.json(
      { error: `Compilation failed: ${msg}` },
      { status: 422 },
    );
  }
}
