// ─────────────────────────────────────────────────────────────────────────────
// buildHtml — Worker HTML builder
//
// Strategy: hand-crafted HTML shell with consumer-specific theming baked in.
//
// The Worker serves /embed/* exclusively. The existing Pages static export
// does not include /embed pages, so there is no "upstream" HTML to fetch and
// patch. Instead we build the full document here.
//
// The document loads:
//   1. /embed/client.js — standalone React entry bundled via esbuild
//      (see embed-worker/scripts/bundle-client.mjs, output: public/embed/client.js)
//      This reads window.__HUDSON_INITIAL__ and mounts EmbedWorkspace.
//
//   2. Next.js chunk fallback — if /embed/client.js is not yet built/deployed,
//      the Worker falls back to loading the known Next.js static chunks from
//      chunks.json. These are the same chunks that the embed page would load
//      via RSC hydration, but loaded directly as scripts. The Next.js App Router
//      bootstrap still runs; without the RSC payload it won't hydrate, but the
//      pre-paint script + CSS vars give correct theming immediately.
//
// Web Standards only — no HTMLRewriter, no CF bindings, no caches.default.
// ─────────────────────────────────────────────────────────────────────────────

import type { ResolvedEmbedState } from './index.ts';
import chunks from './chunks.json';

// URL for the standalone embed client bundle (built by bundle-client.mjs,
// served from Pages CDN as a static file in /public/embed/).
const EMBED_CLIENT_URL = '/embed/client.js';

/**
 * HTML-safe JSON serializer. Escapes </script> sequences and Unicode line
 * terminators so the value is safe to embed inside a <script> block.
 */
function safeJson(value: unknown): string {
  // U+2028 and U+2029 are JS line terminators; build via fromCharCode
  // so the literals do not appear in source.
  const LS = String.fromCharCode(0x2028);
  const PS = String.fromCharCode(0x2029);
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .split(LS).join('\\u2028')
    .split(PS).join('\\u2029');
}

/**
 * Build a CSS custom-property block from the consumer palette + fonts + shadcn
 * tokens, scoped to :root. Placed in <head> as an inline <style>.
 */
function buildTokenCss(state: ResolvedEmbedState): string {
  if (!state.consumer) return '';
  const vars = Object.entries({
    ...state.consumer.palette,
    ...state.consumer.fonts,
    ...(state.consumer.shadcn ?? {}),
  })
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return vars ? `:root {\n${vars}\n}` : '';
}

/**
 * Inline style string for the embed root wrapper (same tokens as above, used
 * as a style= attribute so they cascade to child components immediately).
 */
function buildInlineStyle(state: ResolvedEmbedState): string {
  if (!state.consumer) return '';
  return Object.entries({
    ...state.consumer.palette,
    ...state.consumer.fonts,
    ...(state.consumer.shadcn ?? {}),
  })
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
}

/**
 * Build the pre-paint inline script. Mirrors app/embed/layout.tsx's
 * getEmbedThemeScript() but reads from the Worker-resolved values that are
 * already in __HUDSON_INITIAL__, so no URL-param round-trip is needed.
 */
function buildPrePaintScript(state: ResolvedEmbedState): string {
  return `(function(){
  try {
    var init = window.__HUDSON_INITIAL__;
    var t = init && init.template || '${state.template}';
    var m = init && init.theme || '${state.theme}';
    if (m !== 'dark' && m !== 'light') m = 'dark';
    var d = document.documentElement;
    if (init && init.ref) d.dataset.hudsonRef = init.ref;
    d.dataset.hudsonTemplate = t;
    d.dataset.hudsonTheme = m;
  } catch(e) {}
})();`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the complete embed HTML document with Worker-resolved consumer state.
 *
 * The document structure:
 *   <html data-hudson-template="…" data-hudson-theme="…" data-hudson-ref="…">
 *   <head>
 *     <style>  ← consumer --hud-* tokens scoped to :root
 *     <script> ← window.__HUDSON_INITIAL__ = { state }
 *     <script> ← pre-paint: apply template/theme to <html> immediately
 *     <link>   ← Next.js CSS bundle(s)
 *   </head>
 *   <body>
 *     <div id="hudson-embed-root" data-hudson-* style="…tokens…">
 *     <script type="module"> ← /embed/client.js (standalone React mount)
 *   </body>
 *   </html>
 */
export function buildHtml(
  state: ResolvedEmbedState,
  _appId: string,
  _surface: string,
): string {
  const tokenCss = buildTokenCss(state);
  const inlineStyle = buildInlineStyle(state);
  const prePaint = buildPrePaintScript(state);

  const payload = {
    ref: state.ref,
    template: state.template,
    theme: state.theme,
    activeWorkspaceId: state.activeWorkspaceId,
    focusedAppId: state.focusedAppId,
    activatedAppIds: state.activatedAppIds,
    palette: state.consumer?.palette ?? {},
    fonts: state.consumer?.fonts ?? {},
  };

  const linkTags = (chunks.styles as string[])
    .map(href => `  <link rel="stylesheet" href="${href}" crossorigin="anonymous">`)
    .join('\n');

  // The pre-paint script + consumer tokens go in <head>; the React mount goes
  // at the end of <body> so the #hudson-embed-root div is already in the DOM.
  return `<!DOCTYPE html><!-- Hudson Embed Worker | ref=${state.ref ?? 'none'} template=${state.template} theme=${state.theme} -->
<html lang="en" data-hudson-template="${state.template}" data-hudson-theme="${state.theme}"${state.ref ? ` data-hudson-ref="${state.ref}"` : ''}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hudson — Embed</title>
  <meta name="robots" content="noindex, nofollow">
${tokenCss ? `  <style id="hudson-worker-tokens">\n${tokenCss}\n  </style>` : ''}
  <script id="__HUDSON_INITIAL__">window.__HUDSON_INITIAL__=${safeJson(payload)};</script>
  <script>${prePaint}</script>
${linkTags}
</head>
<body style="margin:0;padding:0;overflow:hidden;background:var(--hud-bg,oklch(0.16 0.005 240))">
  <div
    id="hudson-embed-root"
    data-hudson-ref="${state.ref ?? ''}"
    data-hudson-template="${state.template}"
    data-hudson-theme="${state.theme}"
    data-hudson-workspace="${state.activeWorkspaceId}"
    data-hudson-focus="${state.focusedAppId}"
    style="${inlineStyle}${inlineStyle ? '; ' : ''}min-height: 100vh"
  ></div>
  <script type="module" src="${EMBED_CLIENT_URL}" crossorigin="anonymous"></script>
</body>
</html>`;
}
