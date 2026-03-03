import { NextResponse } from 'next/server';
import { transform } from 'esbuild';

export async function POST(request: Request) {
  try {
    const { source } = (await request.json()) as { source: string };

    if (typeof source !== 'string' || !source.trim()) {
      return NextResponse.json({ error: 'source is required' }, { status: 400 });
    }

    // Compile TypeScript → JavaScript (strip types only)
    const result = await transform(source, {
      loader: 'ts',
      target: 'es2020',
    });

    const js = result.code;

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
        return NextResponse.json(
          { error: `renderBody must return a string, got ${typeof output}` },
          { status: 422 },
        );
      }
    } catch (err) {
      return NextResponse.json(
        { error: `Runtime validation failed: ${err instanceof Error ? err.message : String(err)}` },
        { status: 422 },
      );
    }

    return NextResponse.json({ js });
  } catch (err) {
    // esbuild compilation error
    return NextResponse.json(
      { error: `Compilation failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 422 },
    );
  }
}
