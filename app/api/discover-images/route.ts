import { NextRequest, NextResponse } from 'next/server';

/**
 * Discover images from a URL.
 * - If the URL points directly to an image → returns { type: 'direct', image: { dataUrl, ... } }
 * - If the URL points to a webpage → scrapes for images and returns { type: 'page', images: [...] }
 *
 * GET /api/discover-images?url=https://example.com
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

    const contentType = res.headers.get('content-type') ?? '';

    // ── Direct image ──────────────────────────────────────────────────
    if (contentType.startsWith('image/') || contentType.startsWith('application/svg')) {
      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const dataUrl = `data:${contentType};base64,${base64}`;

      return NextResponse.json({
        type: 'direct' as const,
        image: {
          dataUrl,
          contentType,
          size: buffer.byteLength,
          sourceUrl: url,
        },
      });
    }

    // ── HTML page → scrape for images ─────────────────────────────────
    if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
      const html = await res.text();
      const images = extractImages(html, url);

      // Try to grab the page title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : undefined;

      return NextResponse.json({
        type: 'page' as const,
        title,
        images,
      });
    }

    return NextResponse.json({ error: `Unsupported content type: ${contentType}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Image extraction helpers ──────────────────────────────────────────────

interface DiscoveredImage {
  url: string;
  type: 'img' | 'svg' | 'og';
  alt?: string;
  /** For inline SVGs, the full SVG markup */
  inline?: string;
}

function extractImages(html: string, baseUrl: string): DiscoveredImage[] {
  const seen = new Set<string>();
  const images: DiscoveredImage[] = [];

  function addImage(img: DiscoveredImage) {
    const key = img.inline ? `inline:${img.inline.slice(0, 100)}` : img.url;
    if (seen.has(key)) return;
    seen.add(key);
    images.push(img);
  }

  // <img src="..."> tags
  const imgRegex = /<img\s[^>]*?src=["']([^"']+)["'][^>]*?>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    if (!src || src.startsWith('data:')) continue; // skip tiny data URIs

    const altMatch = match[0].match(/alt=["']([^"']*?)["']/i);
    const resolved = resolveUrl(src, baseUrl);
    if (!resolved) continue;

    // Filter to common image extensions or extensionless (could be dynamic)
    if (isLikelyImage(resolved)) {
      addImage({ url: resolved, type: 'img', alt: altMatch?.[1] });
    }
  }

  // <meta property="og:image" content="...">
  const ogPatterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/gi,
  ];
  for (const pattern of ogPatterns) {
    while ((match = pattern.exec(html)) !== null) {
      const resolved = resolveUrl(match[1], baseUrl);
      if (resolved) addImage({ url: resolved, type: 'og' });
    }
  }

  // Inline <svg> elements — serialize them as data URLs
  const svgRegex = /<svg[\s\S]*?<\/svg>/gi;
  while ((match = svgRegex.exec(html)) !== null) {
    const svgMarkup = match[0];
    // Skip tiny decorative SVGs (icons, spinners)
    if (svgMarkup.length < 200) continue;
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svgMarkup).toString('base64')}`;
    addImage({ url: dataUrl, type: 'svg', inline: svgMarkup });
  }

  return images;
}

function resolveUrl(src: string, base: string): string | null {
  try {
    return new URL(src, base).href;
  } catch {
    return null;
  }
}

function isLikelyImage(url: string): boolean {
  // If it has a recognizable image extension, yes
  const path = new URL(url).pathname.toLowerCase();
  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.ico', '.bmp', '.tiff'];
  if (imageExts.some(ext => path.endsWith(ext))) return true;
  // If no extension or unknown extension, include it (could be a CDN URL)
  const lastSegment = path.split('/').pop() ?? '';
  if (!lastSegment.includes('.')) return true;
  return false;
}
