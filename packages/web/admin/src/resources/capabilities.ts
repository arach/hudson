/**
 * Capability-lever projections — Zod shapes + resource/action shells.
 *
 * The admin package does not own CAPABILITIES, capability_policy, or hold().
 * Hosts wire:
 *   load "capabilities.overview" → CapabilityRow[]
 *   load "capabilities.stats"    → StatCard[] (optional)
 *   run  "capabilities.setMode"  → { capability, mode }
 *   run  "capabilities.setPolicy" → { capability, mode, dailyCap?, monthlyCap?, rateOverride? }
 *
 * Missing policy rows mean observe. The host may return the default catalog
 * below until the store exists.
 */
import { z } from "zod";
import { defineAction, defineAdmin, defineResource } from "../define";
import { StatCardSchema, type AdminContext } from "../types";

export const CAPABILITY_MODES = ["off", "observe", "soft", "hard"] as const;
export type CapabilityMode = (typeof CAPABILITY_MODES)[number];

export const CAPABILITY_MODE_OPTIONS = CAPABILITY_MODES.map((mode) => ({
  value: mode,
  label: mode,
}));

/**
 * Declared catalog (LIN-025 axis). Spend-site source of truth is Linea's
 * `workers/api/src/credits/capabilities.ts` when it lands; this list is the
 * admin projection so the dashboard can render before that file exists.
 */
export const DEFAULT_CAPABILITIES = [
  { capability: "ask", kind: "llm" },
  { capability: "explain", kind: "llm" },
  { capability: "tts", kind: "tts" },
  { capability: "alignment", kind: "asr" },
  { capability: "prepare", kind: "llm" },
  { capability: "label", kind: "llm" },
  { capability: "figure", kind: "vision" },
  { capability: "refine", kind: "llm" },
] as const;

export const CapabilityRow = z.object({
  capability: z.string(),
  kind: z.string(),
  mode: z.string(),
  dailyCap: z.number().int().nullable().optional(),
  monthlyCap: z.number().int().nullable().optional(),
  rateOverride: z.number().int().nullable().optional(),
  credits7d: z.number().int().optional().default(0),
  spends7d: z.number().int().optional().default(0),
  free7d: z.number().int().optional().default(0),
  updatedBy: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

const emptyToUndef = (value: unknown) =>
  value === "" || value === undefined || value === null ? undefined : value;

export const SetModeInput = z.object({
  capability: z.string().min(1),
  mode: z.enum(CAPABILITY_MODES),
});

export const SetPolicyInput = z.object({
  capability: z.string().min(1),
  mode: z.enum(CAPABILITY_MODES),
  dailyCap: z.preprocess(
    emptyToUndef,
    z.coerce.number().int().nonnegative().optional(),
  ),
  monthlyCap: z.preprocess(
    emptyToUndef,
    z.coerce.number().int().nonnegative().optional(),
  ),
  rateOverride: z.preprocess(
    emptyToUndef,
    z.coerce.number().int().nonnegative().optional(),
  ),
});

export type CapabilityRow = z.infer<typeof CapabilityRow>;
export type SetModeInput = z.infer<typeof SetModeInput>;
export type SetPolicyInput = z.infer<typeof SetPolicyInput>;

export function defaultCapabilityRows(): CapabilityRow[] {
  return DEFAULT_CAPABILITIES.map((row) =>
    CapabilityRow.parse({
      ...row,
      mode: "observe",
      credits7d: 0,
      spends7d: 0,
      free7d: 0,
    }),
  );
}

export function capabilitiesResource() {
  return defineResource({
    id: "capabilities",
    title: "Capability levers",
    description:
      "Per-capability runtime control. Missing rows observe. off freezes spend with capability_frozen, not out-of-credits.",
    row: CapabilityRow,
    idKey: "capability",
    emptyMessage: "No capabilities declared.",
    columns: [
      { key: "capability", label: "Capability", format: "badge" },
      { key: "kind", label: "Kind", format: "muted" },
      { key: "credits7d", label: "Credits 7d", format: "int" },
      { key: "spends7d", label: "Spends 7d", format: "int" },
      { key: "free7d", label: "Free 7d", format: "int" },
      { key: "mode", label: "Mode", format: "status" },
      { key: "dailyCap", label: "Daily cap", format: "int" },
      { key: "rateOverride", label: "Rate", format: "int" },
    ],
    list: async (ctx: AdminContext, query) => {
      const rows = await ctx.load("capabilities.overview", {
        cursor: query.cursor,
        limit: query.limit,
        search: query.search,
        filters: query.filters,
      });
      return Array.isArray(rows) ? rows : [];
    },
  });
}

export function capabilitiesSetModeAction() {
  return defineAction({
    id: "capabilities.setMode",
    title: "Mode",
    description: "off · observe · soft · hard",
    beside: "capabilities",
    perRow: true,
    input: SetModeInput,
    fields: [
      { name: "capability", label: "Capability", kind: "hidden" },
      {
        name: "mode",
        label: "Mode",
        kind: "toggle",
        options: [...CAPABILITY_MODE_OPTIONS],
        required: true,
      },
    ],
    run: async (input, ctx) => {
      await ctx.run("capabilities.setMode", input);
    },
  });
}

export function capabilitiesSetPolicyAction() {
  return defineAction({
    id: "capabilities.setPolicy",
    title: "Set policy",
    description: "Mode, caps, and rate override for one capability.",
    beside: "capabilities",
    input: SetPolicyInput,
    fields: [
      {
        name: "capability",
        label: "Capability",
        kind: "select",
        options: DEFAULT_CAPABILITIES.map((c) => ({
          value: c.capability,
          label: c.capability,
        })),
        required: true,
      },
      {
        name: "mode",
        label: "Mode",
        kind: "toggle",
        options: [...CAPABILITY_MODE_OPTIONS],
        defaultValue: "observe",
        required: true,
      },
      {
        name: "dailyCap",
        label: "Daily cap",
        kind: "number",
        required: false,
        placeholder: "none",
      },
      {
        name: "monthlyCap",
        label: "Monthly cap",
        kind: "number",
        required: false,
        placeholder: "none",
      },
      {
        name: "rateOverride",
        label: "Rate override",
        kind: "number",
        required: false,
        placeholder: "default",
      },
    ],
    run: async (input, ctx) => {
      await ctx.run("capabilities.setPolicy", input);
    },
  });
}

export type CapabilitiesAdminOptions = {
  title?: string;
  subtitle?: string;
  nav?: { href: string; label: string; active?: boolean }[];
};

export function defineCapabilitiesAdmin(opts: CapabilitiesAdminOptions = {}) {
  return defineAdmin({
    title: opts.title ?? "Capability levers",
    subtitle:
      opts.subtitle ??
      "Runtime control over what Linea pays for. observe meters and never blocks.",
    nav: opts.nav,
    resources: [capabilitiesResource()],
    actions: [capabilitiesSetPolicyAction(), capabilitiesSetModeAction()],
    stats: async (ctx) => {
      const cards = await ctx.load("capabilities.stats");
      if (!Array.isArray(cards)) return [];
      return cards.flatMap((card) => {
        const parsed = StatCardSchema.safeParse(card);
        return parsed.success ? [parsed.data] : [];
      });
    },
  });
}
