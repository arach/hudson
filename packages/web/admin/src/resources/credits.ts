/**
 * Credits admin *projections* — Zod shapes + resource/action shells.
 *
 * The admin package does not talk to CreditStore or D1.
 * Hosts wire `load` / `run` names:
 *   load "credits.stats"   → StatCard[]
 *   load "credits.wallets" → WalletRow[]
 *   load "credits.entries" → EntryRow[]
 *   run  "credits.grant"   → { userId, credits, reason? }
 */
import { z } from "zod";
import { defineAction, defineAdmin, defineResource } from "../define";
import type { AdminContext, StatCard } from "../types";

export const WalletRow = z.object({
  userId: z.string(),
  available: z.number().int(),
  held: z.number().int(),
  periodSpent: z.number().int(),
  lifetimeSpent: z.number().int(),
});

export const EntryRow = z.object({
  at: z.string(),
  userId: z.string(),
  op: z.string(),
  kind: z.string(),
  credits: z.number().int(),
  surface: z.string().optional().nullable(),
  provider: z.string().optional().nullable(),
  gauge: z.string().optional().nullable(),
  freeReason: z.string().optional().nullable(),
});

export const GrantInput = z.object({
  userId: z.string().min(1),
  credits: z.coerce.number().int().positive(),
  reason: z.string().optional(),
});

export type WalletRow = z.infer<typeof WalletRow>;
export type EntryRow = z.infer<typeof EntryRow>;
export type GrantInput = z.infer<typeof GrantInput>;

export function creditsWalletsResource() {
  return defineResource({
    id: "credits.wallets",
    title: "Top wallets (period spend)",
    description: "User balances for the configured account",
    row: WalletRow,
    limit: 40,
    columns: [
      { key: "userId", label: "User", format: "code" },
      { key: "periodSpent", label: "Period", format: "int" },
      { key: "available", label: "Available", format: "int" },
      { key: "held", label: "Held", format: "int" },
      { key: "lifetimeSpent", label: "Lifetime", format: "int" },
    ],
    list: async (ctx: AdminContext) => {
      const rows = await ctx.load<WalletRow[]>("credits.wallets");
      return Array.isArray(rows) ? rows : [];
    },
  });
}

export function creditsEntriesResource() {
  return defineResource({
    id: "credits.entries",
    title: "Recent ledger",
    row: EntryRow,
    limit: 60,
    columns: [
      { key: "at", label: "When", format: "datetime" },
      { key: "userId", label: "User", format: "code" },
      { key: "op", label: "Op", format: "text" },
      { key: "kind", label: "Kind", format: "muted" },
      { key: "credits", label: "Credits", format: "int" },
      { key: "surface", label: "Surface", format: "muted" },
      { key: "gauge", label: "Gauge", format: "muted" },
    ],
    list: async (ctx: AdminContext) => {
      const rows = await ctx.load<unknown>("credits.entries");
      // Flatten op/kind display: keep separate columns; freeReason folds into op via host if desired
      return (Array.isArray(rows) ? rows : []).flatMap((row) => {
        const parsed = EntryRow.safeParse(row);
        if (!parsed.success) return [];
        return [
          {
            ...parsed.data,
            surface: parsed.data.surface ?? parsed.data.provider ?? "—",
            freeReason: parsed.data.freeReason ?? null,
          },
        ];
      });
    },
  });
}

export function creditsGrantAction() {
  return defineAction({
    id: "credits.grant",
    title: "Grant credits",
    description: "Tops up a user wallet. Host implements the ledger write.",
    input: GrantInput,
    fields: [
      {
        name: "userId",
        label: "User id",
        kind: "text",
        placeholder: "email:… or anonymous:…",
        required: true,
      },
      {
        name: "credits",
        label: "Credits",
        kind: "number",
        defaultValue: 500_000,
        required: true,
      },
      {
        name: "reason",
        label: "Reason",
        kind: "text",
        defaultValue: "admin_grant",
      },
    ],
    run: async (input, ctx) => {
      await ctx.run("credits.grant", input);
    },
  });
}

export type CreditsAdminOptions = {
  title?: string;
  subtitle?: string;
  accountId?: string;
  nav?: { href: string; label: string; active?: boolean }[];
};

/**
 * Ready-made admin definition for inference credits.
 * Host must implement load/run names listed above.
 */
export function defineCreditsAdmin(opts: CreditsAdminOptions = {}) {
  const account = opts.accountId ?? "default";
  return defineAdmin({
    title: opts.title ?? "Inference credits",
    subtitle:
      opts.subtitle ??
      `Account ${account} · admin is schema-driven; ledger is host-owned`,
    nav: opts.nav,
    resources: [creditsWalletsResource(), creditsEntriesResource()],
    actions: [creditsGrantAction()],
    stats: async (ctx) => {
      const cards = await ctx.load<StatCard[]>("credits.stats");
      return Array.isArray(cards) ? cards : [];
    },
  });
}
