import {
  cursorParam,
  limitParam,
  renderAdminDetailHtml,
  renderAdminHtml,
} from "./render-html";
import type {
  AdminDefinition,
  AdminHostHandlers,
  AdminListPage,
  AdminListQuery,
  AdminResource,
} from "./types";

/**
 * Mount an admin definition on a Worker/edge fetch handler.
 *
 * Routes (relative to basePath):
 *   GET  /                      → HTML list page
 *   GET  /:resourceId/:id       → HTML detail (resource must declare `get`)
 *   POST /action/:actionId      → run action, redirect back
 */
export async function handleAdminRequest(
  request: Request,
  admin: AdminDefinition,
  handlers: AdminHostHandlers,
): Promise<Response | null> {
  const url = new URL(request.url);
  const base = normalizeBase(handlers.basePath ?? "");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const route = matchRoute(path, base, admin.resources, request.method);

  if (route == null) return null;

  const allowed = await handlers.auth(request);
  if (!allowed) {
    if (handlers.preferUnauthorized) {
      return json({ error: "Unauthorized" }, 401);
    }
    return json({ error: "Not found." }, 404);
  }

  const ctx = await handlers.context(request);
  const query =
    handlers.preserveQuery?.(request) ??
    (url.search.startsWith("?") ? url.search.slice(1) : url.search);

  if (route.kind === "action") {
    const action = (admin.actions ?? []).find((a) => a.id === route.actionId);
    if (!action) {
      return json({ error: `Unknown action: ${route.actionId}` }, 404);
    }

    const raw = await readBody(request);
    const parsed = action.input.safeParse(raw);
    if (!parsed.success) {
      return htmlError(admin, handlers, request, parsed.error.message, ctx);
    }

    try {
      await action.run(parsed.data, ctx);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed";
      return htmlError(admin, handlers, request, msg, ctx);
    }

    const dest = new URL(request.url);
    dest.pathname = base || "/";
    dest.search = query;
    dest.searchParams.set("notice", "ok");
    return Response.redirect(dest.toString(), 303);
  }

  if (route.kind === "unknown") {
    return json({ error: `Unknown resource: ${route.resourceId}` }, 404);
  }

  if (route.kind === "detail") {
    if (typeof route.resource.get !== "function") {
      return json({ error: `No detail for resource: ${route.resource.id}` }, 404);
    }
    let row: unknown;
    try {
      row = await route.resource.get(ctx, route.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Detail failed";
      return json({ error: msg }, 500);
    }
    if (row == null) {
      return htmlNotFound(admin, route.resource, query, base);
    }
    const html = renderAdminDetailHtml({
      admin,
      resource: route.resource,
      row,
      query,
      basePath: base,
    });
    return htmlResponse(html);
  }

  const notice = url.searchParams.get("notice") === "ok" ? "Saved." : undefined;
  return renderPage(admin, ctx, base, query, url.searchParams, notice);
}

type MatchedRoute =
  | { kind: "root" }
  | { kind: "action"; actionId: string }
  | { kind: "detail"; resource: AdminResource; id: string }
  | { kind: "unknown"; resourceId: string };

function matchRoute(
  path: string,
  base: string,
  resources: AdminResource[],
  method: string,
): MatchedRoute | null {
  const isRoot =
    path === base || path === `${base}/` || (base === "" && path === "/");
  if (isRoot) return { kind: "root" };

  const rest = (base ? path.slice(base.length) : path)
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));

  if (rest.length === 0) return null;

  if (method === "POST" && rest[0] === "action" && rest.length >= 2) {
    return { kind: "action", actionId: rest.slice(1).join("/") };
  }

  if (method === "GET" && rest.length >= 2 && rest[0] !== "action") {
    const resourceId = rest[0];
    const resource = resources.find((r) => r.id === resourceId);
    if (resource) {
      return { kind: "detail", resource, id: rest.slice(1).join("/") };
    }
    if (base && path.startsWith(base)) {
      return { kind: "unknown", resourceId };
    }
    return null;
  }

  return null;
}

async function renderPage(
  admin: AdminDefinition,
  ctx: Awaited<ReturnType<AdminHostHandlers["context"]>>,
  basePath: string,
  query: string,
  searchParams: URLSearchParams,
  notice?: string,
  error?: string,
): Promise<Response> {
  const stats = admin.stats ? await admin.stats(ctx) : [];
  const tables = await Promise.all(
    admin.resources.map(async (resource) => {
      const listQuery = parseListQuery(resource, searchParams);
      const result = await resource.list(ctx, listQuery);
      const page = normalizePage(result, listQuery.limit);
      return {
        resource,
        rows: page.rows,
        nextCursor: page.nextCursor ?? null,
        listQuery,
      };
    }),
  );

  const html = renderAdminHtml({
    admin,
    stats,
    tables,
    query,
    basePath,
    searchParams,
    notice,
    error,
  });

  return htmlResponse(html);
}

export function parseListQuery(
  resource: AdminResource,
  params: URLSearchParams,
): AdminListQuery {
  const prefixedCursor = params.get(cursorParam(resource.id));
  const unprefixedCursor = params.get("cursor");
  const cursor = prefixedCursor || unprefixedCursor || undefined;

  const prefixedLimit = params.get(limitParam(resource.id));
  const unprefixedLimit = params.get("limit");
  const fallback = resource.limit ?? 50;
  const raw = prefixedLimit ?? unprefixedLimit;
  const parsed = raw != null && raw !== "" ? Number(raw) : fallback;
  const limit = Number.isFinite(parsed)
    ? Math.min(200, Math.max(1, Math.floor(parsed)))
    : fallback;

  const searchParam = resource.search?.param ?? "q";
  const search = params.get(searchParam) || undefined;

  const filters: Record<string, string> = {};
  for (const filter of resource.filters ?? []) {
    const value = params.get(filter.param);
    if (value) filters[filter.param] = value;
  }

  return { cursor, limit, search, filters };
}

function normalizePage(
  result: unknown[] | AdminListPage,
  limit: number,
): AdminListPage {
  if (
    result != null &&
    typeof result === "object" &&
    !Array.isArray(result) &&
    "rows" in result
  ) {
    const rows = Array.isArray(result.rows) ? result.rows : [];
    return {
      rows: rows.slice(0, limit),
      nextCursor: result.nextCursor ?? null,
      total: result.total,
    };
  }
  const rows = Array.isArray(result) ? result : [];
  return { rows: rows.slice(0, limit), nextCursor: null };
}

async function htmlError(
  admin: AdminDefinition,
  handlers: AdminHostHandlers,
  request: Request,
  error: string,
  ctx: Awaited<ReturnType<AdminHostHandlers["context"]>>,
): Promise<Response> {
  const url = new URL(request.url);
  const base = normalizeBase(handlers.basePath ?? "");
  const query =
    handlers.preserveQuery?.(request) ??
    (url.search.startsWith("?") ? url.search.slice(1) : url.search);
  const page = await renderPage(
    admin,
    ctx,
    base,
    query,
    url.searchParams,
    undefined,
    error,
  );
  return new Response(page.body, {
    status: 400,
    headers: page.headers,
  });
}

function htmlNotFound(
  admin: AdminDefinition,
  resource: AdminResource,
  query: string,
  basePath: string,
): Response {
  const html = renderAdminDetailHtml({
    admin,
    resource,
    row: { id: "", error: "Not found" },
    query,
    basePath,
    error: "No such record.",
  });
  return htmlResponse(html, 404);
}

/**
 * Inline CSS only; no scripts. Forms post back to the same origin.
 * Hosts that wrap the response should leave these in place (or replace with a
 * strictly tighter policy).
 */
export const ADMIN_HTML_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

export function adminHtmlHeaders(): HeadersInit {
  return {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "content-security-policy": ADMIN_HTML_CSP,
  };
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: adminHtmlHeaders(),
  });
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const ct = request.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const data = (await request.json()) as Record<string, unknown>;
    return data;
  }
  const form = await request.formData();
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") {
      // Keep form values as strings. The action's Zod schema owns coercion;
      // globally coercing numeric-looking values would corrupt text fields
      // such as user IDs and postal codes.
      out[k] = v;
    }
  }
  return out;
}

function normalizeBase(base: string): string {
  if (!base || base === "/") return "";
  return base.startsWith("/")
    ? base.replace(/\/+$/, "")
    : `/${base.replace(/\/+$/, "")}`;
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    },
  });
}
