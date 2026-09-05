import { z } from "zod";

/** How a cell is displayed. Shell concern only — not domain. */
export type ColumnFormat =
  | "text"
  | "code"
  | "int"
  | "number"
  | "datetime"
  | "muted"
  | "badge"
  | "status"
  | "currency"
  | "bytes";

export type ColumnDef = {
  key: string;
  label: string;
  format?: ColumnFormat;
};

export const StatCardSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  detail: z.string().optional(),
  /** 0–100 for optional meter bar */
  percent: z.number().min(0).max(100).optional(),
});

export type StatCard = z.infer<typeof StatCardSchema>;

export type ActionFieldKind = "text" | "number" | "hidden" | "select" | "toggle";

export type ActionFieldOption = {
  value: string;
  label: string;
};

export type ActionField = {
  name: string;
  label: string;
  kind: ActionFieldKind;
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
  /** Required for `select` and `toggle`. */
  options?: ActionFieldOption[];
};

/** Optional full-text search box on a resource list. */
export type SearchDef = {
  /** Query param name. Default `"q"`. */
  param?: string;
  label?: string;
  placeholder?: string;
};

export type FilterDef = {
  /** Query param name. Hosts with multiple resources should pick unique names. */
  param: string;
  label: string;
  kind: "text" | "select";
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
};

/** Extra detail-page treatment. Columns already declared are listed first. */
export type AdminDetail = {
  /** Row keys rendered as `<pre>` dumps (JSON for objects). */
  dumps?: string[];
};

export type AdminListQuery = {
  cursor?: string;
  limit: number;
  search?: string;
  filters: Record<string, string>;
};

export type AdminListPage = {
  rows: unknown[];
  nextCursor?: string | null;
  total?: number;
};

/**
 * Params the host loader may receive. Pagination, search, filters, and
 * a detail `id` all travel here so `load` is not a name-only bag.
 */
export type AdminLoadParams = {
  id?: string;
  cursor?: string;
  limit?: number;
  search?: string;
  filters?: Record<string, string>;
};

/**
 * Host-provided I/O. Admin never knows D1, HTTP, or CreditStore —
 * only load/run names the host registers.
 *
 * `load` returns `unknown`. Callers parse with the resource Zod schema.
 * A generic `Promise<T>` forced every host to write `as T`.
 */
export type AdminContext = {
  /** Opaque host bag (accountId, db handle, etc.) */
  host: Record<string, unknown>;
  load: (name: string, params?: AdminLoadParams) => Promise<unknown>;
  run: (name: string, input: unknown) => Promise<unknown>;
};

/** Erased resource shape used by the shell (no domain coupling). */
export type AdminResource = {
  id: string;
  title: string;
  description?: string;
  row: z.ZodTypeAny;
  columns: ColumnDef[];
  list: (
    ctx: AdminContext,
    query: AdminListQuery,
  ) => Promise<unknown[] | AdminListPage>;
  emptyMessage?: string;
  limit?: number;
  /** Row key used as the detail id. Default `"id"`. */
  idKey?: string;
  search?: SearchDef;
  filters?: FilterDef[];
  get?: (ctx: AdminContext, id: string) => Promise<unknown | null>;
  detail?: AdminDetail;
};

export type AdminAction = {
  id: string;
  title: string;
  description?: string;
  input: z.ZodTypeAny;
  fields: ActionField[];
  run: (input: unknown, ctx: AdminContext) => Promise<unknown>;
  /** Resource id this action sits under (for page placement). */
  beside?: string;
  /**
   * Render one compact form per list row of `beside`, using the row's
   * matching field names (and `idKey`) as values. Hidden from the page-level
   * action block.
   */
  perRow?: boolean;
};

export type AdminDefinition = {
  title: string;
  subtitle?: string;
  /** Nav links the host wants (path + label). Shell does not invent auth. */
  nav?: { href: string; label: string; active?: boolean }[];
  resources: AdminResource[];
  actions?: AdminAction[];
  /** Optional top-of-page stats. */
  stats?: (ctx: AdminContext) => Promise<StatCard[]>;
};

export type AdminHostHandlers = {
  /** Return false → 404 (or 401 if preferUnauthorized). */
  auth: (request: Request) => boolean | Promise<boolean>;
  preferUnauthorized?: boolean;
  context: (request: Request) => AdminContext | Promise<AdminContext>;
  /** Base path for this admin mount, e.g. "" or "/credits". */
  basePath?: string;
  /** Query string to preserve on forms (e.g. key=…). */
  preserveQuery?: (request: Request) => string;
};
