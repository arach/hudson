import { NextResponse } from 'next/server';
import { transform } from 'esbuild';

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] logo/compile: ${msg}`);
}

export async function POST(request: Request) {
  try {
    const { source } = (await request.json()) as { source: string };

    if (typeof source !== 'string' || !source.trim()) {
      log('ERROR: empty source');
      return NextResponse.json({ error: 'source is required' }, { status: 400 });
    }

    log(`compiling ${source.length} chars`);

    // Compile TypeScript → JavaScript (strip types only)
    const result = await transform(source, {
      loader: 'ts',
      target: 'es2020',
    });

    let js = result.code;

    // Strip redeclarations of function parameters (p, vb) — AI agents
    // sometimes emit `const vb = 512;` which clashes with the function signature.
    js = js.replace(/^(const|let|var)\s+vb\s*=\s*[^;]+;\n?/gm, '');
    js = js.replace(/^(const|let|var)\s+p\s*=\s*[^;]+;\n?/gm, '');

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
