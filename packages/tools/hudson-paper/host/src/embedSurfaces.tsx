/**
 * Live design surfaces for Paper map cards.
 * Resolves /embed/<slug> to Studio Fieldwork components (in-process).
 *
 * Always re-reads surfacesBySlug() so Vite HMR / registry edits are visible
 * without restarting the host (a frozen module-level map was the "Embed not
 * found" footgun for newly registered journeys).
 */

import type { ComponentType } from "react";
import { surfacesBySlug } from "../../../../../apps/studio/src/exhibits/fieldwork/surfaces";

export function embedSlugFromSrc(src: string): string | null {
  if (!src) return null;
  try {
    const path = src.startsWith("http")
      ? new URL(src).pathname
      : src.startsWith("/")
        ? src
        : `/${src}`;
    const m = path.match(/\/embed\/(?:[a-z0-9-]+\/)*([a-z0-9-]+)\/?$/i);
    return m?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export function resolveEmbedSurface(src: string): ComponentType | null {
  const slug = embedSlugFromSrc(src);
  if (!slug) return null;
  return surfacesBySlug()[slug] ?? null;
}

export function registeredEmbedSlugs(): string[] {
  return Object.keys(surfacesBySlug());
}
