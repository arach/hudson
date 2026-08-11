---
title: "Admin resources"
description: "Schema-driven operator admin — hosts mount declared resources, not product-specific UIs"
order: 41
section: "Architecture"
---

# Admin resources

Hudson **admin** is a generic operator module. It is **not** coupled to inference credits, prepare, auth, or any other domain.

Domains that want an operator surface **declare** resources (Zod row shape + columns + stats + actions + a data loader). The admin shell only knows how to:

1. List resources for a host
2. Validate rows / action inputs against schemas
3. Render tables, stat cards, and action forms
4. Run loaders / actions the host injects

Credits is the first domain adapter. Admin does not import ledger semantics.

## Separation of concerns

| Layer | Owns | Coupling |
|-------|------|----------|
| **Domain** (e.g. inference credits) | Protocol, ledger, rate card, stores | Tight, shared across apps |
| **Admin resource declaration** | Zod row schema, columns, actions as *projections* | Domain exports optional admin shapes |
| **Admin shell** (`@hudsonkit/admin`) | Render + validate + route | **None** to domain internals |
| **Host** (e.g. `admin.uselinea.com`) | Auth, DB/bindings, which resources to mount | Config only |

Inference stays smart. Admin stays interchangeable.

## Declare a resource

```ts
import { z } from "zod";
import { defineResource, defineAdmin } from "@hudsonkit/admin";

const WalletRow = z.object({
  userId: z.string(),
  available: z.number().int(),
  held: z.number().int(),
  periodSpent: z.number().int(),
  lifetimeSpent: z.number().int(),
});

const wallets = defineResource({
  id: "credits.wallets",
  title: "Wallets",
  description: "User credit balances for this account",
  row: WalletRow,
  columns: [
    { key: "userId", label: "User", format: "code" },
    { key: "periodSpent", label: "Period", format: "int" },
    { key: "available", label: "Available", format: "int" },
    { key: "held", label: "Held", format: "int" },
    { key: "lifetimeSpent", label: "Lifetime", format: "int" },
  ],
  // Host injects how to load — admin never knows D1 vs HTTP vs memory.
  list: async (ctx) => ctx.load("credits.wallets"),
});
```

### Actions

```ts
const grant = defineAction({
  id: "credits.grant",
  title: "Grant credits",
  input: z.object({
    userId: z.string().min(1),
    credits: z.number().int().positive(),
    reason: z.string().optional(),
  }),
  fields: [
    { name: "userId", label: "User id", kind: "text" },
    { name: "credits", label: "Credits", kind: "number", defaultValue: 500_000 },
    { name: "reason", label: "Reason", kind: "text", defaultValue: "admin_grant" },
  ],
  run: async (input, ctx) => ctx.run("credits.grant", input),
});
```

### Host config

```ts
const admin = defineAdmin({
  title: "Linea",
  resources: [wallets, entries],
  actions: [grant],
  stats: async (ctx) => ctx.load("credits.stats"), // optional top cards
});

// Worker:
return handleAdminRequest(request, admin, {
  auth: (req) => checkAdminToken(req),
  context: () => ({
    host: {},
    load: async (name) => { /* D1 queries */ },
    run: async (name, input) => { /* grant */ },
  }),
});
```

## Package

Canonical implementation: [`packages/web/admin`](../packages/web/admin) → npm name **`@hudsonkit/admin`**.

| Export | Purpose |
|--------|---------|
| `defineResource` / `defineAction` / `defineAdmin` | Declaration helpers |
| `renderAdminHtml` | Zero-React HTML page for Workers / edge |
| `handleAdminRequest` | GET list + POST action routing |
| `defineCreditsAdmin` | Optional adapter: Zod shapes for wallets/entries/grant (loaders still host-owned) |

## What admin must not do

- Import `CreditStore`, rate cards, or hold/commit semantics
- Hard-code SQL table names inside the shell
- Own product auth (host passes `auth`)
- Require React — first renderer is HTML so CF Workers and simple hosts work

React/`HudTable` binding is a later surface over the same declarations.

## v1 scope (shipped)

1. Zod-declared resources + actions
2. HTML renderer (flat hierarchy, no product chrome)
3. Host context: `load` / `run` / `auth`
4. Credits adapter declarations (shapes only)
5. Linea host: `admin.uselinea.com` mounts credits via loaders on `CREDITS_DB`

## Later

- React panel over the same `defineResource` output
- Prepare / flags / auth as additional resource packs
- Multi-account switcher as host chrome, not shell core
