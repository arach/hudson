import type {
  AdminAction,
  AdminDefinition,
  AdminListQuery,
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
    nextCursor?: string | null;
    listQuery?: AdminListQuery;
  }>;
  /** e.g. "key=…" preserved on forms */
  query: string;
  /** Base path for action posts, e.g. "/credits" */
  basePath: string;
  /** Current URL params — filter values and pager links. */
  searchParams?: URLSearchParams;
  notice?: string;
  error?: string;
};

export type RenderAdminDetailInput = {
  admin: AdminDefinition;
  resource: AdminResource;
  row: unknown;
  query: string;
  basePath: string;
  error?: string;
};

export function cursorParam(resourceId: string): string {
  return `${resourceId}.cursor`;
}

export function limitParam(resourceId: string): string {
  return `${resourceId}.limit`;
}

export function renderAdminHtml(input: RenderAdminPageInput): string {
  const { admin, stats = [], tables, query, basePath, notice, error } = input;
  const params = input.searchParams ?? new URLSearchParams(query);
  const q = queryPrefix(query);
  const actionBase = basePath.replace(/\/+$/, "") || "";

  const validStats = stats.flatMap((stat) => {
    const result = StatCardSchema.safeParse(stat);
    return result.success ? [result.data] : [];
  });

  const cards =
    validStats.length === 0
      ? ""
      : `<div class="cards">${validStats.map(statCard).join("")}</div>`;

  const pageActions = (admin.actions ?? []).filter((a) => !a.perRow);
  const actionsHtml = pageActions
    .map((a) => renderAction(a, actionBase, q))
    .join("");

  const tablesHtml = tables
    .map(({ resource, rows, nextCursor, listQuery }) =>
      renderTable(resource, rows, {
        query,
        basePath: actionBase,
        nextCursor,
        listQuery,
        searchParams: params,
        rowActions: (admin.actions ?? []).filter(
          (a) => a.perRow && a.beside === resource.id,
        ),
      }),
    )
    .join("");

  return wrapPage({
    title: admin.title,
    subtitle: admin.subtitle,
    nav: renderNav(admin.nav),
    flash: renderFlash(error, notice),
    body: `${cards}${actionsHtml}${tablesHtml}`,
  });
}

export function renderAdminDetailHtml(input: RenderAdminDetailInput): string {
  const { admin, resource, row, query, basePath, error } = input;
  const q = queryPrefix(query);
  const listHref = `${basePath.replace(/\/+$/, "") || "/"}${q}`;

  return wrapPage({
    title: `${resource.title} · ${admin.title}`,
    subtitle: admin.subtitle,
    nav: renderNav(admin.nav),
    flash: renderFlash(error, undefined),
    body: `<p class="back"><a href="${esc(listHref)}">← ${esc(resource.title)}</a></p>
<h1>${esc(resource.title)}</h1>
${renderDetailBody(resource, row)}`,
  });
}

function renderDetailBody(resource: AdminResource, raw: unknown): string {
  const parsed = parseRow(resource, raw);
  const record =
    parsed ??
    (raw != null && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : { value: raw });
  const dumps = new Set(resource.detail?.dumps ?? []);

  const fields = resource.columns
    .filter((c) => !dumps.has(c.key))
    .map((c) => {
      const value = record[c.key];
      return `<div class="field"><span>${esc(c.label)}</span><div>${formatCell(value, c)}</div></div>`;
    })
    .join("");

  const dumpHtml = [...dumps]
    .map((key) => {
      const value = record[key];
      if (value == null || value === "") return "";
      return `<h2>${esc(key)}</h2><pre>${esc(stringifyDump(value))}</pre>`;
    })
    .join("");

  const extraKeys = Object.keys(record).filter((key) => {
    if (resource.columns.some((c) => c.key === key)) return false;
    if (dumps.has(key)) return false;
    return true;
  });

  const extra =
    extraKeys.length === 0
      ? ""
      : extraKeys
          .map((key) => {
            const value = record[key];
            if (value != null && typeof value === "object") {
              return `<h2>${esc(key)}</h2><pre>${esc(stringifyDump(value))}</pre>`;
            }
            return `<div class="field"><span>${esc(key)}</span><div>${esc(String(value ?? "—"))}</div></div>`;
          })
          .join("");

  return `${fields ? `<div class="fields">${fields}</div>` : ""}${dumpHtml}${extra}${
    parsed ? "" : `<p class="sub">Row did not match the resource schema; showing raw values.</p>`
  }`;
}

function stringifyDump(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function renderAction(
  action: AdminAction,
  basePath: string,
  q: string,
): string {
  const actionUrl = `${basePath}/action/${encodeURIComponent(action.id)}${q}`;
  const fields = action.fields
    .map((f) => renderActionField(f, f.defaultValue))
    .join("");

  return `<section class="block">
  <h2>${esc(action.title)}</h2>
  ${action.description ? `<p class="sub">${esc(action.description)}</p>` : ""}
  <form method="POST" action="${esc(actionUrl)}" class="grant">${fields}
    <button type="submit">Run</button>
  </form>
</section>`;
}

export function renderActionField(
  field: AdminAction["fields"][number],
  value?: string | number,
): string {
  const current =
    value !== undefined && value !== null && value !== ""
      ? String(value)
      : field.defaultValue !== undefined
        ? String(field.defaultValue)
        : "";

  if (field.kind === "hidden") {
    return `<input type="hidden" name="${esc(field.name)}" value="${esc(current)}" />`;
  }

  if (field.kind === "select") {
    const req = field.required === false ? "" : " required";
    const options = [
      field.required === false ? `<option value="">Any</option>` : "",
      ...(field.options ?? []).map((o) => {
        const selected = o.value === current ? " selected" : "";
        return `<option value="${esc(o.value)}"${selected}>${esc(o.label)}</option>`;
      }),
    ].join("");
    return `<label>${esc(field.label)}<select name="${esc(field.name)}"${req}>${options}</select></label>`;
  }

  if (field.kind === "toggle") {
    const req = field.required === false ? "" : " required";
    const radios = (field.options ?? [])
      .map((o, i) => {
        const checked = o.value === current ? " checked" : "";
        const required = req && i === 0 ? req : "";
        return `<label><input type="radio" name="${esc(field.name)}" value="${esc(o.value)}"${checked}${required} />${esc(o.label)}</label>`;
      })
      .join("");
    return `<fieldset class="toggle"><legend>${esc(field.label)}</legend>${radios}</fieldset>`;
  }

  const type = field.kind === "number" ? "number" : "text";
  const req = field.required === false ? "" : " required";
  const val = current !== "" ? ` value="${esc(current)}"` : "";
  const ph = field.placeholder
    ? ` placeholder="${esc(field.placeholder)}"`
    : "";
  return `<label>${esc(field.label)}<input name="${esc(field.name)}" type="${type}"${req}${val}${ph} /></label>`;
}

function renderTable(
  resource: AdminResource,
  rows: unknown[],
  opts: {
    query: string;
    basePath: string;
    nextCursor?: string | null;
    listQuery?: AdminListQuery;
    searchParams: URLSearchParams;
    rowActions?: AdminAction[];
  },
): string {
  const parsed = rows
    .map((r) => parseRow(resource, r))
    .filter((row): row is Record<string, unknown> => row != null);

  const rowActions = opts.rowActions ?? [];
  const actionHeads = rowActions
    .map((a) => `<th>${esc(a.title)}</th>`)
    .join("");
  const head = resource.columns
    .map((c) => `<th>${esc(c.label)}</th>`)
    .join("") + actionHeads;
  const colCount = resource.columns.length + rowActions.length;

  const idKey = resource.idKey ?? "id";
  const canDetail = typeof resource.get === "function";
  const q = queryPrefix(opts.query);

  const body =
    parsed.length === 0
      ? `<tr><td colspan="${colCount}" class="dim">${esc(resource.emptyMessage ?? "Nothing yet.")}</td></tr>`
      : parsed
          .map((row) => {
            const cells = resource.columns
              .map((c) => {
                const cell = formatCell(row[c.key], c);
                if (
                  canDetail &&
                  c.key === idKey &&
                  row[idKey] != null &&
                  row[idKey] !== ""
                ) {
                  const href = `${opts.basePath}/${encodeURIComponent(resource.id)}/${encodeURIComponent(String(row[idKey]))}${q}`;
                  return `<td><a href="${esc(href)}">${cell}</a></td>`;
                }
                return `<td>${cell}</td>`;
              })
              .join("");
            const levers = rowActions
              .map((action) => {
                const actionUrl = `${opts.basePath}/action/${encodeURIComponent(action.id)}${q}`;
                const fields = action.fields
                  .map((f) => {
                    const fromRow = row[f.name];
                    const value =
                      fromRow != null && fromRow !== ""
                        ? (fromRow as string | number)
                        : f.name === idKey
                          ? (row[idKey] as string | number | undefined)
                          : f.defaultValue;
                    return renderActionField(f, value);
                  })
                  .join("");
                return `<td><form method="POST" action="${esc(actionUrl)}" class="row-action">${fields}<button type="submit">Set</button></form></td>`;
              })
              .join("");
            return `<tr class="row">${cells}${levers}</tr>`;
          })
          .join("");

  const filterForm = renderFilterForm(resource, opts);
  const pager = renderPager(resource, opts);

  return `<section class="block">
  <h2>${esc(resource.title)}</h2>
  ${resource.description ? `<p class="sub">${esc(resource.description)}</p>` : ""}
  ${filterForm}
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  ${pager}
</section>`;
}

function renderFilterForm(
  resource: AdminResource,
  opts: {
    basePath: string;
    listQuery?: AdminListQuery;
    searchParams: URLSearchParams;
  },
): string {
  const search = resource.search;
  const filters = resource.filters ?? [];
  if (!search && filters.length === 0) return "";

  const exclude = new Set<string>();
  const searchParam = search?.param ?? "q";
  if (search) exclude.add(searchParam);
  for (const f of filters) exclude.add(f.param);
  exclude.add(cursorParam(resource.id));

  const hidden = hiddenFields(opts.searchParams, exclude);
  const current = opts.listQuery;

  const searchField = search
    ? `<label>${esc(search.label ?? "Search")}<input name="${esc(searchParam)}" type="search" value="${esc(current?.search ?? "")}"${
        search.placeholder
          ? ` placeholder="${esc(search.placeholder)}"`
          : ""
      } /></label>`
    : "";

  const filterFields = filters
    .map((f) => {
      const value = current?.filters[f.param] ?? "";
      if (f.kind === "select") {
        const options = [
          `<option value="">Any</option>`,
          ...(f.options ?? []).map((o) => {
            const selected = o.value === value ? " selected" : "";
            return `<option value="${esc(o.value)}"${selected}>${esc(o.label)}</option>`;
          }),
        ].join("");
        return `<label>${esc(f.label)}<select name="${esc(f.param)}">${options}</select></label>`;
      }
      const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : "";
      return `<label>${esc(f.label)}<input name="${esc(f.param)}" type="text" value="${esc(value)}"${ph} /></label>`;
    })
    .join("");

  const action = opts.basePath || "/";
  return `<form method="GET" action="${esc(action)}" class="filters">${hidden}${searchField}${filterFields}
    <button type="submit">Filter</button>
  </form>`;
}

function renderPager(
  resource: AdminResource,
  opts: {
    basePath: string;
    nextCursor?: string | null;
    listQuery?: AdminListQuery;
    searchParams: URLSearchParams;
  },
): string {
  const cursorKey = cursorParam(resource.id);
  const hasCursor = Boolean(opts.listQuery?.cursor);
  const hasNext = Boolean(opts.nextCursor);
  if (!hasCursor && !hasNext) return "";

  const path = opts.basePath || "/";
  const firstHref = hrefWith(path, opts.searchParams, { [cursorKey]: null });
  const nextHref = hasNext
    ? hrefWith(path, opts.searchParams, {
        [cursorKey]: opts.nextCursor as string,
      })
    : "";

  const first = hasCursor
    ? `<a href="${esc(firstHref)}">First</a>`
    : `<span class="dim">First</span>`;
  const next = hasNext
    ? `<a href="${esc(nextHref)}">Next</a>`
    : `<span class="dim">Next</span>`;

  return `<div class="pager">${first}<span class="dim"> · </span>${next}</div>`;
}

function hiddenFields(
  params: URLSearchParams,
  exclude: Set<string>,
): string {
  const seen = new Set<string>();
  let html = "";
  for (const [k, v] of params.entries()) {
    if (exclude.has(k) || seen.has(k)) continue;
    seen.add(k);
    html += `<input type="hidden" name="${esc(k)}" value="${esc(v)}" />`;
  }
  return html;
}

function hrefWith(
  path: string,
  params: URLSearchParams,
  patch: Record<string, string | null>,
): string {
  const next = new URLSearchParams(params);
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "") next.delete(k);
    else next.set(k, v);
  }
  const q = next.toString();
  return q ? `${path}?${q}` : path;
}

function parseRow(
  resource: AdminResource,
  raw: unknown,
): Record<string, unknown> | null {
  const result = resource.row.safeParse(raw);
  if (
    result.success &&
    result.data !== null &&
    typeof result.data === "object"
  ) {
    return result.data as Record<string, unknown>;
  }
  return null;
}

export function formatCell(value: unknown, col: ColumnDef): string {
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
      const s = toDateString(value).replace("T", " ").slice(0, 19);
      return `<code>${esc(s)}</code>`;
    }
    case "muted":
      return `<span class="dim">${esc(String(value))}</span>`;
    case "badge":
      return `<span class="badge">${esc(String(value).toUpperCase())}</span>`;
    case "status": {
      const label = String(value);
      return `<span class="status ${statusTone(label)}">${esc(label)}</span>`;
    }
    case "currency":
      return `<span class="num">${esc(formatCurrency(value))}</span>`;
    case "bytes":
      return `<span class="num">${esc(formatBytes(value))}</span>`;
    default:
      return esc(String(value));
  }
}

export function statusTone(value: string): "ok" | "warn" | "bad" | "dim" {
  const v = value.trim().toLowerCase();
  if (
    [
      "ok",
      "success",
      "yes",
      "active",
      "granted",
      "observe",
      "pass",
      "passed",
      "healthy",
    ].includes(v)
  ) {
    return "ok";
  }
  if (["warn", "warning", "soft", "degraded"].includes(v)) return "warn";
  if (
    [
      "bad",
      "error",
      "fail",
      "failed",
      "blocked",
      "hard",
      "off",
      "frozen",
      "crit",
      "critical",
      "rejected",
      "unparseable",
      "upstream_error",
    ].includes(v)
  ) {
    return "bad";
  }
  return "dim";
}

function toDateString(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  const raw = String(value);
  if (/^\d{10,}$/.test(raw)) {
    const n = Number(raw);
    const ms = raw.length <= 10 ? n * 1000 : n;
    return new Date(ms).toISOString();
  }
  return raw;
}

function formatCurrency(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (n === 0) return "$0";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs < 0.01) return `${sign}$${abs.toFixed(5)}`;
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatBytes(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs < 1024) return `${sign}${abs} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = abs;
  let i = -1;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const whole =
    v >= 10 || Math.abs(v - Math.round(v)) < 1e-9
      ? String(Math.round(v))
      : v.toFixed(1);
  return `${sign}${whole} ${units[i]}`;
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

function renderNav(
  nav: AdminDefinition["nav"],
): string {
  if (!nav?.length) return "";
  return `<nav class="nav">${nav
    .map(
      (n) =>
        `<a class="${n.active ? "on" : ""}" href="${esc(n.href)}">${esc(n.label)}</a>`,
    )
    .join("")}</nav>`;
}

function renderFlash(error?: string, notice?: string): string {
  if (error) return `<p class="flash err">${esc(error)}</p>`;
  if (notice) return `<p class="flash ok">${esc(notice)}</p>`;
  return "";
}

function wrapPage(opts: {
  title: string;
  subtitle?: string;
  nav: string;
  flash: string;
  body: string;
}): string {
  const heading =
    opts.body.includes("<h1>")
      ? ""
      : `<h1>${esc(opts.title)}</h1>
${opts.subtitle ? `<div class="sub">${esc(opts.subtitle)}</div>` : ""}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(opts.title)}</title>
<style>${STYLE}</style>
</head>
<body>
${opts.nav}
${heading}
${opts.flash}
${opts.body}
</body>
</html>`;
}

function queryPrefix(query: string): string {
  if (!query) return "";
  return query.startsWith("?") ? query : `?${query}`;
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
  form.grant, form.filters { display:flex; flex-wrap:wrap; gap:10px; align-items:end; margin:8px 0 4px; }
  form.row-action { display:flex; flex-wrap:wrap; gap:8px; align-items:end; margin:0; }
  form.row-action button { padding:7px 10px; }
  label { display:grid; gap:4px; font-size:10px; text-transform:uppercase; letter-spacing:.04em; opacity:.55; }
  input, select { font:13px/1.4 ui-sans-serif,system-ui,sans-serif; padding:7px 9px;
          border:0; border-bottom:1px solid color-mix(in srgb, currentColor 22%, transparent);
          background:transparent; color:inherit; min-width:140px; border-radius:0; }
  select { appearance:none; }
  fieldset.toggle { border:0; padding:0; margin:0; display:flex; flex-wrap:wrap; gap:10px; align-items:end;
                    border-bottom:1px solid color-mix(in srgb, currentColor 22%, transparent); padding-bottom:4px; }
  fieldset.toggle legend { font-size:10px; text-transform:uppercase; letter-spacing:.04em; opacity:.55; padding:0; }
  fieldset.toggle label { display:flex; flex-direction:row; align-items:center; gap:6px; min-width:0; opacity:1; }
  fieldset.toggle input { min-width:0; padding:0; border:0; }
  button { font:12px/1 ui-sans-serif,system-ui,sans-serif; padding:9px 12px; border:0; cursor:pointer;
           background:color-mix(in srgb, currentColor 12%, transparent); color:inherit;
           text-transform:uppercase; letter-spacing:.04em; border-radius:0; }
  .flash { font-size:13px; margin:0 0 14px; }
  .flash.ok { opacity:.8; }
  .flash.err { color:#b3261e; }
  .badge { font:10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.06em; text-transform:uppercase; }
  .status { font:10px/1.4 ui-sans-serif,system-ui,sans-serif; letter-spacing:.04em; text-transform:uppercase; }
  .status.ok { color:#16794a; }
  .status.warn { color:#9a6700; }
  .status.bad { color:#b3261e; }
  .status.dim { opacity:.55; }
  .num { font-variant-numeric:tabular-nums; }
  .pager { margin:10px 0 0; font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
  .pager a { text-decoration:none; border-bottom:1px solid currentColor; }
  .back { font-size:12px; text-transform:uppercase; letter-spacing:.04em; margin:0 0 14px; }
  .back a { text-decoration:none; border-bottom:1px solid currentColor; }
  .fields { display:grid; gap:12px 24px; margin:18px 0; }
  .field span { display:block; font-size:10px; text-transform:uppercase; letter-spacing:.04em; opacity:.55; margin-bottom:4px; }
  pre { background:color-mix(in srgb, currentColor 7%, transparent); padding:14px;
        overflow:auto; max-height:60vh; font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;
        white-space:pre-wrap; word-break:break-word; margin:0 0 18px; }
  @media (prefers-color-scheme: dark) {
    .flash.err, .status.bad { color:#ff8a80; }
    .status.ok { color:#5fd3a0; }
    .status.warn { color:#e6b450; }
  }
`;
