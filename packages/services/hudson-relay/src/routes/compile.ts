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
 * Mirrors the logic from the Next.js API route apps/web/app/api/logo/compile/route.ts.
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

    // Validate: the compiled JS must parse as a function body (p, vb) => string.
    // Constructing the Function checks syntax without executing the body — the
    // relay must never RUN client-supplied code (it has full Node builtins).
    // Runtime behavior (returns a string, etc.) is validated in the browser.
    try {
      new Function('p', 'vb', js);
    } catch (err) {
      json(res, 422, { error: `Validation failed: ${err instanceof Error ? err.message : String(err)}` });
      return;
    }

    json(res, 200, { js });
  } catch (err) {
    json(res, 422, { error: `Compilation failed: ${err instanceof Error ? err.message : String(err)}` });
  }
}
