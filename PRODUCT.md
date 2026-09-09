# Hudson

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Hudson serves local developers and technical operators who work across live terminals, applications, sessions, and project artifacts. They use it while actively building and supervising work, primarily from a desktop with keyboard and pointer input.

## Product Purpose

Hudson provides a shared shell and spatial workspace where multiple applications and live runtime surfaces can coexist without losing their individual state or context. Success means users can see, arrange, focus, inspect, and resume live work without translating it into a separate dashboard.

## Positioning

Hudson treats applications, terminal sessions, and artifacts as directly manipulable spatial surfaces on a persistent canvas. HudsonKit supplies the shared shell, windowing, navigation, and behavior contracts while each application continues to own its state and product logic.

## Operating Context

- Native macOS Canvas workspaces host live local PTY and tmux-backed terminal sessions, inspectors, navigation, minimaps, and persistent window arrangements.
- React workspaces host Hudson applications in panel or infinite-canvas layouts through the `HudsonApp` contract.
- Users move between broad workspace awareness and focused interaction with one live surface.
- Workspace state, window geometry, and relevant application state persist across reloads or relaunches where the host supports it.

## Capabilities and Constraints

- Apps own state through their Provider; the shell owns shared chrome and renders app-provided slots and hooks.
- The Canvas supports pan, zoom, selection, draggable and resizable windows, focus, inspection, and live terminal runtime surfaces.
- Web tooling uses Bun and custom Hudson components. Base UI may supply headless behavior, but Hudson owns the visual register.
- Native Apple surfaces use SwiftUI/AppKit and HudsonKit's shared shell, tokens, and primitives.
- Existing information architecture and behavior are product assets. A visual refinement must not hide state, weaken familiar affordances, or replace direct manipulation with decorative abstraction.

## Brand Commitments

- Product names are Hudson and HudsonKit.
- The current interface is a valued foundation; refinements should increase craft and clarity without discarding its recognizable structure.
- Hudson does not use purple. Cyan, blue, teal, and emerald are the sanctioned accent ranges.
- The product voice is concise, technical, and operational rather than promotional.

## Evidence on Hand

- Current native Canvas reference: `/Users/art/Library/Application Support/Talkie.dev/Screenshots/Talkie Capture - 2026-08-23 12.17.23 - Window HudsonApp - 1720x1410 - 85cd82c8 t71886ms.png`
- Native Canvas implementation: `packages/native/apple/HudsonKit/Sources/HudsonCanvasSurface/`
- Native shell implementation: `packages/native/apple/HudsonKit/Sources/HudsonShell/`
- Interactive web Canvas exhibit: `apps/studio/src/exhibits/canvas-terminals/CanvasTerminalsExhibit.tsx`
- Shared visual tokens: `packages/native/apple/HudsonKit/Sources/HudsonUI/Tokens/` and `packages/web/hudsonkit/src/lib/theme.ts`

## Product Principles

1. Keep live work directly manipulable.
2. Preserve spatial context while moving between overview and focus.
3. Let applications own their state while the shell provides coherent shared behavior.
4. Show real runtime state rather than decorative approximations.
5. Adapt to each platform's native interaction model without fragmenting the product language.

## Accessibility & Inclusion

Core workflows must remain operable with keyboard and pointer input, expose stable labels and focus states, maintain readable contrast, and respect reduced-motion preferences. Visual hierarchy must not rely on color alone.
