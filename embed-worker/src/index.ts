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
      // Some /embed/* paths are static assets shipped with Pages — most
      // importantly /embed/client.js (the standalone embed mount bundle).
      // The CF route pattern (`hudsonkit.com/embed/*`) sends those requests
      // to this worker, so we must hand them back to origin or the worker's
      // 404 wins over Pages' static asset and the embed never mounts.
      return fetch(request);
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
          // Allow framing from any origin (embed use-case). `X-Frame-Options:
          // ALLOWALL` is non-standard and ignored by every modern browser, so
          // we use `frame-ancestors` from CSP — the actual standard — instead.
          // Future-proof: tighten to a host allow-list when consumer registry
          // grows host metadata (e.g. `frame-ancestors *.hudsonkit.com …`).
          'Content-Security-Policy': 'frame-ancestors *;',
          // Edge cache strategy:
          //   max-age=60        — browsers reuse for a minute (fast back/forward)
          //   s-maxage=300      — CF edge serves cached HTML for 5 minutes
          //   swr=86400         — for 24h after expiry, CF returns stale and
          //                       refreshes in the background, so visitors
          //                       almost never wait for a full revalidate
          //   sie=86400         — if the worker errors during revalidate, CF
          //                       keeps serving the stale copy for a day
          // Cache key is the full URL — `?ref=`, `?template=`, `?theme=` all
          // produce distinct cached variants automatically.
          'Cache-Control':
            'public, max-age=60, s-maxage=300, stale-while-revalidate=86400, stale-if-error=86400',
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
