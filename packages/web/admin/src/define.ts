import type { z } from "zod";
import type {
  AdminAction,
  AdminDefinition,
  AdminResource,
  ColumnDef,
} from "./types";

export function defineResource<T extends z.ZodTypeAny>(def: {
  id: string;
  title: string;
  description?: string;
  row: T;
  columns: ColumnDef[];
  list: (
    ctx: import("./types").AdminContext,
  ) => Promise<z.infer<T>[] | unknown[]>;
  emptyMessage?: string;
  limit?: number;
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
  return {
    id: def.id,
    title: def.title,
    description: def.description,
    row: def.row,
    columns: def.columns,
    list: async (ctx) => {
      const rows = await def.list(ctx);
      return Array.isArray(rows) ? rows : [];
    },
    emptyMessage: def.emptyMessage,
    limit: def.limit,
  };
}

export function defineAction<T extends z.ZodTypeAny>(def: {
  id: string;
  title: string;
  description?: string;
  input: T;
  fields: AdminAction["fields"];
  run: (
    input: z.infer<T>,
    ctx: import("./types").AdminContext,
  ) => Promise<unknown>;
  beside?: string;
}): AdminAction {
  if (!def.id?.trim()) throw new Error("defineAction: id required");
  if (!def.input) throw new Error("defineAction: input schema required");
  if (!def.fields?.length) throw new Error("defineAction: fields required");
  if (typeof def.run !== "function") {
    throw new Error("defineAction: run required");
  }
  return {
    id: def.id,
    title: def.title,
    description: def.description,
    input: def.input,
    fields: def.fields,
    beside: def.beside,
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
