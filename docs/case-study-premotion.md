# Case Study: Premotion

> A Remotion-based video project needed a web UI for browsing its catalog — videos, frames, curated snippets, transcripts. Instead of writing another sidebar/search/status bar from scratch, the project was built as a single Hudson app and the shell did the work. This is what happened.
>
> **Snapshot note:** this case study was written when `hudsonkit` was still workspace-internal. The package is now published on npm, so the symlink workarounds in section 1 and the "publish hudsonkit" item under "Still open" are resolved.

![Premotion catalog studio, rendered through Hudson's AppShell](./images/premotion-case-study.png)

## The question

If Hudson is going to be *my standard app shell across projects*, a fresh React app I don't already control needs to be able to consume `hudsonkit` and get a useful shell with a reasonable amount of setup. That's the question Premotion is testing.

## What got built

Premotion-the-studio is a Vite-replacing Next.js 16 + React 19 + Tailwind v4 app that imports Hudson's SDK and defines one `HudsonApp`:

- **Provider** — loads `catalog-data.json` and `curated-snippets.json`, owns filter/search/selected-video/selected-frame state (all URL-backed via query params: `?filter=curated&q=audio&video=X&frame=Y`), derives filtered lists + counts + app breakdown
- **Hooks** — `useCommands` (filter shortcuts), `useStatus` (totals), `useSearch` (wired to URL `?q=`), `useNavCenter` (breadcrumb on detail view), `useNavActions` (resolution/duration chip), `useLayoutMode: 'panel'`
- **Slots** — `LeftPanel` (status + app filters), `Content` (catalog grid / curated snippets / video detail / frame viewer portal), `Inspector` (overview + per-video metadata + transcript)

That's the whole app. ~1.2k LOC of app code. No custom shell CSS. No custom nav bar.

## What the shell gave us for free

- **Navigation bar** with title, wired search input, breadcrumb center slot, action slot on the right
- **Left + right side panels** with resize handles + collapse toggles + persistent widths
- **Status bar** with live health indicator, console toggle, clock, pan/zoom display
- **Command palette** (`Cmd+K`) that pulls commands from the app's `useCommands` hook
- **Terminal drawer** (`Ctrl+` `` ` ``) ready for future use
- **Persistent UI state** (panel widths, collapsed states) via `usePersistentState`
- **Keyboard shortcuts** for panel toggles (`Cmd+[`, `Cmd+]`)
- **Consistent dark aesthetic** — monospace metadata, cyan accents, emerald-amber-red status colors, tight tabular numerics

Writing all of that from scratch for Premotion would've been days. The shell gave it in minutes once the `HudsonApp` was wired correctly.

## The `HudsonApp` contract

The whole interface is small enough to paste:

```ts
export const catalogApp: HudsonApp = {
  id: 'premotion-catalog',
  name: 'Premotion',
  mode: 'panel',
  Provider: CatalogProvider,
  leftPanel: { title: 'Catalog', icon: <Film size={12} /> },
  rightPanel: { title: 'Details' },
  slots: { Content, LeftPanel, Inspector },
  hooks: {
    useCommands, useStatus, useSearch,
    useNavCenter, useNavActions, useLayoutMode,
  },
};
```

And it mounts in `app/page.tsx` like this:

```tsx
'use client';
import { Suspense } from 'react';
import { AppShell } from 'hudsonkit/app-shell';
import { catalogApp } from '@/catalog';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AppShell app={catalogApp} />
    </Suspense>
  );
}
```

That's the whole mount point. The shell reads slots and hooks from the app object, wraps everything in the Provider, and renders.

## URL-driven state

Instead of reaching for a state library, the Provider reads from `useSearchParams()` directly. The URL *is* the state — `filter`, `q`, `video`, `category`, `frame` are all query params. Mutations call `router.replace()` with updated params (no navigation, no scroll). Browser back/forward works naturally.

This is one of those choices where the Hudson shell nudges you toward it but doesn't enforce it — the Provider owns how state works; the shell just reads.

## What it took to get here — the friction points

Consuming Hudson SDK from a fresh Next.js app today is possible but **not seamless**. Every friction below was a real wall we hit building Premotion. Each one is a gap in the SDK, not the consumer.

### 1. Package-manager symlink shape

`bun add file:../hudson/packages/hudson-sdk` creates per-file symlinks in `node_modules/hudsonkit/` (package.json is a symlink, src/index.ts is a symlink, etc.). Turbopack's module resolver choked on this — it sees the symlinks' absolute targets as "invalid redirects" when parsing the `exports` field.

**Workaround:** Skip bun's `file:` install. Manually create a single relative directory symlink:

```bash
mkdir -p node_modules/@hudson
ln -s ../../../hudson/packages/hudson-sdk node_modules/hudsonkit
```

**Real fix (pending):** publish the SDK, or build a proper tarball that consumers install.

### 2. Turbopack root must lift to the common ancestor

`hudsonkit`'s source lives at `../hudson/packages/hudson-sdk/src` — above the consumer project's root. Turbopack needs `root` set to a common ancestor to traverse up:

```ts
// next.config.ts
turbopack: {
  root: join(__dirname, '..'),
  resolveAlias: {
    tailwindcss: join(__dirname, 'node_modules', 'tailwindcss'),
  },
},
```

The `tailwindcss` alias is needed because lifting `root` loses the consumer's local `tailwindcss` module lookup. Second-order workaround.

**Real fix:** publish the SDK.

### 3. Hudson's `node_modules` must be installed

SDK components import `react`, `lucide-react`, etc. Those imports resolve starting from the SDK's file location in the Hudson monorepo. If Hudson's root `node_modules` aren't installed, resolution fails.

**Real fix:** the SDK should either have its own `node_modules` (workspace-internal dep) or truly hermetic deps.

### 4. Missing `'use client'` directives on 11 SDK files

`CommandPalette`, `TerminalDrawer`, `Frame`, `Minimap`, `ZoomControls`, `AnimationTimeline`, `StatusBar`, `Canvas`, `usePersistentState`, `useAppSettings`, `usePlatformLayout` all use React hooks but didn't have `'use client'` at the top. Hudson's own build masked this (through some combination of `transpilePackages` and root-level directives); Turbopack in strict RSC mode surfaced it instantly for external consumers.

**Fixed:** the 11 directives are now committed in `4d39aed`.

### 5. Missing compiled CSS bundle — the invisible killer

This one was the show-stopper. Hudson SDK components use **a lot of Tailwind v4 utility classes**. Those classes only exist in compiled CSS if Tailwind's content scanner sees the source files — but Tailwind only scans the consumer's project by default.

Premotion first rendered with half-broken styling: nav bar cramped, terminal drawer bleeding across the top, layout bounds off by hundreds of pixels. It *looked* like ten separate bugs. It was one missing config line.

**Before (per-consumer workaround):**

```css
@source "../../hudson/packages/hudson-sdk/src/**/*.{ts,tsx}";
```

**After (SDK fix, `4d39aed`):** The SDK now ships a pre-compiled `dist/styles.css` bundle. Consumers just:

```css
@import "hudsonkit/styles";
```

And every utility class used by shell chrome is there. 57KB minified, zero config.

### 6. Barrel-export bloat

`import { AppShell } from 'hudsonkit/shell'` dragged in the whole barrel: `HudsonContextMenu` (→ `motion/react` + `@base-ui-components/react`), `AI` (→ `ai` + `@ai-sdk/react`), etc. Consumers who just want the default shell shouldn't need to install any of that.

**Partial fix (`4d39aed`):** Narrower subpath exports added:

```ts
import { AppShell } from 'hudsonkit/app-shell';     // minimum chrome
import { Canvas } from 'hudsonkit/canvas';          // opt-in
import { HudsonContextMenu } from 'hudsonkit/context-menu';  // opt-in, brings motion + base-ui
```

Old `./shell` barrel kept for back-compat.

**Still open:** `AppShell` *transitively* imports `motion` + `@base-ui-components/react` because `Frame.tsx` unconditionally imports `HudsonContextMenu`. Real fix needs `Frame` to gate the context menu behind an optional prop, or have `AppShell` wire the context menu itself so `Frame` stays menu-agnostic.

### 7. `SoloShell` → `AppShell` rename

Naming is positioning. The old name framed single-app as the weird exception and the multi-app workspace as the default. That's backwards for a framework whose primary use case is "one app, full chrome."

**Fixed (`4d39aed`):** `AppShell` is the default; `WorkspaceShell` is the advanced multi-app variant.

## What this proved

- The shell composition pattern (Provider + slots + hooks) works cleanly for a real, non-trivial app
- A `HudsonApp` for a video catalog with filters / search / detail / frame viewer + URL-driven state is ~1.2k LOC of app logic
- Shell chrome, keyboard shortcuts, command palette, persistent panel widths, status bar — all came essentially free
- The remaining SDK gaps are concrete and tractable: shipping a real CSS bundle, splitting the barrel, decoupling Frame from ContextMenu, publishing the package

The exercise was the point. Every friction point on the list above became a tracked SDK issue, and most are now fixed.

## Still open

- **Decouple `Frame` from `HudsonContextMenu`** so `AppShell` doesn't transitively require `motion` + `@base-ui-components/react`
- **Publish `hudsonkit`** (private npm scope or tarball) to eliminate symlink workarounds entirely
- **Move transitive deps** (`ai`, `@ai-sdk/react`, etc.) into the SDK's own `package.json` rather than relying on Hudson's root hoist
- **Document** the setup that *remains* necessary for external consumers after the above (probably just `@import "hudsonkit/styles"` and nothing else)

## Files worth reading

- [`app/page.tsx`](https://github.com/arach/premotion/blob/master/app/page.tsx) — the `<AppShell app={catalogApp} />` mount
- [`catalog/index.ts`](https://github.com/arach/premotion/blob/master/catalog/index.ts) — `HudsonApp` definition
- [`catalog/Provider.tsx`](https://github.com/arach/premotion/blob/master/catalog/Provider.tsx) — URL-driven state pattern
- [`catalog/slots/FrameViewer.tsx`](https://github.com/arach/premotion/blob/master/catalog/slots/FrameViewer.tsx) — portal-based overlay escaping shell chrome
