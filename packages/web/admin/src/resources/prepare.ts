/**
 * Prepare-event projections — Zod shapes + resource shells.
 *
 * Hosts wire:
 *   load "prepare.events" → PrepareEventRow[] | AdminListPage
 *   load "prepare.event"  → PrepareEventRow | null  (params.id)
 *   load "prepare.stats"  → StatCard[]
 *
 * Admin never writes prepare_event. The recording half stays in the ask worker.
 */
import { z } from "zod";
import { defineAdmin, defineResource } from "../define";
import { StatCardSchema, type AdminContext } from "../types";

export const PREPARE_STATUSES = [
  "ok",
  "rejected",
  "upstream_error",
  "unparseable",
] as const;

export const PREPARE_STAGES = ["prepare", "label", "figure", "ask"] as const;

export const PrepareEventRow = z.object({
  id: z.string(),
  at: z.union([z.string(), z.number()]),
  status: z.string(),
  stage: z.string().optional().nullable(),
  model: z.string(),
  blockCount: z.number().nullable().optional(),
  promptTokens: z.number().nullable().optional(),
  completionTokens: z.number().nullable().optional(),
  reasoningTokens: z.number().nullable().optional(),
  tokens: z.string().optional().nullable(),
  costUsd: z.number().nullable().optional(),
  durationMs: z.number().nullable().optional(),
  cacheHit: z.boolean().optional(),
  detail: z.string().nullable().optional(),
  fingerprint: z.string().optional().nullable(),
  inputChars: z.number().nullable().optional(),
  sentText: z.string().nullable().optional(),
  systemPrompt: z.string().nullable().optional(),
  blocks: z.unknown().optional().nullable(),
  rawRequest: z.string().nullable().optional(),
  rawResponse: z.string().nullable().optional(),
  failDetail: z.string().nullable().optional(),
});

export type PrepareEventRow = z.infer<typeof PrepareEventRow>;

export function prepareEventsResource() {
  return defineResource({
    id: "events",
    title: "Preparation attempts",
    description:
      "Most recent attempts. Click an id for the captured exchange. Reasoning tokens on extraction are waste.",
    row: PrepareEventRow,
    idKey: "id",
    limit: 100,
    emptyMessage: "Nothing recorded yet.",
    search: { param: "q", label: "Search", placeholder: "id, model, page, detail" },
    filters: [
      {
        param: "status",
        label: "Status",
        kind: "select",
        options: PREPARE_STATUSES.map((status) => ({
          value: status,
          label: status,
        })),
      },
      {
        param: "stage",
        label: "Stage",
        kind: "select",
        options: PREPARE_STAGES.map((stage) => ({
          value: stage,
          label: stage,
        })),
      },
    ],
    columns: [
      { key: "id", label: "Id", format: "code" },
      { key: "at", label: "When", format: "datetime" },
      { key: "status", label: "Status", format: "status" },
      { key: "stage", label: "Stage", format: "badge" },
      { key: "model", label: "Model", format: "code" },
      { key: "blockCount", label: "Blocks", format: "int" },
      { key: "tokens", label: "Tokens", format: "muted" },
      { key: "costUsd", label: "Cost", format: "currency" },
      { key: "durationMs", label: "Time", format: "int" },
      { key: "detail", label: "Detail", format: "muted" },
    ],
    detail: {
      dumps: [
        "failDetail",
        "sentText",
        "blocks",
        "systemPrompt",
        "rawRequest",
        "rawResponse",
      ],
    },
    list: async (ctx: AdminContext, query) => {
      const rows = await ctx.load("prepare.events", {
        cursor: query.cursor,
        limit: query.limit,
        search: query.search,
        filters: query.filters,
      });
      if (
        rows != null &&
        typeof rows === "object" &&
        !Array.isArray(rows) &&
        "rows" in rows
      ) {
        return rows as { rows: unknown[]; nextCursor?: string | null };
      }
      return Array.isArray(rows) ? rows : [];
    },
    get: async (ctx, id) => {
      const row = await ctx.load("prepare.event", { id });
      if (row == null) return null;
      if (Array.isArray(row)) return row[0] ?? null;
      return row;
    },
  });
}

export type PrepareAdminOptions = {
  title?: string;
  subtitle?: string;
  nav?: { href: string; label: string; active?: boolean }[];
};

export function definePrepareAdmin(opts: PrepareAdminOptions = {}) {
  return defineAdmin({
    title: opts.title ?? "Page preparation",
    subtitle:
      opts.subtitle ??
      "Most recent attempts — click an id for the full exchange.",
    nav: opts.nav,
    resources: [prepareEventsResource()],
    stats: async (ctx) => {
      const cards = await ctx.load("prepare.stats");
      if (!Array.isArray(cards)) return [];
      return cards.flatMap((card) => {
        const parsed = StatCardSchema.safeParse(card);
        return parsed.success ? [parsed.data] : [];
      });
    },
  });
}
