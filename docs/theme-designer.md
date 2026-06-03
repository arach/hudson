---
title: Theme Designer
description: The HudsonKit surface for editing the template and theme matrix
order: 19
section: Design System
---

# Theme Designer

Theme Designer is the canonical HudsonKit surface for editing the template/theme matrix in `packages/web/hudsonkit/src/styles/tokens.css`.

## OKLCH model

HudsonKit stores shadcn-compatible color tokens as OKLCH triplets without the `oklch()` wrapper:

```css
--background: 0.20 0.02 240;
--accent: 0.72 0.18 60;
```

The designer exposes those values as:

- **L** lightness, `0 → 1`
- **C** chroma, `0 → 0.4`
- **H** hue, `0 → 360`
- **A** optional alpha for derived `*-soft` / `*-line` tokens or existing alpha values

Raw text is always available for aliases such as `oklch(var(--accent) / 0.12)`, shadows, radii, fonts, and RGBA canvas-dot tokens. Slider edits round to stable OKLCH values so exported CSS stays diff-friendly.

## Save to `tokens.css`

In development, the app can write a new template id back to:

```text
packages/web/hudsonkit/src/styles/tokens.css
```

The save API is dev-gated and rejects the built-in ids (`hudson`, `editorial`, `drafting`). Save under a new kebab-case id instead. The emitter writes one block per theme:

```css
[data-hudson-template="example"][data-hudson-theme="dark"] {
  color-scheme: dark;
  --background: 0.20 0.02 240;
  /* ... */
}
```

Variables are emitted in a stable semantic order: canvas, surface, ink, accent, status, shape, and type.

## `?ref=` links

Embeds apply themes by setting `data-hudson-template` and `data-hudson-theme` on `<html>`. The designer exports a deep link in this form:

```text
/embed/hudson/workspace?ref=<id>
```

When "Register ?ref preset" is enabled during a dev save, the app adds a consumer entry to `app/embed/registry.ts` that maps the ref id to the saved template and selected light/dark default. Consumers can then use that `?ref=<id>` URL without hand-writing palette overrides.

## Multi-tenant theming

Because `[data-hudson-template="..."][data-hudson-theme="..."]` selectors match at arbitrary DOM depth, not just on `<html>`, nesting two distinctly-themed subtrees in one document is fully supported. Each subtree's CSS custom properties cascade independently, so a `drafting` dark embed and a `hudson` dark embed can coexist in the same tab with no token bleed between them. A live demo of this pattern lives at `/demo/multi-theme`.

```tsx
<div data-hudson-template="hudson" data-hudson-theme="dark">
  {/* hudson-themed subtree */}
  <div data-hudson-template="editorial" data-hudson-theme="light">
    {/* editorial-themed sub-subtree */}
  </div>
</div>
```
