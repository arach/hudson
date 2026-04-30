import { NextResponse } from 'next/server';
import { z } from 'zod';
import { synthesizeHudsonVoxSpeech } from '@/app/lib/tts/voxBridge';

export const runtime = 'nodejs';

const metadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const formatSchema = z.enum(['mp3', 'wav', 'aac', 'opus', 'aiff']);

const speechRequestSchema = z.object({
  text: z.string().trim().min(1),
  provider: z.string().optional(),
  model: z.string().trim().min(1).optional(),
  voice: z.string().min(1).optional(),
  rate: z.number().positive().optional(),
  instructions: z.string().optional(),
  format: formatSchema.optional(),
  preferences: z.object({
    priority: z.enum(['quality', 'balanced', 'responsiveness']).optional(),
    delivery: z.enum(['buffered', 'streaming', 'auto']).optional(),
    bitrateKbps: z.number().int().positive().optional(),
    sampleRateHz: z.number().int().positive().optional(),
  }).optional(),
  plan: z.object({
    priority: z.enum(['quality', 'balanced', 'responsiveness']).optional(),
    delivery: z.enum(['buffered', 'streaming']).optional(),
    format: formatSchema.optional(),
    bitrateKbps: z.number().int().positive().optional(),
    sampleRateHz: z.number().int().positive().optional(),
    cacheStrategy: z.enum(['full-audio', 'progressive']).optional(),
  }).optional(),
  metadata: z.record(z.string(), metadataValueSchema).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = speechRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid synthesis request.', issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const response = await synthesizeHudsonVoxSpeech(parsed.data);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Speech synthesis failed.' },
      { status: 500 },
    );
  }
}
