export const HUDSON_VOX_CLIENT_ID = 'hudsonkit';
export const HUDSON_VOX_INTEGRATION_API_PATH = '/api/vox/integration';
export const HUDSON_VOX_INTEGRATION_FILE_NAME = 'hudsonkit.json';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const HUDSONKIT_HOSTS = new Set(['hudsonkit.com', 'www.hudsonkit.com']);

export interface HudsonVoxIntegrationDescriptor {
  id: typeof HUDSON_VOX_CLIENT_ID;
  name: 'HudsonKit';
  brand: {
    name: 'HudsonKit';
    product: 'Hudson workspace';
    logo: string;
    accent: 'cyan';
  };
  description: string;
  origins: string[];
  routes: string[];
  permissions: string[];
  updatedAt: string;
}

export function normalizeHudsonVoxOrigin(rawOrigin: string): string {
  const url = new URL(rawOrigin);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Vox origins must use http or https.');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    return url.origin;
  }
  return url.origin;
}

export function isHudsonVoxRegistrableOrigin(origin: string): boolean {
  const url = new URL(origin);
  const hostname = url.hostname.toLowerCase();
  return LOOPBACK_HOSTS.has(hostname) || HUDSONKIT_HOSTS.has(hostname) || hostname.endsWith('.hudsonkit.com');
}

export function getHudsonVoxOriginCandidates(origin: string): string[] {
  const normalized = normalizeHudsonVoxOrigin(origin);
  const url = new URL(normalized);
  const origins = new Set([normalized]);
  const protocol = url.protocol;
  const port = url.port ? `:${url.port}` : '';

  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    origins.add(`${protocol}//localhost${port}`);
    origins.add(`${protocol}//127.0.0.1${port}`);
  }

  return Array.from(origins).sort();
}

export function createHudsonVoxIntegrationDescriptor(origin: string): HudsonVoxIntegrationDescriptor {
  const normalized = normalizeHudsonVoxOrigin(origin);
  const logo = new URL('/og.png', normalized).href;

  return {
    id: HUDSON_VOX_CLIENT_ID,
    name: 'HudsonKit',
    brand: {
      name: 'HudsonKit',
      product: 'Hudson workspace',
      logo,
      accent: 'cyan',
    },
    description: 'HudsonKit uses Vox for local voice prompts, transcription, and optional spoken assistant replies. Audio stays on the local Vox companion unless the user chooses a remote Vox provider.',
    origins: getHudsonVoxOriginCandidates(normalized),
    routes: ['/capabilities', '/transcribe', '/live', '/live/stop', '/live/cancel', '/voices', '/speak'],
    permissions: ['local_asr', 'local_tts', 'live_sessions'],
    updatedAt: new Date().toISOString(),
  };
}

export function createHudsonVoxLaunchUrl(origin: string): string {
  const descriptor = createHudsonVoxIntegrationDescriptor(origin);
  const params = new URLSearchParams({
    clientId: descriptor.id,
    name: descriptor.name,
    origin: normalizeHudsonVoxOrigin(origin),
    origins: descriptor.origins.join(','),
    logo: descriptor.brand.logo,
    product: descriptor.brand.product,
    description: descriptor.description,
    routes: descriptor.routes.join(','),
    permissions: descriptor.permissions.join(','),
  });

  return `vox://launch?${params.toString()}`;
}
