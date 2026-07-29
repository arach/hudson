# HUD-007 — App Controls Layer

**Status**: Draft
**Owner**: TBD

## Summary

A small set of composable UI primitives for Hudson app interiors. Today every app hand-rolls the same Tailwind patterns for buttons, inputs, badges, list items, and panel sections — Day Stack, Hudson AI, Logo Designer, and Docs all define local `ActionButton`, `ScopeBadge`, `SectionTitle`, `SettingSelect` etc. with near-identical class strings. HUD-007 promotes these into hudsonkit as theme-aware, density-responsive primitives that sit *below* the existing domain controls (ParamPanel, CodeEditor, HudTable) and *above* raw Tailwind.

## What exists today

**Domain controls** (already exported via `hudsonkit/controls`):
- `ParamPanel` family — section, slider, toggle, color, enum, text, repeatable, grid
- `CodeEditor` / `CodeViewer` — CodeMirror-based
- `TextDocumentSurface` — markdown/code document with edit/read/preview modes
- `HudTable` — resizable column table

**Chrome** (exported via `hudsonkit/chrome`):
- StatusBar, SidePanel, NavigationBar, CommandDock, ZoomControls, Frame

**What's missing** — the layer between chrome and domain:
- Buttons (every app writes `rounded-md border px-3 py-2 text-[11px] transition-colors`)
- Inputs, textareas, selects (raw `<input>` / `<select>` with inline Tailwind)
- Badges (`rounded-full border ... px-2 py-0.5 text-[9px]` repeated across 4+ apps)
- List items with selection state, border-l accent, trailing actions
- Panel sections with collapsible headers
- Progress indicators
- Toolbars

## Theme foundation

HUD-007 components consume existing tokens — no new token layer needed.

**Tailwind semantic tokens** (from `globals.css @theme`):
```
bg-background    bg-card       bg-muted
text-foreground  text-muted-foreground
border-border    border-input   border-ring
bg-accent        bg-destructive bg-success bg-warning bg-info
```

**CSS custom properties** (from `tokens.css`):
```
--hud-bg  --hud-surface  --hud-ink  --hud-muted  --hud-dim
--hud-border  --hud-accent  --hud-accent-soft
--hud-status-ok  --hud-status-warn  --hud-status-error  --hud-status-info
--hud-text-xxs(10px) through --hud-text-3xl(28px)
--hud-radius  --hud-shadow-soft
--hud-font-sans  --hud-font-mono
```

**Rule**: Components use these tokens exclusively. No hardcoded `cyan-700`, `emerald-600`, etc. Accent color comes from `--hud-accent` / `bg-accent`. Status colors come from `--hud-status-*` / `bg-success` / `bg-warning` / `bg-destructive`. This makes components theme-correct across Hudson's three templates (hudson, editorial, drafting) and both light/dark modes automatically.

## Component inventory

### Density

All interactive components accept an optional `density` prop:

```ts
type HudDensity = 'compact' | 'default';
```

`compact` tightens padding and drops to smaller text sizes. Matches `HudTable`'s existing `HudTableDensity`. Default is `'default'`.

### Tone

Semantic color variants for buttons and badges:

```ts
type HudTone = 'neutral' | 'accent' | 'success' | 'warning' | 'destructive';
```

Mapped to theme tokens:
| Tone | Border | Background | Text |
|------|--------|------------|------|
| `neutral` | `border-border` | `bg-muted/40` | `text-foreground` |
| `accent` | `border-accent/30` | `bg-accent/10` | `text-accent-foreground` via `--hud-accent` |
| `success` | `border-success/30` | `bg-success/10` | success foreground |
| `warning` | `border-warning/30` | `bg-warning/10` | warning foreground |
| `destructive` | `border-destructive/30` | `bg-destructive/10` | destructive foreground |

No purple tones. Accent defaults to cyan/teal per Hudson convention.

### Components

#### HudButton

Primary interactive element. Replaces the `ActionButton`, `SurfaceTabButton`, and inline button patterns found across Day Stack, Hudson AI, Logo Designer.

```ts
interface HudButtonProps {
  children: ReactNode;
  tone?: HudTone;                    // default: 'neutral'
  variant?: 'solid' | 'soft' | 'ghost';  // default: 'soft'
  density?: HudDensity;
  icon?: HudsonIcon;                 // leading icon
  iconAfter?: HudsonIcon;           // trailing icon
  selected?: boolean;               // toggle/tab state
  disabled?: boolean;
  loading?: boolean;                 // shows spinner, disables
  onClick?: () => void;
  className?: string;               // escape hatch
}
```

Variants:
- `solid` — filled background, high contrast (primary actions)
- `soft` — tinted background at 10% opacity, colored border (default — matches current app patterns)
- `ghost` — transparent until hover

When `selected`, uses accent tint regardless of tone (matching existing `SurfaceTabButton` pattern).

Typography: `text-[11px] font-mono uppercase tracking-[0.12em]` at default density; `text-[10px]` at compact. This matches the dominant pattern across Hudson AI and Day Stack.

#### HudIconButton

Icon-only variant. Replaces the bare `<button className="rounded p-1.5 text-muted-foreground">` pattern.

```ts
interface HudIconButtonProps {
  icon: HudsonIcon;
  label: string;                     // accessible label (aria-label)
  tone?: HudTone;
  variant?: 'soft' | 'ghost';       // default: 'ghost'
  density?: HudDensity;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}
```

Renders as a square button with centered icon. `label` is required for accessibility.

#### HudField

Wrapper for form controls. Provides label, optional description, and error state.

```ts
interface HudFieldProps {
  label: string;
  description?: string;
  error?: string;
  density?: HudDensity;
  children: ReactNode;               // the input/select/textarea
}
```

Label renders as `text-[10px] uppercase tracking-widest text-muted-foreground` (matching ParamPanel convention). Description in `text-muted-foreground` below. Error in `text-destructive`.

#### HudInput

Text input. Replaces inline `<input className="border border-border bg-background px-2 py-1.5 ...">`.

```ts
interface HudInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  density?: HudDensity;
  icon?: HudsonIcon;                 // leading icon inside field
  invalid?: boolean;
  className?: string;
}
```

Base style: `bg-muted/40 border border-border rounded-md px-2 py-1.5 text-[12px] font-mono outline-none`. Focus: `focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30`. Invalid: `border-destructive`.

#### HudTextarea

Textarea variant. Same token usage as HudInput.

```ts
interface HudTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  density?: HudDensity;
  invalid?: boolean;
  className?: string;
}
```

Default: `resize-none` (opt-in via className). Matches Day Stack's `<textarea className="resize-none rounded-md border border-border bg-background px-2 py-1.5" rows={4} />`.

#### HudSelect

Styled native `<select>`. Replaces Hudson AI's `SettingSelect`.

```ts
interface HudSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  options: { value: string; label: string }[];
  density?: HudDensity;
  invalid?: boolean;
  className?: string;
}
```

Uses native `<select>` — no custom dropdown. Consistent with Hudson's "no component library" constraint. Styled to match HudInput.

#### HudCheckbox

Boolean toggle. Replaces ParamPanel's `ParamToggle` for general use.

```ts
interface HudCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  density?: HudDensity;
  disabled?: boolean;
}
```

Renders as a small toggle switch (not a native checkbox). Knob color from `--hud-surface`, track from `--hud-muted` (off) / `--hud-accent` (on). No hardcoded white.

#### HudPanelSection

Collapsible section for side panels and inspectors. Replaces the `SectionTitle` + manual disclosure patterns.

```ts
interface HudPanelSectionProps {
  title: string;
  defaultOpen?: boolean;             // default: true
  actions?: ReactNode;               // trailing slot (icon buttons, badges)
  density?: HudDensity;
  children: ReactNode;
}
```

Header: title in `text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground` + ChevronRight rotation on collapse. Content animates height. Matches existing ParamSection pattern but generalized.

#### HudListItem

Interactive list row. Replaces Day Stack's hand-rolled `border-l-2` list items.

```ts
interface HudListItemProps {
  children: ReactNode;
  selected?: boolean;
  active?: boolean;                  // keyboard focus / current
  disabled?: boolean;
  icon?: HudsonIcon;
  description?: ReactNode;          // secondary line
  trailing?: ReactNode;             // right-side slot (badge, icon button, timestamp)
  density?: HudDensity;
  onClick?: () => void;
  className?: string;
}
```

Selection state: `border-l-2 border-l-accent bg-accent/[0.08]`. Unselected: `border-l-2 border-l-transparent`. Hover: `bg-muted/40`. Group hover reveals trailing actions (via `group` + `opacity-0 group-hover:opacity-100`).

#### HudBadge

Inline label. Replaces `ScopeBadge` and the `rounded-full border ... px-2 py-0.5 text-[9px]` pattern.

```ts
interface HudBadgeProps {
  children: ReactNode;
  tone?: HudTone;                    // default: 'accent'
  density?: HudDensity;
  dot?: boolean;                     // leading status dot
}
```

Renders as `rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.12em]`. Tone drives border/bg/text colors via the tone mapping table above.

#### HudProgress

Determinate progress bar. For task completion, upload progress, etc.

```ts
interface HudProgressProps {
  value: number;                     // 0–100
  tone?: HudTone;                    // default: 'accent'
  density?: HudDensity;
  label?: string;                    // e.g., "3 of 8"
}
```

Track: `bg-muted/40 rounded-full h-1.5` (compact: `h-1`). Fill: tone-colored with `transition-all`. Optional label right-aligned in `text-[10px] text-muted-foreground`.

#### HudToolbar

Horizontal group for icon buttons and controls. Provides consistent spacing and separator affordance.

```ts
interface HudToolbarProps {
  children: ReactNode;               // HudIconButton, HudButton, dividers
  density?: HudDensity;
  className?: string;
}

// Companion
function HudToolbarSeparator(): JSX.Element;
```

Renders as `flex items-center gap-1` (compact: `gap-0.5`). Separator: `w-px h-4 bg-border/50 mx-1`.

## File layout

```
packages/web/hudsonkit/src/
  components/
    primitives/                      ← NEW directory
      HudButton.tsx
      HudIconButton.tsx
      HudField.tsx
      HudInput.tsx
      HudTextarea.tsx
      HudSelect.tsx
      HudCheckbox.tsx
      HudPanelSection.tsx
      HudListItem.tsx
      HudBadge.tsx
      HudProgress.tsx
      HudToolbar.tsx
      index.ts                       ← barrel export
  primitives.ts                      ← NEW entry point (re-exports from components/primitives)
```

**Package.json export**:

```json
{
  "exports": {
    "./primitives": {
      "import": "./dist/primitives.js",
      "types": "./dist/primitives.d.ts"
    }
  }
}
```

Consumers:

```ts
import { HudButton, HudBadge, HudListItem } from 'hudsonkit/primitives';
```

Separate from `hudsonkit/controls` (which keeps ParamPanel, CodeEditor, TextDocument — domain controls that may consume primitives internally). Over time, ParamPanel could be refactored to use HudInput/HudCheckbox/HudSelect internally, but that's not in scope for v1.

## Migration plan

### Phase 1: Ship primitives (1 PR)

Land the `primitives/` directory with all 12 components. Unit tests via Vitest for:
- Each component renders without error
- Density prop changes output classes
- Tone prop maps to correct token classes
- Selected/disabled states apply correct attributes
- HudPanelSection collapse toggle works

No app changes yet. The components exist and are importable.

### Phase 2: Day Stack adoption (1 PR)

Day Stack (`apps/web/app/apps/day-stack/`) is the first consumer. Replace:
- Inline button patterns → `HudButton` / `HudIconButton`
- `<input className="...">` → `HudInput` wrapped in `HudField`
- `<textarea>` → `HudTextarea`
- List items with `border-l-2` → `HudListItem`
- `rounded-full border ... text-[9px]` badges → `HudBadge`
- Section headers → `HudPanelSection`

**Acceptance**: Day Stack panels render identically (visual diff). No new Tailwind color classes in Day Stack's own files — all colors come from primitives via tokens.

### Phase 3: Hudson AI panels (1 PR)

Replace Hudson AI's local mini-components:
- `SectionTitle` → `HudPanelSection`
- `ScopeBadge` → `HudBadge`
- `ActionButton` → `HudButton`
- `SurfaceTabButton` → `HudButton` with `selected` prop
- `SettingSelect` → `HudSelect` in `HudField`
- `DetailRow` → `HudListItem` with `trailing` slot
- `CapabilityRow` → `HudListItem` or `HudPanelSection` child
- `StatCard` — stays app-specific (domain layout, not a primitive)

### Phase 4: Docs panels (1 PR)

Migrate `apps/web/app/docs/` sidebar and content chrome to use `HudListItem`, `HudPanelSection`, `HudButton`.

### Phase 5 (optional): ParamPanel internals

Refactor ParamPanel to use HudInput, HudCheckbox, HudSelect internally. External API unchanged. Reduces duplicated styling logic.

## Acceptance criteria

1. All 12 components render correctly in both light and dark modes across all three templates (hudson, editorial, drafting)
2. No hardcoded color values (no `cyan-700`, `emerald-600`, etc.) — only theme tokens
3. Density prop produces visually distinct compact/default layouts
4. Day Stack migration produces no visual regression (screenshot comparison)
5. Keyboard navigation works: focus-visible rings on all interactive components, Enter/Space triggers on buttons
6. Components are tree-shakeable — importing `HudButton` alone doesn't pull in CodeEditor or ParamPanel
7. `hudsonkit/primitives` export works from both Next.js and Vite consumers

## Risks

| Risk | Mitigation |
|------|------------|
| Premature abstraction — components are too rigid for real app needs | Keep props minimal in v1. Every component accepts `className` escape hatch. Add props only when a second consumer needs them. |
| Visual regression during migration | Phase 2–4 PRs each get screenshot-compared before/after. Don't batch migrations. |
| Token coverage gaps — some app patterns use colors not in the token set | Audit Day Stack and Hudson AI patterns against `tokens.css` before implementation. If a gap exists, add the token first. |
| Bundle size — 12 new components | Each is tiny (~30–80 lines). Tree-shaking via separate entry point ensures unused components don't ship. Total estimate: <4KB gzipped for all 12. |
| ParamPanel divergence — two toggle/input implementations coexist | Acceptable for v1. Phase 5 unifies them. Document the relationship. |

## Non-goals

- Custom dropdown/popover select — native `<select>` is fine for v1
- Date picker, color picker, slider — ParamPanel already covers these for its domain
- Layout primitives (Stack, Grid, Box) — Tailwind handles layout; adding wrapper components adds indirection without value
- Animation primitives — `motion` is available for apps that need it
- Context menu — `@base-ui/react` owns this per project constraints

## References

- `packages/web/hudsonkit/src/components/controls/ParamPanel.tsx` — existing control patterns
- `packages/web/hudsonkit/src/styles/tokens.css` — CSS custom properties
- `apps/web/app/globals.css` — Tailwind theme config
- `apps/web/app/apps/day-stack/` — primary migration target
- `apps/web/app/apps/hudson-ai/HudsonAIContent.tsx` — secondary migration target (local mini-components)
- `packages/web/hudsonkit/src/lib/theme.ts` — SHELL_THEME design tokens
