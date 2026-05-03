import type { IncomingMessage, ServerResponse } from 'http';
import { transform } from 'esbuild';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * POST /api/compile — Compile TypeScript source to JavaScript via esbuild.
 * Mirrors the logic from the Next.js API route app/api/logo/compile/route.ts.
 */
export async function handleCompile(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readBody(req);
    const { source } = JSON.parse(body) as { source: string };

    if (typeof source !== 'string' || !source.trim()) {
      json(res, 400, { error: 'source is required' });
      return;
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
        json(res, 422, { error: `renderBody must return a string, got ${typeof output}` });
        return;
      }
    } catch (err) {
      json(res, 422, { error: `Runtime validation failed: ${err instanceof Error ? err.message : String(err)}` });
      return;
    }

    json(res, 200, { js });
  } catch (err) {
    json(res, 422, { error: `Compilation failed: ${err instanceof Error ? err.message : String(err)}` });
  }
}
