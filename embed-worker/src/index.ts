// ─────────────────────────────────────────────────────────────────────────────
// Hudson Embed Worker — src/index.ts
//
// Intercepts requests to hudsonkit.com/embed/* and returns SSR'd HTML with the
// correct consumer theming baked in (data-hudson-* attrs + --hud-* tokens),
// instead of the static default-only page that Pages serves.
//
// Web Standards only — no CF bindings, no HTMLRewriter, no caches.default.
// Same handler runs on Deno Deploy, Vercel Edge, or self-hosted workerd.
// CF-specific config lives exclusively in wrangler.toml.
// ─────────────────────────────────────────────────────────────────────────────

import { consumers, resolveConsumer, type ConsumerConfig } from './registry.ts';
import { buildHtml } from './buildHtml.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResolvedEmbedState {
  ref: string | undefined;
  consumer: ConsumerConfig | undefined;
  template: string;
  theme: 'dark' | 'light';
  activeWorkspaceId: string;
  focusedAppId: string;
  activatedAppIds: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function firstParam(params: URLSearchParams, key: string): string | undefined {
  return params.get(key) ?? undefined;
}

function cleanId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return /^[a-z][a-z0-9-]{0,63}$/.test(trimmed) ? trimmed : undefined;
}

function cleanTheme(value: string | undefined): 'dark' | 'light' | undefined {
  return value === 'dark' || value === 'light' ? value : undefined;
}

function cleanApps(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const ids = value
    .split(',')
    .map(p => cleanId(p.trim()))
    .filter((id): id is string => Boolean(id));
  return ids.length > 0 ? [...new Set(ids)] : undefined;
}

// ── State resolver ────────────────────────────────────────────────────────────

/**
 * Resolve the embed state from URL params + consumer registry.
 *
 * Priority: URL params > consumer defaults > hard defaults.
 *
 * Unlike the Next.js page which also has access to workspace definitions
 * (for computing activatedAppIds from real app lists), the Worker operates
 * with a simpler model: it uses the consumer's defaultWorkspace / defaultApps /
 * defaultFocus strings directly. The React app on the client validates these
 * against the actual workspace registry after mount.
 */
function resolveState(params: URLSearchParams): ResolvedEmbedState {
  const ref = firstParam(params, 'ref')?.trim() || undefined;
  const consumer = resolveConsumer(ref);

  const template =
    cleanId(firstParam(params, 'template')) ??
    cleanId(consumer?.template) ??
    'hudson';

  const theme =
    cleanTheme(firstParam(params, 'theme')) ??
    consumer?.theme ??
    'dark';

  const activeWorkspaceId =
    cleanId(firstParam(params, 'ws')) ??
    cleanId(consumer?.defaultWorkspace) ??
    'hudson-os';

  const focusedAppId =
    cleanId(firstParam(params, 'focus')) ??
    cleanId(consumer?.defaultFocus) ??
    'hudson-docs';

  const activatedAppIds =
    cleanApps(firstParam(params, 'apps')) ??
    consumer?.defaultApps?.map(id => cleanId(id)).filter((id): id is string => Boolean(id)) ??
    [focusedAppId];

  // Ensure focusedAppId is in activatedAppIds
  const ids = activatedAppIds.includes(focusedAppId)
    ? activatedAppIds
    : [focusedAppId, ...activatedAppIds];

  return {
    ref,
    consumer,
    template,
    theme,
    activeWorkspaceId,
    focusedAppId,
    activatedAppIds: ids,
  };
}

// ── Parse route params from the URL path ──────────────────────────────────────

function parseEmbedPath(pathname: string): { appId: string; surface: string } | null {
  // Matches /embed/<appId>/<surface> (with optional trailing slash)
  const m = pathname.match(/^\/embed\/([^/]+)\/([^/]+)\/?$/);
  if (!m || !m[1] || !m[2]) return null;
  return { appId: m[1], surface: m[2] };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Health / introspection endpoint (useful for smoke-testing deploys)
    if (url.pathname === '/embed/_worker/health') {
      return Response.json({
        ok: true,
        version: '1',
        consumers: Object.keys(consumers),
        timestamp: new Date().toISOString(),
      });
    }

    // Only handle GET requests to /embed/<appId>/<surface>
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const route = parseEmbedPath(url.pathname);
    if (!route) {
      return new Response('Not Found', { status: 404 });
    }

    const { appId, surface } = route;
    const state = resolveState(url.searchParams);

    try {
      const html = buildHtml(state, appId, surface);
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          // Embed pages are not indexed
          'X-Robots-Tag': 'noindex, nofollow',
          // Allow framing from any origin (embed use-case)
          'X-Frame-Options': 'ALLOWALL',
          // Short CDN cache — the Worker itself caches nothing; let CF edge
          // cache for a short window. Personalised params bust the cache.
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
          // Worker attribution
          'X-Hudson-Worker': '1',
          'X-Hudson-Ref': state.ref ?? '',
          'X-Hudson-Template': state.template,
          'X-Hudson-Theme': state.theme,
        },
      });
    } catch (err) {
      console.error('[embed-worker] Unhandled error:', err);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};
