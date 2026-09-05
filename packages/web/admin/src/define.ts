import type { z } from "zod";
import type {
  AdminAction,
  AdminContext,
  AdminDefinition,
  AdminDetail,
  AdminListPage,
  AdminListQuery,
  AdminResource,
  ColumnDef,
  FilterDef,
  SearchDef,
} from "./types";

function isListPage(value: unknown): value is AdminListPage {
  return (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "rows" in value
  );
}

export function defineResource<T extends z.ZodTypeAny>(def: {
  id: string;
  title: string;
  description?: string;
  row: T;
  columns: ColumnDef[];
  list: (
    ctx: AdminContext,
    query: AdminListQuery,
  ) => Promise<z.infer<T>[] | unknown[] | AdminListPage>;
  emptyMessage?: string;
  limit?: number;
  idKey?: string;
  search?: SearchDef;
  filters?: FilterDef[];
  get?: (ctx: AdminContext, id: string) => Promise<unknown | null>;
  detail?: AdminDetail;
}): AdminResource {
  if (!def.id?.trim()) throw new Error("defineResource: id required");
  if (!def.title?.trim()) throw new Error("defineResource: title required");
  if (!def.row) throw new Error("defineResource: row schema required");
  if (!def.columns?.length) {
    throw new Error("defineResource: at least one column required");
  }
  if (typeof def.list !== "function") {
    throw new Error("defineResource: list loader required");
  }
  if (def.idKey != null && !def.idKey.trim()) {
    throw new Error("defineResource: idKey must be non-empty");
  }
  if (def.filters) {
    for (const filter of def.filters) {
      if (!filter.param?.trim()) {
        throw new Error("defineResource: filter param required");
      }
      if (filter.kind === "select" && !filter.options?.length) {
        throw new Error(
          `defineResource: filter ${filter.param} select needs options`,
        );
      }
    }
  }

  return {
    id: def.id,
    title: def.title,
    description: def.description,
    row: def.row,
    columns: def.columns,
    list: async (ctx, query) => {
      const result = await def.list(ctx, query);
      if (isListPage(result)) {
        return {
          rows: Array.isArray(result.rows) ? result.rows : [],
          nextCursor: result.nextCursor ?? null,
          total: result.total,
        };
      }
      return Array.isArray(result) ? result : [];
    },
    emptyMessage: def.emptyMessage,
    limit: def.limit,
    idKey: def.idKey,
    search: def.search,
    filters: def.filters,
    get: def.get
      ? async (ctx, id) => def.get!(ctx, id)
      : undefined,
    detail: def.detail,
  };
}

export function defineAction<T extends z.ZodTypeAny>(def: {
  id: string;
  title: string;
  description?: string;
  input: T;
  fields: AdminAction["fields"];
  run: (input: z.infer<T>, ctx: AdminContext) => Promise<unknown>;
  beside?: string;
  perRow?: boolean;
}): AdminAction {
  if (!def.id?.trim()) throw new Error("defineAction: id required");
  if (!def.input) throw new Error("defineAction: input schema required");
  if (!def.fields?.length) throw new Error("defineAction: fields required");
  if (typeof def.run !== "function") {
    throw new Error("defineAction: run required");
  }
  for (const field of def.fields) {
    if (
      (field.kind === "select" || field.kind === "toggle") &&
      !field.options?.length
    ) {
      throw new Error(
        `defineAction: field ${field.name} ${field.kind} needs options`,
      );
    }
  }
  return {
    id: def.id,
    title: def.title,
    description: def.description,
    input: def.input,
    fields: def.fields,
    beside: def.beside,
    perRow: def.perRow,
    run: async (input, ctx) => {
      const parsed = def.input.parse(input);
      return def.run(parsed, ctx);
    },
  };
}

export function defineAdmin(def: AdminDefinition): AdminDefinition {
  if (!def.title?.trim()) throw new Error("defineAdmin: title required");
  if (!def.resources?.length) {
    throw new Error("defineAdmin: at least one resource required");
  }
  return def;
}

export function columnsFromKeys(
  keys: Array<{ key: string; label: string; format?: ColumnDef["format"] }>,
): ColumnDef[] {
  return keys;
}
