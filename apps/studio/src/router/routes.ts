export type Route =
  | { kind: "home" }
  | { kind: "exhibit"; slug: string }
  | { kind: "embed"; slug: string }
  | { kind: "paper" }
  | { kind: "doc"; slug: string }
  | { kind: "not-found" };

export function normalizePath(path: string): string {
  if (!path) return "/";
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/**
 * Exhibit/embed slugs are the last path segment.
 * Accepts both:
 *   /exhibits/candidate-orientation
 *   /exhibits/fieldwork/candidate-orientation  (nested folder-style URLs)
 */
function lastSlug(segments: string[]): string | null {
  const last = segments[segments.length - 1];
  if (!last || !/^[a-z0-9-]+$/i.test(last)) return null;
  return last;
}

export function resolveRoute(path: string): Route {
  if (path === "/" || path === "") return { kind: "home" };

  // Paper journeys map — full-bleed product surface inside Studio
  if (path === "/paper" || path.startsWith("/paper/")) return { kind: "paper" };

  const exhibit = path.match(/^\/exhibits\/([a-z0-9/-]+)$/i);
  if (exhibit) {
    const slug = lastSlug(exhibit[1]!.split("/").filter(Boolean));
    if (slug) return { kind: "exhibit", slug };
  }

  const embed = path.match(/^\/embed\/([a-z0-9/-]+)$/i);
  if (embed) {
    const slug = lastSlug(embed[1]!.split("/").filter(Boolean));
    if (slug) return { kind: "embed", slug };
  }

  const doc = path.match(/^\/eng\/([a-z0-9-]+)$/i);
  if (doc) return { kind: "doc", slug: doc[1]! };

  return { kind: "not-found" };
}
