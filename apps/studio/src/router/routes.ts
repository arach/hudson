export type Route =
  | { kind: "home" }
  | { kind: "exhibit"; slug: string }
  | { kind: "doc"; slug: string }
  | { kind: "not-found" };

export function normalizePath(path: string): string {
  if (!path) return "/";
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

export function resolveRoute(path: string): Route {
  if (path === "/" || path === "") return { kind: "home" };
  const exhibit = path.match(/^\/exhibits\/([a-z0-9-]+)$/i);
  if (exhibit) return { kind: "exhibit", slug: exhibit[1] };
  const doc = path.match(/^\/eng\/([a-z0-9-]+)$/i);
  if (doc) return { kind: "doc", slug: doc[1] };
  return { kind: "not-found" };
}
