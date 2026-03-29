import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// POST /api/proxy — forwards HTTP requests to avoid CORS restrictions
// ---------------------------------------------------------------------------

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { method, url, headers, body } = payload as {
      method: string;
      url: string;
      headers?: Record<string, string>;
      body?: string;
    };

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid URL' }, { status: 400 });
    }

    // Validate URL — only allow http/https
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Only http and https URLs are supported' }, { status: 400 });
    }

    const startedAt = Date.now();

    const fetchInit: RequestInit = {
      method: method || 'GET',
      headers: headers ?? {},
      redirect: 'follow',
    };

    // Attach body for methods that support it
    if (body && !['GET', 'HEAD'].includes((method || 'GET').toUpperCase())) {
      fetchInit.body = body;
    }

    const upstream = await fetch(url, fetchInit);
    const completedAt = Date.now();

    // Read response body
    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > MAX_BODY_SIZE) {
      return NextResponse.json({ error: 'Response exceeds 10 MB limit' }, { status: 413 });
    }

    // Collect response headers
    const responseHeaders: Record<string, string> = {};
    upstream.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Determine body type from content-type
    const contentType = responseHeaders['content-type'] ?? '';
    let bodyType: 'json' | 'html' | 'xml' | 'text' | 'binary' = 'text';
    if (contentType.includes('json')) bodyType = 'json';
    else if (contentType.includes('html')) bodyType = 'html';
    else if (contentType.includes('xml')) bodyType = 'xml';
    else if (contentType.includes('image') || contentType.includes('octet-stream')) bodyType = 'binary';

    // Convert to text (skip for binary)
    let bodyText = '';
    if (bodyType !== 'binary') {
      bodyText = new TextDecoder().decode(buffer);
    } else {
      bodyText = `[Binary data: ${buffer.byteLength} bytes]`;
    }

    return NextResponse.json({
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
      body: bodyText,
      bodyType,
      size: buffer.byteLength,
      timing: {
        startedAt,
        completedAt,
        durationMs: completedAt - startedAt,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown proxy error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
