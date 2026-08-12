import type { z } from "zod";
import type {
  AdminAction,
  AdminDefinition,
  AdminResource,
  ColumnDef,
  ColumnFormat,
  StatCard,
} from "./types";
import { StatCardSchema } from "./types";

export type RenderAdminPageInput = {
  admin: AdminDefinition;
  stats?: StatCard[];
  tables: Array<{
    resource: AdminResource;
    rows: unknown[];
  }>;
  /** e.g. "key=…" preserved on forms */
  query: string;
  /** Base path for action posts, e.g. "/credits" */
  basePath: string;
  notice?: string;
  error?: string;
};

export function renderAdminHtml(input: RenderAdminPageInput): string {
  const { admin, stats = [], tables, query, basePath, notice, error } = input;
  const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  const actionBase = basePath.replace(/\/+$/, "") || "";

  const nav =
    admin.nav && admin.nav.length
      ? `<nav class="nav">${admin.nav
          .map(
            (n) =>
              `<a class="${n.active ? "on" : ""}" href="${esc(n.href)}">${esc(n.label)}</a>`,
          )
          .join("")}</nav>`
      : "";

  const validStats = stats.flatMap((stat) => {
    const result = StatCardSchema.safeParse(stat);
    return result.success ? [result.data] : [];
  });

  const cards =
    validStats.length === 0
      ? ""
      : `<div class="cards">${validStats.map(statCard).join("")}</div>`;

  const actionsHtml = (admin.actions ?? [])
    .map((a) => renderAction(a, actionBase, q))
    .join("");

  const tablesHtml = tables
    .map(({ resource, rows }) => renderTable(resource, rows))
    .join("");

  const flash = error
    ? `<p class="flash err">${esc(error)}</p>`
    : notice
      ? `<p class="flash ok">${esc(notice)}</p>`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(admin.title)}</title>
<style>${STYLE}</style>
</head>
<body>
${nav}
<h1>${esc(admin.title)}</h1>
${admin.subtitle ? `<div class="sub">${esc(admin.subtitle)}</div>` : ""}
${flash}
${cards}
${actionsHtml}
${tablesHtml}
</body>
</html>`;
}

function renderAction(
  action: AdminAction,
  basePath: string,
  q: string,
): string {
  const actionUrl = `${basePath}/action/${encodeURIComponent(action.id)}${q}`;
  const fields = action.fields
    .map((f) => {
      if (f.kind === "hidden") {
        return `<input type="hidden" name="${esc(f.name)}" value="${esc(String(f.defaultValue ?? ""))}" />`;
      }
      const type = f.kind === "number" ? "number" : "text";
      const req = f.required === false ? "" : " required";
      const val =
        f.defaultValue !== undefined
          ? ` value="${esc(String(f.defaultValue))}"`
          : "";
      const ph = f.placeholder
        ? ` placeholder="${esc(f.placeholder)}"`
        : "";
      return `<label>${esc(f.label)}<input name="${esc(f.name)}" type="${type}"${req}${val}${ph} /></label>`;
    })
    .join("");

  return `<section class="block">
  <h2>${esc(action.title)}</h2>
  ${action.description ? `<p class="sub">${esc(action.description)}</p>` : ""}
  <form method="POST" action="${esc(actionUrl)}" class="grant">${fields}
    <button type="submit">Run</button>
  </form>
</section>`;
}

function renderTable(resource: AdminResource, rows: unknown[]): string {
  const parsed = rows
    .map((r) => {
      const result = resource.row.safeParse(r);
      return result.success &&
        result.data !== null &&
        typeof result.data === "object"
        ? result.data
        : null;
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  const head = resource.columns
    .map((c) => `<th>${esc(c.label)}</th>`)
    .join("");

  const body =
    parsed.length === 0
      ? `<tr><td colspan="${resource.columns.length}" class="dim">${esc(resource.emptyMessage ?? "Nothing yet.")}</td></tr>`
      : parsed
          .map(
            (row) =>
              `<tr class="row">${resource.columns
                .map((c) => `<td>${formatCell(row[c.key], c)}</td>`)
                .join("")}</tr>`,
          )
          .join("");

  return `<section class="block">
  <h2>${esc(resource.title)}</h2>
  ${resource.description ? `<p class="sub">${esc(resource.description)}</p>` : ""}
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</section>`;
}

function formatCell(value: unknown, col: ColumnDef): string {
  if (value == null || value === "") return `<span class="dim">—</span>`;
  const format: ColumnFormat = col.format ?? "text";
  switch (format) {
    case "int":
      return `<code>${esc(Number(value).toLocaleString("en-US"))}</code>`;
    case "number":
      return `<code>${esc(String(value))}</code>`;
    case "code":
      return `<code>${esc(String(value))}</code>`;
    case "datetime": {
      const s = String(value).replace("T", " ").slice(0, 19);
      return `<code>${esc(s)}</code>`;
    }
    case "muted":
      return `<span class="dim">${esc(String(value))}</span>`;
    default:
      return esc(String(value));
  }
}

function statCard(s: StatCard): string {
  const bar =
    s.percent == null
      ? ""
      : `<div class="bar"><i style="width:${Math.max(0, Math.min(100, s.percent))}%"></i></div>`;
  return `<div class="card">
    <b>${esc(String(s.value))}</b>
    <span>${esc(s.label)}</span>
    ${s.detail ? `<em>${esc(s.detail)}</em>` : ""}
    ${bar}
  </div>`;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    (
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }) as Record<string, string>
    )[c]!,
  );
}

/** Flat hierarchy — no pill chrome; rules + whitespace only. */
const STYLE = `
  :root { color-scheme: light dark; }
  body { margin:0; padding:24px; font:14px/1.5 ui-sans-serif,-apple-system,system-ui,sans-serif; max-width:1100px; }
  a { color:inherit; }
  h1 { font-size:15px; font-weight:600; letter-spacing:.02em; text-transform:uppercase; opacity:.6; margin:0 0 4px; }
  h2 { font-size:11px; text-transform:uppercase; letter-spacing:.04em; opacity:.55; margin:0 0 8px; font-weight:600; }
  .sub { opacity:.55; font-size:12px; margin:0 0 14px; }
  .nav { display:flex; gap:14px; margin-bottom:18px; font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
  .nav a { opacity:.55; text-decoration:none; border-bottom:1px solid transparent; }
  .nav a.on { opacity:1; border-bottom-color: currentColor; }
  .cards { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:22px; padding-bottom:16px;
           border-bottom:1px solid color-mix(in srgb, currentColor 12%, transparent); }
  .card { min-width:120px; padding:0; }
  .card b { display:block; font-size:18px; font-weight:600; font-variant-numeric:tabular-nums; }
  .card span { font-size:11px; opacity:.55; text-transform:uppercase; letter-spacing:.04em; }
  .card em { font-style:normal; font-size:11px; opacity:.5; display:block; }
  .bar { height:3px; background:color-mix(in srgb, currentColor 10%, transparent); margin-top:8px; }
  .bar i { display:block; height:100%; background:color-mix(in srgb, currentColor 45%, transparent); }
  .block { margin:22px 0; }
  table { border-collapse:collapse; width:100%; font-size:12px; }
  th { text-align:left; font-weight:600; opacity:.5; text-transform:uppercase; letter-spacing:.04em; font-size:10px; padding:6px 10px 6px 0; }
  td { padding:7px 10px 7px 0; border-top:1px solid color-mix(in srgb, currentColor 10%, transparent); vertical-align:top; }
  tr.row:hover { background:color-mix(in srgb, currentColor 5%, transparent); }
  code { font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace; }
  .dim { opacity:.5; }
  form.grant { display:flex; flex-wrap:wrap; gap:10px; align-items:end; margin:8px 0 4px; }
  label { display:grid; gap:4px; font-size:10px; text-transform:uppercase; letter-spacing:.04em; opacity:.55; }
  input { font:13px/1.4 ui-sans-serif,system-ui,sans-serif; padding:7px 9px;
          border:0; border-bottom:1px solid color-mix(in srgb, currentColor 22%, transparent);
          background:transparent; color:inherit; min-width:140px; border-radius:0; }
  button { font:12px/1 ui-sans-serif,system-ui,sans-serif; padding:9px 12px; border:0; cursor:pointer;
           background:color-mix(in srgb, currentColor 12%, transparent); color:inherit;
           text-transform:uppercase; letter-spacing:.04em; border-radius:0; }
  .flash { font-size:13px; margin:0 0 14px; }
  .flash.ok { opacity:.8; }
  .flash.err { color:#b3261e; }
  @media (prefers-color-scheme: dark) { .flash.err { color:#ff8a80; } }
`;

// silence unused import when consumers only use render
export type { z };
