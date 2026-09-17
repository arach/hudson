/** Local-only manual acceptance host. Never deploy this example. */
import { resolve } from 'node:path';
import { makeGPTLiveBackendRoute, gptLiveSettings } from '../web-host-example';
const port = Number(process.env.HUDSON_VOICE_PORT ?? 4318);
const origin = `http://127.0.0.1:${port}`;
const nonce = crypto.randomUUID();
const apiKey = process.env.OPENAI_API_KEY;
const delegationModel = process.env.GPT_LIVE_DELEGATION_MODEL;
const config = { ...gptLiveSettings, options: { delegationModel: delegationModel ?? '' } };
const route = apiKey && delegationModel ? makeGPTLiveBackendRoute({ apiKey, config,
  auth: { authenticate: value => value === nonce } }) : null;
const bundle = await Bun.build({ entrypoints: [resolve(import.meta.dir, 'client.ts')], target: 'browser',
  plugins: [{ name: 'local-conversation-export', setup(build) {
    build.onResolve({ filter: /^@hudsonkit\/ai\/conversation$/ }, () => ({
      path: resolve(import.meta.dir, '../../../../packages/web/ai-backends/src/conversation/index.ts') }));
  } }],
});
if (!bundle.success) throw new Error('Browser example compilation failed.');
let attempts = 0;
const server = Bun.serve({ hostname: '127.0.0.1', port, async fetch(request) {
  const url = new URL(request.url);
  if (url.origin !== origin) return new Response('Invalid host', { status: 403 });
  if (request.method === 'GET' && url.pathname === '/') return new Response(Bun.file(resolve(import.meta.dir, 'index.html')), {
    headers: { 'content-type': 'text/html', 'set-cookie': `hudsonVoice=${nonce}; HttpOnly; SameSite=Strict; Path=/`, 'cache-control': 'no-store' } });
  if (request.method === 'GET' && url.pathname === '/client.js') return new Response(bundle.outputs[0], {headers:{'content-type':'text/javascript'}});
  if (request.method === 'GET' && url.pathname === '/status') return Response.json({ ready: !!route, config: { ...config, options: { delegationModel: delegationModel ?? '' } },
    message: route ? 'Ready for a maximum 90-second session.' : 'Set OPENAI_API_KEY and GPT_LIVE_DELEGATION_MODEL on the server before connecting.' });
  if (request.method === 'POST' && url.pathname === '/session') {
    const cookie = request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('hudsonVoice='))?.slice(12);
    if (request.headers.get('origin') !== origin || cookie !== nonce) return new Response('Forbidden', {status:403});
    if (!route) return Response.json({error:'Server credentials or delegation model missing.'},{status:503});
    if (attempts >= 3) return Response.json({error:'Three-session smoke-test budget exhausted. Restart deliberately to continue.'},{status:429});
    if (Number(request.headers.get('content-length') ?? 0) > 65536) return new Response('Too large',{status:413});
    const text = await request.text();
    if (text.length > 65536) return new Response('Too large',{status:413});
    let body: Record<string, unknown>;
    try { body = JSON.parse(text); } catch { return new Response('Invalid JSON',{status:400}); }
    attempts++;
    const reply = await route({authorization:cookie,body});
    console.log(JSON.stringify({event:'broker-exchange',attempt:attempts,status:reply.status}));
    return Response.json(reply.body,{status:reply.status});
  }
  return new Response('Not found',{status:404});
}});
console.log(`GPT-Live manual check: ${origin} (credential values never logged)`);
process.on('SIGINT',()=>{server.stop(true);process.exit(0);});
