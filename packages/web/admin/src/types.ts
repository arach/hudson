import { z } from "zod";

/** How a cell is displayed. Shell concern only — not domain. */
export type ColumnFormat =
  | "text"
  | "code"
  | "int"
  | "number"
  | "datetime"
  | "muted";

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

export type ActionFieldKind = "text" | "number" | "hidden";

export type ActionField = {
  name: string;
  label: string;
  kind: ActionFieldKind;
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
};

/**
 * Host-provided I/O. Admin never knows D1, HTTP, or CreditStore —
 * only load/run names the host registers.
 */
export type AdminContext = {
  /** Opaque host bag (accountId, db handle, etc.) */
  host: Record<string, unknown>;
  load: <T = unknown>(name: string) => Promise<T>;
  run: (name: string, input: unknown) => Promise<unknown>;
};

/** Erased resource shape used by the shell (no domain coupling). */
export type AdminResource = {
  id: string;
  title: string;
  description?: string;
  row: z.ZodTypeAny;
  columns: ColumnDef[];
  list: (ctx: AdminContext) => Promise<unknown[]>;
  emptyMessage?: string;
  limit?: number;
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
