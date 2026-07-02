import { NextRequest, NextResponse } from 'next/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateImage } from 'ai';

/**
 * POST /api/ai/generate-image
 * Generates an image using Google's Gemini/Imagen models.
 *
 * Body: { prompt: string, model?: string, aspectRatio?: string }
 * Returns: { image: { dataUrl, mediaType } }
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GOOGLE_GENERATIVE_AI_API_KEY not set in .env.local' },
      { status: 500 },
    );
  }

  const { prompt, model, aspectRatio } = await req.json();
  if (!prompt) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
  }

  const modelId = model ?? 'imagen-4.0-generate-001';

  console.log(`[generate-image] model=${modelId} prompt="${prompt.slice(0, 80)}..."`);

  try {
    const google = createGoogleGenerativeAI({ apiKey });

    const result = await generateImage({
      model: google.image(modelId),
      prompt,
      ...(aspectRatio ? { aspectRatio } : {}),
      n: 1,
    });

    const img = result.images[0];
    if (!img) {
      return NextResponse.json({ error: 'No image generated' }, { status: 502 });
    }

    // img is a GeneratedFile with base64 or uint8array
    const base64 = img.base64;
    const mediaType = img.mediaType ?? 'image/png';
    const dataUrl = `data:${mediaType};base64,${base64}`;

    console.log(`[generate-image] done, ${Math.round(base64.length * 0.75 / 1024)} KB`);

    return NextResponse.json({
      image: { dataUrl, mediaType },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[generate-image] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
