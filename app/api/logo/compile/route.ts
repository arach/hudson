import { NextResponse } from 'next/server';
import { compileLogo } from '../intents';

export async function POST(request: Request) {
  try {
    const { source } = (await request.json()) as { source: string };
    const { js } = await compileLogo(source);
    return NextResponse.json({ js });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /source is required/.test(message) ? 400 : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
