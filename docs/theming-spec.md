# Hudson Theming & Templates — Implementation Spec

> **Status:** Ready for implementation
> **Owner:** (assign)
> **Scope:** `@hudson/sdk` (primary), `app/` (local dev consumer / demo)
> **Audience:** Engineers (or subagents) picking up discrete phases

This spec defines how Hudson adds **themes** (light / dark / system) and **templates** (preset aesthetics, e.g. `hudson`, `editorial`) to apps built on `AppShell`. It is self-contained — you should not need to read the originating conversation to execute any phase.

---

## 1. Goals

1. Any app that mounts `<AppShell>` gets a **light mode** and a **dark mode** for free, with no per-app work.
2. Consumers can switch between **templates** — preset bundles of design tokens that change the entire aesthetic (colors, radii, accents, type scale). We ship two: `hudson` (current look) and one alternate.
3. Theme & template are **runtime-switchable** (no rebuild), **persisted** per-user, and **SSR-safe** (no flash of wrong theme).
4. Architecture mirrors **shadcn/ui + Tailwind v4** conventions so it feels idiomatic to anyone who has used either.

## 2. Non-Goals

- Re-theming `WorkspaceShell` or the apps inside `app/apps/` (defer to a future phase; many of those are intentionally dark-baked for the `/app` demo). WorkspaceShell can continue to force dark.
- Per-user palette editing / theme builder UI. Templates are curated, not user-authored.
- Migrating the `--hud-*` token namespace. Those are app-content knobs; they stay, and the new shadcn-style tokens are layered *alongside* them, with `--hud-*` re-pointed to feed from the new tokens in the default template.
- A custom CSS-in-JS system. Tokens live in CSS; Tailwind v4's `@theme` is the only glue layer.

## 3. Terminology

| Term | Meaning | Example |
|---|---|---|
| **Theme** | Light/dark mode. A binary axis. | `light`, `dark`, `system` |
| **Template** | A preset bundle of token values that defines an aesthetic. Orthogonal to theme. | `hudson`, `editorial` |
| **Token** | A named CSS custom property that components reference (never a raw color). | `--background`, `--primary`, `--border` |
| **Shell root** | The topmost DOM node rendered by `AppShell`. This is where `data-hudson-theme` and `data-hudson-template` attributes live. | `<div data-hudson-theme="light" data-hudson-template="editorial">…</div>` |

## 4. Current State (as of 2026-04-21, commit `aab5f2c`)

Read these files before starting. They are **the** context you need.

- `packages/hudson-sdk/src/styles/bundle.css` — has `:root { --hud-bg, --hud-ink, --hud-accent, --hud-status-*, typography tokens }`. Dark-only. Referenced by apps as `var(--hud-*)`. No `@theme` block.
- `packages/hudson-sdk/src/lib/theme.ts` — exports `SHELL_THEME` (hard-coded Tailwind utility strings for panels like `bg-neutral-950/95`) and `SEMANTIC_TOKENS` (type-safe names for the `--hud-*` vars). `SHELL_THEME.panels.*` is the thing chrome components concatenate into their `className`.
- `packages/hudson-sdk/src/components/AppShell.tsx` — hard-codes Tailwind color classes throughout (`text-neutral-400`, `text-emerald-400`, `text-cyan-400`, `border-neutral-700/50`, `bg-white/5`, etc.). No theme prop, no context.
- `packages/hudson-sdk/src/components/chrome/` — `Frame.tsx`, `NavigationBar.tsx`, `SidePanel.tsx`, `StatusBar.tsx`, `CommandDock.tsx`. All same pattern: hard-coded neutral/accent classes.
- `packages/hudson-sdk/src/components/overlays/` — `CommandPalette.tsx`, `TerminalDrawer.tsx`. Same pattern.
- `app/globals.css` — Tailwind v4 `@theme inline` block exposing only `--color-background`, `--color-foreground`, `--font-sans`, `--font-mono`. No `.dark` class anywhere. No `dark:` variants in use anywhere in the repo.
- `packages/hudson-sdk/package.json` — already exports `./theme` → `src/theme.ts` and `./styles` → `dist/styles.css`. Use these entrypoints, don't add new ones.
- `postcss.config.mjs` — Tailwind v4 via `@tailwindcss/postcss`. No JS config file.

**Numbers:** ~200 files across the repo use `bg-neutral-*` / `bg-zinc-*` / `bg-slate-*` classes. Most of them are *inside apps*, not chrome. The chrome surface that actually needs migration is smaller: the `chrome/` and `overlays/` directories in the SDK, plus `AppShell.tsx` itself.

## 5. Architecture

### 5.1 Two axes, two data attributes

The shell root carries:

```html
<div
  data-hudson-theme="light|dark"          <!-- resolved; "system" is never written -->
  data-hudson-template="hudson|editorial"
>
```

CSS selectors stack both axes:

```css
[data-hudson-template="hudson"]                       { /* base (shared) */ }
[data-hudson-template="hudson"][data-hudson-theme="light"]  { /* light overrides */ }
[data-hudson-template="hudson"][data-hudson-theme="dark"]   { /* dark overrides */ }
```

This is the shadcn `.dark` convention generalized to two axes. No `:root { … } .dark { … }` — everything is attribute-scoped so multiple AppShells on one page could theoretically use different templates (future-proofing; not a v1 requirement).

### 5.2 Token layer (the shadcn-inspired surface)

All components consume these tokens. They are the **only** colors used in chrome.

| Token | Purpose |
|---|---|
| `--background` | Page background |
| `--foreground` | Default text on background |
| `--card` | Elevated surface (panels, popovers, dialogs) |
| `--card-foreground` | Text on card |
| `--popover` | Floating surface (command palette, dropdowns) |
| `--popover-foreground` | Text on popover |
| `--primary` | Primary actions, focus rings |
| `--primary-foreground` | Text on primary |
| `--secondary` | Secondary buttons, hover layers |
| `--secondary-foreground` | Text on secondary |
| `--muted` | Quiet backgrounds (inactive tabs, disabled rows) |
| `--muted-foreground` | Secondary / metadata text |
| `--accent` | Brand / highlight color (emerald in `hudson`) |
| `--accent-foreground` | Text on accent |
| `--destructive` | Error states, destructive actions |
| `--destructive-foreground` | Text on destructive |
| `--warning` | Warning states (amber in `hudson`) |
| `--success` | Success states |
| `--info` | Informational states |
| `--border` | Default border color |
| `--input` | Input border / surface |
| `--ring` | Focus ring |
| `--radius` | Base radius (e.g. `8px`) |

**Color-format convention:** use CSS `oklch()` values without the wrapping function, stored as space-separated components so Tailwind's alpha modifier works:

```css
--background: 0.99 0.005 250;     /* L C H */
```

Tailwind v4 `@theme` then re-exposes as:

```css
@theme inline {
  --color-background: oklch(var(--background));
  --color-foreground: oklch(var(--foreground));
  /* …etc */
}
```

This gives you `bg-background`, `text-foreground`, `bg-primary/50`, `text-muted-foreground`, etc. for free.

> If OKLCH feels too far from current conventions, fall back to HSL (`210 20% 98%` → `hsl(var(--background))`). Do **not** use hex or `rgb(r g b)`; alpha modifiers require the space-separated components form. Pick one format across all tokens and stay consistent.

### 5.3 Relationship to the existing `--hud-*` tokens

Do **not** delete or rename `--hud-*`. In the default `hudson` template, re-point them at the new shadcn tokens:

```css
[data-hudson-template="hudson"] {
  --hud-bg: oklch(var(--background));
  --hud-ink: oklch(var(--foreground));
  --hud-accent: oklch(var(--accent));
  --hud-status-ok: oklch(var(--success));
  /* …etc. Typography tokens (--hud-text-*, --hud-font-*) stay in bundle.css at :root — they're template-agnostic. */
}
```

This means every app that currently reads `var(--hud-bg)` automatically picks up light mode with zero code changes.

### 5.4 `ThemeProvider` + `useTheme`

New file: `packages/hudson-sdk/src/theme/ThemeProvider.tsx`

```tsx
export type HudsonTheme = 'light' | 'dark' | 'system';
export type HudsonTemplate = 'hudson' | 'editorial';

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: HudsonTheme;          // default: 'system'
  defaultTemplate?: HudsonTemplate;    // default: 'hudson'
  storageKey?: string;                 // default: 'hudson.theme'
  /** If provided, ThemeProvider writes attrs to this element; otherwise to <html>. */
  rootElement?: HTMLElement | null;
}

export function ThemeProvider(props: ThemeProviderProps): JSX.Element;

export function useTheme(): {
  theme: HudsonTheme;              // what the user chose
  resolvedTheme: 'light' | 'dark'; // what's actually applied (resolves 'system')
  template: HudsonTemplate;
  setTheme: (t: HudsonTheme) => void;
  setTemplate: (t: HudsonTemplate) => void;
};
```

**Behavior:**

- Persists `{ theme, template }` to `localStorage` under `storageKey`.
- Listens to `window.matchMedia('(prefers-color-scheme: dark)')` when `theme === 'system'` and updates `resolvedTheme` + data attribute reactively.
- Writes `data-hudson-theme="light|dark"` and `data-hudson-template="…"` to `rootElement` (default: `document.documentElement`).
- Exposes a tiny **pre-hydration script** (inline, synchronous) that reads `localStorage` and sets the data attributes before React mounts — this is the standard shadcn/next-themes anti-flash pattern. Ship this as a named export `<HudsonThemeScript />` the consumer drops into their `<head>`.

> **Implementation note:** look at `next-themes` for reference on the script pattern, but **do not add `next-themes` as a dependency**. Re-implement it; it's ~30 lines.

### 5.5 `AppShell` integration

`AppShell` auto-wraps in `ThemeProvider`. New props:

```tsx
interface AppShellProps {
  app: HudsonApp;
  assistant?: boolean;
  /** Default theme; user can still switch at runtime. Defaults to 'system'. */
  defaultTheme?: HudsonTheme;
  /** Default template. Defaults to 'hudson'. */
  defaultTemplate?: HudsonTemplate;
  /**
   * If your host app already renders its own <ThemeProvider> at a higher level
   * (e.g. Next.js root layout), pass `managedTheme={false}` to skip AppShell's
   * internal provider and inherit from context.
   */
  managedTheme?: boolean; // default: true
}
```

When `managedTheme === true`, AppShell renders `<ThemeProvider>` internally and also renders the pre-hydration script — but **only** once per tree. If a parent `ThemeProvider` already exists in context, the inner one detects it via a sentinel context value and no-ops.

### 5.6 SDK public surface (additions)

Add to `packages/hudson-sdk/src/index.ts`:

```ts
export { ThemeProvider, useTheme, HudsonThemeScript } from './theme/ThemeProvider';
export type { HudsonTheme, HudsonTemplate, ThemeProviderProps } from './theme/ThemeProvider';
```

No breaking changes to existing exports. `SHELL_THEME` stays for now (it will be eviscerated by Phase 3 but its shape survives so consumers importing it don't break).

---

## 6. Concrete Token Values

These are the starting palettes. Tune visually, but ship these as v1 so implementation can be mechanical.

> Values below are in `oklch(L C H)` space-separated form.
> `--radius` is a length, not a color.

### 6.1 Template: `hudson` (default, current aesthetic)

**Dark** (the current look — preserve fidelity):

```
--background:           0.145 0 0;
--foreground:           0.95 0 0;
--card:                 0.18 0 0;
--card-foreground:      0.95 0 0;
--popover:              0.16 0 0;
--popover-foreground:   0.95 0 0;
--primary:              0.75 0.17 162;   /* emerald-ish for dark */
--primary-foreground:   0.145 0 0;
--secondary:            0.24 0 0;
--secondary-foreground: 0.95 0 0;
--muted:                0.22 0 0;
--muted-foreground:     0.64 0 0;
--accent:               0.72 0.18 162;   /* emerald accent */
--accent-foreground:    0.145 0 0;
--destructive:          0.62 0.24 25;    /* red-500 */
--destructive-foreground: 0.98 0 0;
--warning:              0.80 0.17 75;    /* amber-500 */
--success:              0.70 0.17 145;   /* green */
--info:                 0.62 0.20 250;   /* blue-500 */
--border:               0.28 0 0;
--input:                0.28 0 0;
--ring:                 0.72 0.18 162;
--radius:               8px;
```

**Light** (new — this is the marquee deliverable):

```
--background:           0.99 0.003 250;  /* near-white, faint cool tint */
--foreground:           0.17 0.02 250;   /* near-black */
--card:                 1.00 0 0;
--card-foreground:      0.17 0.02 250;
--popover:              1.00 0 0;
--popover-foreground:   0.17 0.02 250;
--primary:              0.55 0.16 162;   /* emerald-600, readable on white */
--primary-foreground:   0.99 0 0;
--secondary:            0.96 0.005 250;
--secondary-foreground: 0.24 0.02 250;
--muted:                0.96 0.005 250;
--muted-foreground:     0.50 0.02 250;
--accent:               0.55 0.16 162;
--accent-foreground:    0.99 0 0;
--destructive:          0.58 0.22 25;
--destructive-foreground: 0.99 0 0;
--warning:              0.72 0.16 75;
--success:              0.58 0.15 145;
--info:                 0.55 0.19 250;
--border:               0.91 0.005 250;
--input:                0.91 0.005 250;
--ring:                 0.55 0.16 162;
--radius:               8px;
```

### 6.2 Template: `editorial` (alternate aesthetic)

Rationale: a warmer, paper-ish feel with serif-friendly type. Proves the template system is general; differentiates from `hudson` on more than just color.

**Light:**

```
--background:           0.98 0.01 80;    /* warm off-white */
--foreground:           0.20 0.02 60;    /* ink brown-black */
--card:                 1.00 0 0;
--card-foreground:      0.20 0.02 60;
--popover:              1.00 0 0;
--popover-foreground:   0.20 0.02 60;
--primary:              0.30 0.05 60;    /* espresso */
--primary-foreground:   0.98 0.01 80;
--secondary:            0.94 0.02 80;
--secondary-foreground: 0.20 0.02 60;
--muted:                0.93 0.015 80;
--muted-foreground:     0.48 0.03 60;
--accent:               0.60 0.18 40;    /* terracotta */
--accent-foreground:    0.99 0 0;
--destructive:          0.55 0.22 25;
--destructive-foreground: 0.99 0 0;
--warning:              0.72 0.16 75;
--success:              0.52 0.14 145;
--info:                 0.50 0.15 250;
--border:               0.88 0.015 80;
--input:                0.88 0.015 80;
--ring:                 0.60 0.18 40;
--radius:               4px;             /* tighter than hudson */
```

**Dark** — derive in implementation by inverting L, keeping C/H in same family; match fidelity level of hudson-dark. Full values to be finalized by whoever picks up Phase 4.

### 6.3 Template-scoped typography overrides

Templates may override type tokens. In `editorial`:

```css
[data-hudson-template="editorial"] {
  --hud-font-sans: 'Inter', system-ui, sans-serif;
  --hud-font-serif: 'Source Serif 4', Georgia, serif;
  /* editorial uses serif for body content; chrome stays sans */
}
```

Do **not** bundle the fonts. Document that consumers wanting `editorial` must load `Source Serif 4` themselves (via `next/font` or a `<link>`).

---

## 7. Implementation Phases

Each phase is independently mergeable, independently reviewable, and sized for one engineer (or subagent) to complete in one pass. Phases 1–3 are required for v1; phases 4–5 are follow-ups.

### Phase 1 — Token infrastructure (no visible change)

**Deliverable:** New tokens exist in CSS and Tailwind knows about them. Nothing consumes them yet.

Files to create/edit:

1. **New:** `packages/hudson-sdk/src/styles/tokens.css`
   - Defines all tokens from §6 under `[data-hudson-template="hudson"]` (dark + light) and `[data-hudson-template="editorial"]` (light only for v1; dark TBD).
   - Re-points `--hud-bg`, `--hud-ink`, `--hud-muted`, `--hud-dim`, `--hud-border`, `--hud-accent`, `--hud-status-*` to the new tokens under each template scope (see §5.3).
2. **Edit:** `packages/hudson-sdk/src/styles/bundle.css`
   - `@import "./tokens.css";` right after the Tailwind import.
   - Keep the existing `:root` typography block (it's template-agnostic).
   - Keep the `--hud-*` color defaults at `:root` as a *fallback* for apps rendered outside any template scope — but the template selectors will override them.
3. **Edit:** `app/globals.css`
   - Replace the minimal `@theme inline` block with the full Tailwind v4 theme wiring:
     ```css
     @theme inline {
       --color-background: oklch(var(--background));
       --color-foreground: oklch(var(--foreground));
       --color-card: oklch(var(--card));
       --color-card-foreground: oklch(var(--card-foreground));
       /* …one line per token from §6 */
       --color-border: oklch(var(--border));
       --color-ring: oklch(var(--ring));
       --radius-lg: var(--radius);
       --radius-md: calc(var(--radius) - 2px);
       --radius-sm: calc(var(--radius) - 4px);
     }
     ```
   - Bootstrap the dev instance: add `data-hudson-template="hudson" data-hudson-theme="dark"` to `<html>` in `app/layout.tsx` temporarily (Phase 2 makes this dynamic).
4. **Edit:** `packages/hudson-sdk/src/styles/bundle.css` — mirror the `@theme inline` block so third-party consumers that import `@hudson/sdk/styles` also get the Tailwind bindings. (This file is the compilation entry for `dist/styles.css`.)

**Acceptance criteria:**

- [ ] `bun dev` starts, site looks **identical** to before (you haven't migrated any components yet).
- [ ] In devtools, `html` has the two data attrs.
- [ ] `getComputedStyle(document.documentElement).getPropertyValue('--background')` returns the dark-hudson value.
- [ ] Swapping `data-hudson-theme` to `"light"` in devtools causes `--background` to change, even though the UI doesn't yet respond (proves cascade works).
- [ ] `cd packages/hudson-sdk && bun run build:css` succeeds; `dist/styles.css` contains the new token definitions.

### Phase 2 — `ThemeProvider` + `useTheme` + anti-flash script

**Deliverable:** Runtime theme/template switching works; preference persists; no FOUC.

Files:

1. **New:** `packages/hudson-sdk/src/theme/ThemeProvider.tsx` — per §5.4 spec.
2. **New:** `packages/hudson-sdk/src/theme/script.ts` — exports an inline-safe stringified script for pre-hydration. It reads `localStorage.getItem('hudson.theme')`, parses `{theme, template}`, resolves `system` via `matchMedia`, and writes the two data attributes to `document.documentElement`. Must be `<200 bytes minified`.
3. **New:** `<HudsonThemeScript />` component that renders `<script dangerouslySetInnerHTML={{ __html: scriptString }} />`.
4. **Edit:** `packages/hudson-sdk/src/index.ts` — export the new API per §5.6.
5. **Edit:** `app/layout.tsx` — render `<HudsonThemeScript />` inside `<head>` before anything else.
6. **Edit:** `app/layout.tsx` — wrap `children` in `<ThemeProvider>` so Next.js pages see the context (even though AppShell can manage its own, the `/app` route uses WorkspaceShell which needs it too in future).
7. **Demo:** add a minimal theme toggle to `app/page.tsx` or an obvious dev-only spot — three buttons: Light / Dark / System, plus a template dropdown. Used solely to verify Phase 2; can be removed or moved to a proper settings panel in Phase 4.

**Acceptance criteria:**

- [ ] Clicking "Light" changes `data-hudson-theme` and the `--hud-*` surface vars (visible via devtools).
- [ ] Hard refresh preserves the chosen theme with **no flash** (verify on slow 3G throttle).
- [ ] Switching OS dark mode while `theme === 'system'` updates the page live.
- [ ] `localStorage.getItem('hudson.theme')` contains both `theme` and `template`.
- [ ] `useTheme()` inside a component returns correct values and setters work.
- [ ] SSR: view source of the initial HTML shows `data-hudson-theme` set correctly based on localStorage (if present) or a sensible default.

### Phase 3 — Migrate `AppShell` + chrome + overlays to semantic classes

**Deliverable:** Light mode actually looks like light mode. This is the bulk of the work.

Strategy: **replace hard-coded Tailwind color classes with semantic classes**. Mechanical find-and-replace where possible, visual review where not.

Class migration table (apply inside `packages/hudson-sdk/src/components/`):

| Before | After |
|---|---|
| `bg-neutral-950/95` | `bg-background/95` |
| `bg-neutral-900` / `bg-neutral-900/80` | `bg-card` / `bg-card/80` |
| `bg-neutral-800/50` | `bg-muted` |
| `bg-white/5` (hover layer) | `bg-accent/10` or `bg-muted` (case-by-case) |
| `text-neutral-100` / `text-white` | `text-foreground` |
| `text-neutral-300` / `text-neutral-400` | `text-muted-foreground` |
| `text-neutral-500` / `text-neutral-600` | `text-muted-foreground/70` |
| `text-emerald-400` / `text-emerald-500` | `text-accent` |
| `bg-emerald-500/10` | `bg-accent/10` |
| `text-red-400` / `text-red-500` | `text-destructive` |
| `text-amber-400` | `text-warning` (add as Tailwind color in Phase 1) |
| `text-cyan-400` (Assistant tab) | Keep as literal `text-cyan-400` **only if** Assistant is meant to be uniquely cyan regardless of template. Otherwise map to `text-info`. Recommendation: make it `text-info` and let templates own the final hue. |
| `border-neutral-700/50` / `border-neutral-700/80` | `border-border` |

Files to migrate (**do them in this order**; each one is a standalone commit):

1. `packages/hudson-sdk/src/lib/theme.ts` — `SHELL_THEME.panels.*` strings. This unlocks all the chrome in one change.
2. `packages/hudson-sdk/src/components/chrome/Frame.tsx`
3. `packages/hudson-sdk/src/components/chrome/NavigationBar.tsx`
4. `packages/hudson-sdk/src/components/chrome/SidePanel.tsx`
5. `packages/hudson-sdk/src/components/chrome/StatusBar.tsx`
6. `packages/hudson-sdk/src/components/chrome/CommandDock.tsx`
7. `packages/hudson-sdk/src/components/overlays/CommandPalette.tsx`
8. `packages/hudson-sdk/src/components/overlays/TerminalDrawer.tsx`
9. `packages/hudson-sdk/src/components/AppShell.tsx`

For each file:

- Replace classes per the table.
- For shadows/glows that reference `rgba(0,0,0,…)` or `rgba(255,255,255,…)` literally: leave for now unless they look broken in light mode. Flag in PR description for Phase 4 polish.
- After migration, test: render the app in both themes; list anything that looks wrong in a PR comment.

**Acceptance criteria:**

- [ ] Toggle to light: the nav bar, side panels, status bar, command palette, and terminal drawer all render on a near-white background with readable dark text.
- [ ] Toggle back to dark: matches the pre-migration look pixel-close (drift of <5% in color values is fine; layout must be identical).
- [ ] No `bg-neutral-*`, `text-neutral-*`, `text-emerald-*`, `border-neutral-*` classes remain in the 9 files listed above. (Grep proves this.)
- [ ] `bun run build` succeeds with no new warnings.

### Phase 4 — `editorial` template + polish pass

**Deliverable:** Second template is fully usable; light-mode polish; documented.

1. Finalize `editorial` dark tokens (§6.2).
2. Load `Source Serif 4` in the dev instance via `next/font` behind a conditional — or document the consumer's responsibility.
3. Review every chrome component in both templates × both themes = 4 combos. Screenshot each and compare. Fix any contrast / legibility issues.
4. Replace the dev-only Phase 2 toggle with a polished theme/template switcher inside the Command Palette (add two commands: `Switch theme…` and `Switch template…`).
5. Write `docs/theming.md` — consumer-facing docs: how to opt in, how to customize tokens per-app, how to add a new template.

**Acceptance criteria:**

- [ ] All four template × theme combos screenshot cleanly.
- [ ] `Switch theme…` appears in the command palette and works.
- [ ] `docs/theming.md` exists and covers the three use cases above.

### Phase 5 — (Deferred) WorkspaceShell + internal apps

Out of scope for v1. Tracked separately.

---

## 8. Open Decisions (for product owner)

These are the things I'd want confirmed before Phase 4 ships. Phases 1–3 can proceed without answers.

- **Second template identity.** `editorial` is the spec's proposal (warm, serif, tighter radius). Alternatives worth considering: `mono` (monospace-forward, tighter, monochrome-plus-emerald), `paper` (physical-paper skeuomorphic), `marine` (cyan/teal-forward — distinguishes Hudson from emerald-brand apps). Pick one before Phase 4.
- **Light-mode accent hue.** Spec defaults to emerald-600 for `hudson` light so the brand stays. Alternative: shift to a deeper teal for better light-mode readability. Requires a 2-minute visual judgment from design.
- **Assistant tab cyan.** Should the Assistant tab keep its fixed cyan identity across all templates (part of Hudson's personality), or should it be `--info` and template-owned? Spec recommends the latter but explicitly calls it out as a style question.
- **WorkspaceShell.** Confirm we're OK leaving it dark-only for now. If the landing `/` route should also honor light mode, that's a separate small ticket.

---

## 9. Risks & Notes

- **OKLCH browser support** — Safari 15.4+, Chrome 111+, Firefox 113+. All Hudson users are on modern evergreen browsers per the `/app` route assumptions. If OKLCH becomes a blocker, swap to HSL values across §6 (mechanical change).
- **SDK CSS bundle re-build.** After Phase 1, run `cd packages/hudson-sdk && bun run build:css` and commit `dist/styles.css` if the repo currently commits it (check `.gitignore`; CLAUDE.md says it's gitignored — if so, document that consumers must re-build).
- **`next-themes` temptation.** Do not add it as a dep. The custom `ThemeProvider` in §5.4 is ~100 lines total and keeps the SDK dependency-free on the theming surface.
- **Don't mass-migrate `app/apps/**`.** Those are the demo apps on `/app` and are intentionally dark. They use `--hud-*` vars which now feed from the new tokens in the default template — they'll mostly Just Work, but stylistic inversions (e.g. `bg-neutral-900`) in those apps are outside v1 scope.
- **StatusBar colors.** `StatusBar.tsx` uses `StatusColor` enum (`ok`, `warn`, `error`, `info`) — these should map directly to `--success`, `--warning`, `--destructive`, `--info` in Phase 3. Confirm by reading `packages/hudson-sdk/src/types/app.ts`.

---

## 10. What "Done" Looks Like (v1)

A consumer adds one line to their app:

```tsx
<AppShell app={myApp} defaultTheme="system" defaultTemplate="hudson" />
```

…and gets:

- Correct theme on first paint, no flash.
- User can toggle light/dark from the Command Palette.
- User can switch to the `editorial` template and see a visibly different aesthetic.
- Preference persists across refreshes.
- The Hudson dev instance (`bun dev`) runs with the toggle wired up as the canonical demo.
