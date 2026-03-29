import { NextRequest, NextResponse } from 'next/server';

/**
 * CORS proxy for fetching external images.
 * Returns the image as a data URL (base64) for use in canvas/SVG pipelines.
 *
 * GET /api/fetch-image?url=https://example.com/image.png
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing ?url= parameter' }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Hudson/1.0' },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Fetch failed: ${res.status} ${res.statusText}` }, { status: 502 });
    }

    const contentType = res.headers.get('content-type') ?? 'image/png';
    if (!contentType.startsWith('image/') && !contentType.startsWith('application/svg')) {
      return NextResponse.json({ error: `Not an image: ${contentType}` }, { status: 400 });
    }

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    return NextResponse.json({
      dataUrl,
      contentType,
      size: buffer.byteLength,
      sourceUrl: url,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
