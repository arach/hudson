# Hudson Paper architecture review

Date: 2026-07-16
Scope: host architecture, serve topology, Studio boundary, and local API hardening. No implementation.

## 1. Verdict

Hudson Paper's product and data architecture are worth keeping. The bootleg feel is primarily a host-boundary error, not a failure of the journey/page model: `AppShell` is told Paper is a panel app, while `PaperCanvas` creates a second canvas runtime inside that panel and then duplicates `Frame`'s world transform, zoom controls, wheel policy, and viewport reporting. For M1, use **one controlled `Frame mode="canvas"` as the sole viewport owner, with a small Paper-specific fixed HUD composed from HudsonKit chrome primitives**. Keep `paperApp` as the `HudsonApp` contract and its Provider/slots/hooks as the product boundary, but stop using panel-mode `AppShell` to host the map. Do not use `WorkspaceShell` for M1: it is technically closer than the current sandwich, but it brings multi-app/workspace/launcher/terminal/voice/settings semantics that Paper does not have. Reconsider it only if Paper actually becomes one app among several in a workspace.

| Choice | M1 judgment | Reason |
|---|---|---|
| AppShell panel + nested Canvas | Reject | Two viewport authorities and the wrong declared layout semantics |
| Frame canvas + fixed Paper HUD | **Recommend** | One transform contract; minimum product chrome; keeps the map primary |
| WorkspaceShell | Not for M1 | Correct canvas path, but materially more shell and workspace semantics than this single-purpose host needs |

The important constraint is that `PaperHost` must remain composition glue, not grow into a second general shell. If Paper later needs more generic shell features, promote a reusable canvas-app shell in HudsonKit rather than continuing to expand Paper-local chrome.

## 2. Root causes of the bootleg feel

- **Two viewport implementations.** `PaperCanvas.tsx` renders HudsonKit `Canvas`, a hand-built 50%/50% world layer, CSS `zoom`, its own `ZoomControls`, and a capture-phase wheel handler. `Frame` already owns that complete stack.
- **The declared mode contradicts the product.** `paperApp.mode` and `useLayoutMode` both say `panel`, although the main surface is an infinite map. Shell behavior, panel behavior, and viewport reporting are therefore compensating for a false premise.
- **Input behavior no longer means “Hudson canvas.”** Frame zooms on Ctrl/Cmd-wheel, clamps to 0.2–3, and supports drag plus space-drag pan. Paper zooms on plain wheel, uses Shift/Alt wheel for pan, clamps to 0.12–1.5, and adds a second sensitivity model. The same chrome now implies different muscle memory.
- **Viewport state has multiple owners.** Payload exists both locally in `PaperCanvas` and in `PaperState`; pan/scale live locally and are copied back into Provider state for chrome. Commands then cross the boundary through `window` `CustomEvent`s.
- **Fit and focus math ignores the actual visible aperture.** Initial fit uses `window.innerWidth` and only width; overlay rails can cover the result. The HUD and camera should agree on panel insets and one measured viewport.
- **The core API was extended to describe a workaround.** The new AppShell `useViewport` hook has no consumer outside Paper. It is reasonable as a future capability, but in this slice it exists because the real Frame viewport is not the viewport being used.
- **There are two incomplete map hosts.** The Paper host and Studio exhibit each reproduce Canvas/world/card composition. Their controls already differ, so fixes will continue to fork.
- **Development topology is exposed as product topology.** `hpaper serve` launches Bun plus Vite and makes the proxy the public MCP address. HMR infrastructure should not be required to run a local product tool.
- **Scaffold page content amplifies the visual weakness, but is not the architectural cause.** Re-cut the host before judging the card designs.

## 3. Recommended architecture

```text
Browser :29980
  PaperHost
    ThemeProvider
    PaperStateProvider                 one data + selection + camera owner
      Frame mode="canvas"              one grid/pan/zoom/world transform
        children: PaperWorld           journey labels + page cards only
        hud: PaperHud                  fixed HudsonKit chrome primitives
          NavigationBar
          SidePanel: maps/journeys + LeftFooter minimap
          SidePanel: inspector/tools
          StatusBar
          CommandPalette

Bun :29980                              one public process
  /, /assets/*                          built Vite host assets
  /api/*                                local library reads
  /mcp                                  MCP tools
  /health
```

### Host contract

Keep `paperApp` as a real `HudsonApp`: Provider, product slots, commands, status, inspector, and tools remain the integration contract. A thin `PaperHost` can compose those surfaces onto `Frame` and HudsonKit chrome. It should own only generic host controls such as rail collapse and palette visibility. Camera actions (`fitAll`, `focusPage`, `navigate`, zoom) should be typed callbacks in `PaperState`, not DOM events.

`PaperWorld` should render only world-space content:

- journey labels;
- absolute page cards;
- selection and double-click focus;
- `CompRenderer` with the Hudson primitive registry.

It should not import `Canvas` or `ZoomControls`, listen to wheel/keyboard/resize events, or create the 50%/50% transform.

### Wheel/pan contract

For M1, adopt the current Hudson `Frame` contract exactly:

- primary drag on empty canvas pans;
- space + primary drag pans over interactive content;
- Ctrl/Cmd-wheel (including trackpad pinch) zooms around the viewport center;
- `ZoomControls` is rendered and driven by `Frame`;
- Frame's scale bounds and sensitivity are authoritative;
- page cards remain marked interactive so selection does not accidentally start a pan.

Do not preserve Paper's plain-wheel zoom as a local exception. If plain-wheel zoom is a product-wide decision, add an explicit, tested `Frame` wheel policy later and migrate all Hudson canvases together.

Fit/focus/minimap calculations must consume the same `{pan, scale, viewport}` state as Frame. Account for open fixed rails when computing the visible aperture and zoom-control offsets; otherwise the new host will still fit content underneath its HUD.

### Serve topology

Use two named modes, not one ambiguous one:

| Command | Topology | Purpose |
|---|---|---|
| `hpaper serve` | One Bun listener serving built static assets + API + MCP | Normal user/agent runtime |
| `hpaper dev` | Bun API plus Vite HMR proxy, or an equivalent dev wrapper | Host development only |
| `hpaper serve --api-only` | One Bun listener, no UI | Headless MCP clients |

Do not make Vite middleware the only server. MCP is the durable product surface; it should not inherit the lifecycle and failure modes of a development asset server. A Vite build step is fine, but Vite should not remain a runtime dependency of normal `serve`.

## 4. Keep / cut

### Freeze

- `model.ts`: journeys, pages, primitive trees, tokens, packs, and layout semantics.
- MCP tool vocabulary and the agent-first happy path.
- Local library and atomic-replace write strategy (with concurrency hardening noted below).
- `CompRenderer` and the closed primitive registry.
- `paperApp`'s Provider/slots/hooks shape and HudsonApp identity.
- Left rail information architecture, `LeftFooter` minimap convention, inspector content, settings intent, status copy, URL deep links.
- Paper-specific tokens and restrained visual conventions.

### Rewrite or remove from the host

- Rewrite `PaperCanvas` as `PaperWorld`; remove nested `Canvas`, manual world wrapper, custom wheel handling, local zoom controls, and local viewport measurement.
- Move loading and camera state to one Provider/host controller; remove the local/global payload duplication.
- Replace `paper:*` `CustomEvent`s with typed context callbacks and host controls.
- Replace top-level panel-mode `AppShell` with the Frame-based Paper host.
- Revert the new core `useViewport` hook in this PR unless another independent Hudson consumer justifies it; Frame-owned viewport data no longer needs to be tunneled through AppShell.
- Keep Vite aliases/build plumbing only as development/build infrastructure; do not let them define the runtime architecture.

## 5. Studio exhibit

**Demote, do not polish or expand in M1.** Keep it as a developer exhibit/conformance surface if it is useful, but stop presenting it as the primary glance host or as “deep work” until it has a capability the Paper host lacks (especially editing). Primary links should open Paper directly with `?file=&page=`. Remove `open_in_studio` from the documented happy path or describe it honestly as an optional preview handoff.

The exhibit should eventually either:

1. import a shared `PaperWorld`/renderer and remain a thin preview, or
2. become a real editor with a distinct purpose.

Maintaining a second hand-built canvas viewer is the worst middle state.

## 6. PR sequence (three maximum)

### PR 1 — One viewport owner

**Outcome:** Paper feels like a Hudson canvas because it is hosted by Hudson Frame.

- Add the Frame-based Paper host and convert `PaperCanvas` to world-only content.
- Centralize payload, selection, camera state, and typed camera actions.
- Preserve rails, minimap, inspector, palette, status, settings, and deep links.
- Delete custom wheel/world/ZoomControls/CustomEvent plumbing.
- Remove the compensating AppShell `useViewport` change unless retained for an independently demonstrated consumer.

Acceptance: exactly one `Frame`/`Canvas` viewport; Hudson drag, space-pan, Ctrl/Cmd-wheel, zoom controls, fit-all, focus, minimap navigation, and URL state all use the same camera.

### PR 2 — One production endpoint + local hardening

**Outcome:** `hpaper serve` is one stable process and one same-origin URL.

- Build the host to static assets and serve them from Bun alongside `/api`, `/mcp`, and `/health`.
- Add a separate `hpaper dev` HMR topology.
- Keep `--api-only`; make shutdown and port behavior explicit.
- Add origin/host/path validation, request limits, and API response cleanup.
- Verify health, static fallback, MCP initialize/tools/list/call, and graceful shutdown.

### PR 3 — Clarify the Studio boundary

**Outcome:** one canonical Paper glance experience.

- Make Paper deep links primary in tools/docs.
- Demote Studio to an optional developer exhibit, or make it consume the shared world renderer.
- Remove duplicate canvas claims and stale happy-path copy.

PR 3 can be skipped if the docs/tool wording is folded into PR 1 and the duplicate exhibit is left explicitly non-primary.

## 7. Risks and security/path notes

- **Bespoke-shell creep:** direct Frame is correct only if `PaperHost` stays small. Do not rebuild terminal, workspace switching, assistant, or generic settings there.
- **Core behavior mismatch:** accepting Frame's existing 0.2–3 and modifier-wheel policy may change current Paper muscle memory. That is intentional; document it and test it.
- **HUD occlusion:** fixed overlay rails need to feed fit/focus aperture and zoom-control offsets.
- **State migration:** persisted Paper settings are safe to keep; do not blindly reuse camera state from the old transform without validating coordinate semantics.
- **Remote exposure:** `--host` can currently bind an unauthenticated read/write MCP and file API beyond loopback. Refuse non-loopback by default or require an explicit unsafe/remote mode with authentication.
- **Over-broad CORS:** REST returns `Access-Control-Allow-Origin: *`, including map contents and handoffs. Prefer same-origin plus an allowlisted Studio origin; validate browser `Origin` on MCP mutations when present.
- **Path traversal:** `loadHandoff()` joins a decoded, unsanitized `handoffId` into the handoff directory. An encoded slash can produce `../` after route matching. Validate IDs against one strict grammar and enforce resolved-path containment for both files and handoffs.
- **Identifier collisions:** `store.filePath()` silently replaces unsafe characters with `_`, so different external IDs can alias the same file. Reject invalid IDs rather than normalizing them.
- **Filesystem disclosure:** `GET /api/files` currently exposes each absolute local `path`. Keep that field CLI-only.
- **Unbounded input/data:** add request body and tree depth/node-count limits plus full schema validation before rendering or saving agent-provided props.
- **Lost updates:** atomic rename prevents torn files, not concurrent read-modify-write loss across MCP sessions. Add a per-file write queue or revision/compare-and-swap before multi-agent editing is claimed.

## Verification performed

- Inspected the Paper host, Hudson `Frame`/`Canvas`, AppShell, WorkspaceShell, Studio exhibit, CLI/server, store, and REST paths in the current checkout.
- Confirmed the live runtime is Bun on `127.0.0.1:29982` behind Vite on `127.0.0.1:29980` and that `/health` and `/api/files` respond.
- `bun run --cwd packages/tools/hudson-paper typecheck` passes.
