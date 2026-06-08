# HudsonKit Feature Flags v1

Status: prototype implemented on branch `feat/hud-markdown-renderer`; API stable enough for first OpenScout integration, pending consumer feedback.

Date: 2026-06-08

Request: OpenScout wants to replace its one-off `isOpsEnabled()` gate with a HudsonKit primitive that can hide top-level navigation, sub-routes/screens, and controls inside a page while resolving consistently in SSR and on the client.

## Research notes

- **OpenFeature** separates the application API (`useFlag` / evaluation calls) from the evaluator/provider, and models request/user data as an *evaluation context*. That maps well to Hudson owning the mechanism and each app/host supplying policy: registry, active audience, and config layers. See OpenFeature concepts for providers and evaluation context: <https://openfeature.dev/docs/reference/concepts/provider>, <https://openfeature.dev/docs/reference/concepts/evaluation-context>.
- **LaunchDarkly** and **PostHog** both document bootstrapping as the way to avoid client startup gaps/flicker: compute or provide initial flag values before the browser SDK finishes initializing. Hudson should do the same by making the server/host pass an initial snapshot into a Provider instead of letting components read `window` ad hoc. See LaunchDarkly bootstrapping and PostHog bootstrapping: <https://launchdarkly.com/docs/sdk/features/bootstrapping>, <https://posthog.com/docs/feature-flags/bootstrapping>.
- **Unleash** models enablement as strategies evaluated against context, with context including user/app/request facts. v1 should not adopt strategies/rollouts, but should keep a narrow context/audience slot so adding a remote/provider layer later does not rewrite consumers. See Unleash feature flags and context: <https://docs.getunleash.io/concepts/feature-flags>, <https://docs.getunleash.io/concepts/unleash-context>.

Conclusion: v1 should be a tiny local evaluator with OpenFeature-like concepts: typed registry, evaluation context/audience, provider snapshot, explainable layers. It should *not* be a vendor SDK or experimentation platform.

## Goals

1. One registry and one read API for three granularities:
   - nav/workspace entry gate,
   - page/sub-route gate,
   - intra-page control/section gate.
2. SSR-safe `isEnabled(key)` and React `useFlag(key)` with deterministic server/client hydration.
3. Layered resolution, highest winner first:
   1. local override (persisted dev/user override),
   2. URL override,
   3. shared config,
   4. build/env,
   5. registry default plus audience eligibility.
4. Audience/tier resolution where the host defines audience names/order (`everyone`, `internal`, `power` for OpenScout).
5. Shell integration for nav/workspace app configs and command palette entries.
6. Dev panel reachable from Cmd+K to inspect every flag, winner layer, and set local flag/audience overrides.

## Non-goals for v1

- Remote push/polling config service.
- A/B experiments, metrics/exposure events, percentage rollout, variants.
- Per-user backend targeting.
- Non-developer admin UI.

A future remote service can become another layer/provider without changing consumers.

## Package placement

Ship this in **HudsonKit core exports**, implemented as a small module namespace:

```ts
import {
  FeatureFlagsProvider,
  createFlagRegistry,
  createFlagResolver,
  isFlagEnabled,
  useFlag,
  useFlagResolution,
  type FeatureFlagKey,
  type FeatureFlagGate,
} from "hudsonkit/flags";
```

Also re-export the public types from `hudsonkit` for convenience. Keeping implementation under `hudsonkit/flags` avoids bloating import sites, but the shell needs to understand `flag:` on core types, so ownership belongs in HudsonKit rather than a Scout utility.

## Registry API

```ts
export type FeatureFlagLayer = "local" | "url" | "sharedConfig" | "env" | "default";

export interface FeatureFlagDefinition<TAudience extends string = string> {
  label: string;
  description?: string;
  defaultEnabled: boolean;
  /** Minimum/required audience. Undefined means no audience gate beyond defaultEnabled. */
  tier?: TAudience;
  owner?: string;
  tags?: string[];
  expiresAt?: string;
}

export type FeatureFlagRegistry<TAudience extends string = string> =
  Record<string, FeatureFlagDefinition<TAudience>>;

export function createFlagRegistry<const R extends FeatureFlagRegistry>(registry: R): R;

export type FeatureFlagKey<R extends FeatureFlagRegistry> = Extract<keyof R, string>;
```

OpenScout example:

```ts
export const scoutFlags = createFlagRegistry({
  "surface.search": { label: "Search", defaultEnabled: false, tier: "everyone" },
  "surface.sessions": { label: "Sessions", defaultEnabled: false, tier: "everyone" },
  "surface.briefings": { label: "Briefings", defaultEnabled: false, tier: "everyone" },
  "surface.work": { label: "Work", defaultEnabled: false, tier: "everyone" },
  "surface.activity": { label: "Activity", defaultEnabled: false, tier: "everyone" },
  "surface.follow": { label: "Follow", defaultEnabled: false, tier: "everyone" },
  "ops.control": { label: "Ops Control", defaultEnabled: true, tier: "power" },
  "ops.mesh": { label: "Mesh", defaultEnabled: true, tier: "power" },
  "ops.runtime": { label: "Runtime", defaultEnabled: true, tier: "power" },
  "ops.plans": { label: "Plans", defaultEnabled: true, tier: "power" },
  "ops.terminal": { label: "Terminal", defaultEnabled: true, tier: "power" },
} as const);
```

Notes:

- `defaultEnabled` answers “is this flag on for an eligible audience?”
- `tier` answers “who is eligible by default/config?”
- Explicit overrides can force either value regardless of tier. This is necessary for dev local overrides and one-off URL/shared-config rescue switches.

## Audience model

HudsonKit should not bake in OpenScout roles. The Provider gets a host-defined hierarchy or predicate:

```ts
export interface FeatureFlagAudience<TAudience extends string = string> {
  tier: TAudience;
  traits?: Record<string, string | number | boolean | null | undefined>;
}

export type AudienceOrder<TAudience extends string> = readonly TAudience[];
export type AudienceIncludes<TAudience extends string> =
  (active: FeatureFlagAudience<TAudience>, required: TAudience) => boolean;
```

Default `audienceIncludes` uses `audienceOrder` when supplied. For OpenScout:

```ts
const audienceOrder = ["everyone", "internal", "power"] as const;
```

`power` includes `internal` and `everyone`; `internal` includes `everyone`; `everyone` includes only itself.

## Resolver API

```ts
export type FeatureFlagOverride = boolean | "on" | "off" | "default" | null | undefined;

export interface FeatureFlagLayerInput<TAudience extends string = string> {
  flags?: Record<string, FeatureFlagOverride>;
  audience?: TAudience;
}

export interface FeatureFlagResolverInput<R extends FeatureFlagRegistry, TAudience extends string = string> {
  registry: R;
  audience: FeatureFlagAudience<TAudience>;
  audienceOrder?: readonly TAudience[];
  audienceIncludes?: AudienceIncludes<TAudience>;
  layers?: {
    env?: FeatureFlagLayerInput<TAudience>;
    sharedConfig?: FeatureFlagLayerInput<TAudience>;
    url?: FeatureFlagLayerInput<TAudience>;
    local?: FeatureFlagLayerInput<TAudience>;
  };
}

export interface FeatureFlagResolution<TAudience extends string = string> {
  key: string;
  enabled: boolean;
  layer: FeatureFlagLayer;
  value: boolean;
  audience: FeatureFlagAudience<TAudience>;
  requiredTier?: TAudience;
  reason: "override" | "default" | "audience-denied" | "unknown-flag";
}

export interface FeatureFlagResolver<R extends FeatureFlagRegistry = FeatureFlagRegistry> {
  isEnabled<K extends FeatureFlagKey<R>>(key: K): boolean;
  explain<K extends FeatureFlagKey<R>>(key: K): FeatureFlagResolution;
  all(): FeatureFlagResolution[];
  audience(): FeatureFlagAudience;
}

export function createFlagResolver<R extends FeatureFlagRegistry>(
  input: FeatureFlagResolverInput<R>,
): FeatureFlagResolver<R>;

export function isFlagEnabled<R extends FeatureFlagRegistry>(
  resolver: FeatureFlagResolver<R>,
  key: FeatureFlagKey<R>,
): boolean;
```

Resolution algorithm:

1. Compose active audience from base host audience, then audience overrides by layer precedence (`local` > `url` > `sharedConfig` > `env`).
2. For a flag key, find the first layer in precedence order with an explicit `true`/`false` override. Return it and record that layer.
3. If no override wins, compute registry default:
   - unknown flag => disabled, `reason: "unknown-flag"` in dev;
   - if `defaultEnabled` is false => disabled;
   - if `tier` is set and active audience does not include it => disabled with `reason: "audience-denied"`;
   - otherwise enabled.

## Provider / SSR hydration contract

```tsx
<FeatureFlagsProvider
  registry={scoutFlags}
  audience={{ tier: initialAudience }}
  audienceOrder={["everyone", "internal", "power"]}
  initialLayers={{ env, sharedConfig, url, local }}
  storageKey="openscout.flags"
>
  <WorkspaceShell ... />
</FeatureFlagsProvider>
```

`FeatureFlagsProvider` owns React context and exposes:

```ts
export function useFlag<K extends string>(key: K): boolean;
export function useFlagResolution<K extends string>(key: K): FeatureFlagResolution;
export function useFeatureFlags(): FeatureFlagResolver & {
  setLocalOverride(key: string, value: boolean | null): void;
  setLocalAudienceOverride(tier: string | null): void;
};
```

SSR rule: **the server/host must pass the exact layer inputs used for the first render**. Components never parse `window.location` directly.

Recommended v1 hydration:

- Server/host reads build env and shared config, parses request URL into the URL layer, and reads local overrides from a cookie.
- Provider serializes the same snapshot into the page.
- Client uses that snapshot for first render, then keeps local overrides in both localStorage and a cookie so the next server render sees the same values.

This is the only way to satisfy “local override highest” *and* “SSR/client resolve identically.” If an embed/static host cannot read cookies on the server, it can still use the Provider client-side, but local overrides should be considered post-hydration-only and not SSR-identical.

Suggested persisted local shape:

```json
{
  "version": 1,
  "audience": "power",
  "flags": {
    "ops.mesh": true,
    "surface.search": false
  }
}
```

## Layer parsers

HudsonKit should provide parsers, not own host-specific file IO.

```ts
parseFeatureFlagEnv(env: Record<string, string | undefined>, prefix?: string)
parseFeatureFlagUrl(url: string | URL, options?: { paramPrefix?: string })
normalizeFeatureFlagLayer(input: unknown)
```

Suggested URL syntax:

- `?ff.ops.mesh=1`
- `?ff.surface.search=0`
- `?ffAudience=power`

Suggested env syntax:

- `HUDSON_FLAG_ops_mesh=1`
- `HUDSON_FLAGS=ops.mesh:on,surface.search:off`
- `HUDSON_FLAG_AUDIENCE=power`

Suggested shared config slot for OpenScout’s `~/.openscout/config.json`:

```json
{
  "featureFlags": {
    "audience": "internal",
    "flags": {
      "surface.search": true,
      "ops.mesh": false
    }
  }
}
```

OpenScout already owns a local config loader at `packages/runtime/src/local-config.ts` for `~/.openscout/config.json`; HudsonKit should align to that shape by accepting the parsed `featureFlags` object, not by reading that path itself.

## Gate type for shell integration

```ts
export type FeatureFlagGate<R extends FeatureFlagRegistry = FeatureFlagRegistry> =
  | FeatureFlagKey<R>
  | {
      key: FeatureFlagKey<R>;
      /** Optional extra predicate for app-local conditions after the flag passes. */
      when?: (resolver: FeatureFlagResolver<R>) => boolean;
      /** Useful for labels/tooltips in dev panels. */
      reason?: string;
    };
```

Core type additions:

```ts
interface HudsonApp {
  flag?: FeatureFlagGate;
}

interface WorkspaceAppConfig {
  flag?: FeatureFlagGate;
}

interface CommandOption {
  flag?: FeatureFlagGate;
}
```

Also expose helpers:

```ts
filterFlaggedItems(items, resolver)
isGateEnabled(gate, resolver)
```

## Three call sites

### 1. Nav / workspace entry

```ts
const workspace: HudsonWorkspace = {
  id: "openscout",
  name: "OpenScout",
  apps: [
    { app: agentsApp },
    { app: searchApp, flag: "surface.search" },
    { app: opsApp, flag: "ops.control" },
  ],
};
```

Shell behavior: filter `workspace.apps` before launcher/sidebar/app switcher/default focus/activation. Keep the full workspace available to the dev flag panel and workspace editor with disabled/off annotations.

For OpenScout’s custom top nav, `TopNavItem` can carry the same `flag?: FeatureFlagGate` and call `filterFlaggedItems(TOP_NAV_ITEMS, resolver)` until/if that top nav becomes a first-class HudsonKit nav primitive.

### 2. Page / route

```tsx
function PlansRoute() {
  const plansEnabled = useFlag("ops.plans");
  if (!plansEnabled) return <NotFoundOrLocked feature="Plans" />;
  return <PlansScreen />;
}
```

The router may use `isEnabled("ops.plans")` from a resolver snapshot to redirect before rendering.

### 3. Intra-page control

```tsx
function MeshPanel() {
  const showTakeover = useFlag("ops.terminal");
  return showTakeover ? <TakeoverButton /> : null;
}
```

## Command palette integration

App commands can declare flags instead of filtering arrays manually:

```ts
const commands: CommandOption[] = [
  { id: "open:mesh", label: "Open Mesh", flag: "ops.mesh", action: () => route({ view: "mesh" }) },
];
```

`WorkspaceShell` should filter `shellCommands`, service commands, and app commands once before passing them to `CommandPalette` and `useIntentExecutor`. Intent execution should use the filtered command list so voice/AI cannot invoke hidden commands by ID.

## Dev flag panel

Add a shell command:

```ts
{
  id: "shell:feature-flags",
  label: "Feature Flags",
  action: () => setFeatureFlagPanelOpen(true),
}
```

Panel contents:

- current audience and winning audience layer;
- table of every registry entry: key, label, default, tier, resolved value, winning layer, reason;
- local override control: default/on/off;
- local audience override control: default or one of host-provided audience tiers;
- copy/debug JSON snapshot.

This panel is developer-facing and should be present when a registry exists. It does not need non-dev auth/permissions in v1.

## Implementation sketch

1. Add `packages/web/hudsonkit/src/flags/`:
   - `registry.ts`, `resolver.ts`, `provider.tsx`, `parsers.ts`, `storage.ts`.
2. Export from `packages/web/hudsonkit/src/index.ts` and add subpath export if package exports are explicit.
3. Add optional `flag?: FeatureFlagGate` to `CommandOption`, `HudsonApp`, and `WorkspaceAppConfig`.
4. In `WorkspaceShell`, accept optional `featureFlags`/Provider or require the host to wrap the shell. Prefer host wrapping for OpenScout; internal Hudson shell can no-op when no provider exists.
5. Filter commands and workspace app lists via `isGateEnabled`. Preserve `fullWorkspace` for editor/dev panel visibility.
6. Add `FeatureFlagPanel` with a shell command when registry exists.
7. Add tests for resolver precedence and audience eligibility.

## Answers to OpenScout’s explicit questions

### (a) Core or sibling utility module?

Core HudsonKit, but namespaced as `hudsonkit/flags`. The shell types and command palette need to know about `flag:`, so keeping it outside HudsonKit would immediately create duplicated filtering logic.

### (b) Existing `~/.openscout/config.json` reader?

HudsonKit does not own one. OpenScout has `packages/runtime/src/local-config.ts` and web/dev scripts reading `~/.openscout/config.json`. v1 should align on a `featureFlags` field in that file, with OpenScout reading it server-side and passing the parsed layer to HudsonKit.

### (c) Existing nav/palette visibility hook?

Not generally. Current Hudson `CommandOption` is only `{ id, label, action, shortcut?, icon? }`; `WorkspaceAppConfig` has no gate/predicate. The shell already derives visible/disabled apps and merges commands centrally, so adding optional `flag?: FeatureFlagGate` is straightforward and better than per-app filtering. OpenScout’s custom top-nav items also have no predicate today; they can adopt the same type and helper.

### (d) SSR/client hydration?

Provider bootstrap snapshot. The host computes env/shared/url/local-cookie layers on the server and passes them into `FeatureFlagsProvider`; the client uses that exact snapshot for first render. Dev local overrides write localStorage plus a cookie so the next server render matches. No component should parse `window` directly for flag resolution.

## Open questions before prototype

1. Should explicit overrides bypass audience eligibility? This proposal says yes; otherwise the dev panel and emergency shared-config flips are less useful.
2. Should URL overrides outrank local overrides? The ask says local highest; this proposal keeps that, but it means a developer’s pinned local value can mask a shared URL unless they reset local.
3. What exact OpenScout config field name should be reserved: `featureFlags`, `hudsonFeatureFlags`, or `web.featureFlags`?
4. Should unknown flag keys throw in development, warn, or simply resolve false? This proposal returns false and explains `unknown-flag`; a dev warning is probably useful.
