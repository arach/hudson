// ---------------------------------------------------------------------------
// HTTP helpers — fetch wrappers for hx daemon + Hudson API calls
// ---------------------------------------------------------------------------

import { readConfig } from './config';

export async function daemonFetch(path: string, init?: RequestInit): Promise<Response> {
  const config = await readConfig();
  const url = `http://localhost:${config.port}${path}`;
  return fetch(url, init);
}

export async function hudsonFetch(path: string, init?: RequestInit): Promise<Response> {
  const config = await readConfig();
  const url = `${config.hudsonUrl}${path}`;
  return fetch(url, init);
}
