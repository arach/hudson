import type { Env } from './types';
import { handleAuth, readHudSessionFromRequest } from './auth';
import { handlePush } from './push';
import { json } from './util';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const authResponse = await handleAuth(request, env);
    if (authResponse) return authResponse;
    const session = await readHudSessionFromRequest(request, env);
    const pushResponse = await handlePush(request, env, session);
    if (pushResponse) return pushResponse;
    return json(404, { error: 'not_found' });
  },
};

export { handleAuth, readHudSessionFromRequest } from './auth';
export { handlePush } from './push';
export type { Env, HudSession } from './types';
