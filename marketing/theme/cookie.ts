import 'server-only';
import { cookies } from 'next/headers';
import { DEFAULTS, STUDIO_COOKIE, type StudioState } from './defaults';

export async function readStudioState(): Promise<StudioState> {
  const store = await cookies();
  const raw = store.get(STUDIO_COOKIE)?.value;
  if (!raw) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(raw) as Partial<StudioState>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}
