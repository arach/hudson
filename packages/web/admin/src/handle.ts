import { renderAdminHtml } from "./render-html";
import type { AdminDefinition, AdminHostHandlers } from "./types";

/**
 * Mount an admin definition on a Worker/edge fetch handler.
 *
 * Routes (relative to basePath):
 *   GET  /                 → HTML page
 *   POST /action/:actionId → run action, redirect back
 */
export async function handleAdminRequest(
  request: Request,
  admin: AdminDefinition,
  handlers: AdminHostHandlers,
): Promise<Response | null> {
  const url = new URL(request.url);
  const base = normalizeBase(handlers.basePath ?? "");
  const path = url.pathname.replace(/\/+$/, "") || "/";

  const isRoot =
    path === base || path === `${base}/` || (base === "" && path === "/");
  const actionPrefix = base ? `${base}/action/` : "/action/";
  const isAction =
    request.method === "POST" && path.startsWith(actionPrefix);

  if (!isRoot && !isAction) {
    // Not our mount — caller continues.
    if (base && !path.startsWith(base)) return null;
    if (!base) return null;
    return null;
  }

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

  if (isAction) {
    const actionId = decodeURIComponent(path.slice(actionPrefix.length));
    const action = (admin.actions ?? []).find((a) => a.id === actionId);
    if (!action) {
      return json({ error: `Unknown action: ${actionId}` }, 404);
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

  // GET page
  const notice = url.searchParams.get("notice") === "ok" ? "Saved." : undefined;
  return renderPage(admin, ctx, base, query, notice);
}

async function renderPage(
  admin: AdminDefinition,
  ctx: Awaited<ReturnType<AdminHostHandlers["context"]>>,
  basePath: string,
  query: string,
  notice?: string,
  error?: string,
): Promise<Response> {
  const stats = admin.stats ? await admin.stats(ctx) : [];
  const tables = await Promise.all(
    admin.resources.map(async (resource) => {
      const rows = await resource.list(ctx);
      const limited =
        resource.limit != null ? rows.slice(0, resource.limit) : rows;
      return { resource, rows: limited };
    }),
  );

  const html = renderAdminHtml({
    admin,
    stats,
    tables,
    query,
    basePath,
    notice,
    error,
  });

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
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
  const page = await renderPage(admin, ctx, base, query, undefined, error);
  return new Response(page.body, {
    status: 400,
    headers: page.headers,
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
  return base.startsWith("/") ? base.replace(/\/+$/, "") : `/${base.replace(/\/+$/, "")}`;
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
