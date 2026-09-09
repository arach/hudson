import { NextResponse } from 'next/server';
import { registryModelOptions, availableCopilotOptions } from '@/app/lib/ai-model-catalog';
import { fetchCopilotChatModels } from '../copilot-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const provider = new URL(req.url).searchParams.get('provider') ?? 'copilot';
  const registry = registryModelOptions();
  const fetchedAt = new Date().toISOString();
  if (provider !== 'copilot' && provider !== 'github-copilot') {
    return NextResponse.json({ provider, source: 'registry', fetchedAt, models: registry, options: registry });
  }
  try {
    const copilot = availableCopilotOptions(await fetchCopilotChatModels(), registry);
    const options = [...copilot, ...registry.filter(model => model.provider !== 'copilot')];
    return NextResponse.json({ provider: 'copilot', source: 'live', fetchedAt, models: copilot, options });
  } catch {
    return NextResponse.json({ provider: 'copilot', source: 'registry', fetchedAt, models: registry, options: registry });
  }
}
