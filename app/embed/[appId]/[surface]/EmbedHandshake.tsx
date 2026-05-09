'use client';

import { useEffect, useRef } from 'react';

const ALLOWED_ORIGINS = (() => {
  const list = new Set<string>();
  if (typeof window !== 'undefined') list.add(window.location.origin);
  const env = process.env.NEXT_PUBLIC_HUDSON_EMBED_ORIGINS ?? '';
  for (const origin of env.split(',').map((s) => s.trim()).filter(Boolean)) {
    list.add(origin);
  }
  return list;
})();

function isAllowedOrigin(origin: string): boolean {
  if (typeof window !== 'undefined' && origin === window.location.origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (ALLOWED_ORIGINS.has('*')) return true;
  return false;
}

function applyTokens(vars: unknown) {
  if (!vars || typeof vars !== 'object') return;
  for (const [k, v] of Object.entries(vars as Record<string, unknown>)) {
    if (typeof k === 'string' && k.startsWith('--hud-') && typeof v === 'string') {
      document.documentElement.style.setProperty(k, v);
    }
  }
}

export function EmbedHandshake({ surface }: { surface: string }) {
  const sentReady = useRef(false);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!isAllowedOrigin(e.origin)) return;
      const data = e.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'hudson:embed-context' && data.context) {
        const ctx = data.context;
        applyTokens(ctx.palette);
        applyTokens(ctx.fonts);
        if (ctx.layout?.density) {
          document.documentElement.dataset.density = String(ctx.layout.density);
        }
        if (ctx.surface) document.documentElement.dataset.surface = String(ctx.surface);
        if (ctx.context?.workspace) {
          document.documentElement.dataset.workspace = String(ctx.context.workspace);
        }
      } else if (data.type === 'hudson:theme-sync') {
        applyTokens(data.vars);
      }
    }
    window.addEventListener('message', onMessage);

    if (window.parent !== window && !sentReady.current) {
      sentReady.current = true;
      window.parent.postMessage(
        { type: 'hudson:embed-ready', surfaceId: surface, sizing: { mode: 'fill' } },
        '*',
      );
    }

    return () => window.removeEventListener('message', onMessage);
  }, [surface]);

  return null;
}
