// ─────────────────────────────────────────────────────────────────────────────
// Preframe catalog — fallback stub
// ─────────────────────────────────────────────────────────────────────────────
// `preframe` is an optional sibling repo (~/dev/preframe) that is not checked
// out everywhere. registry.ts imports its catalog through the stable
// `@preframe/catalog` specifier; next.config.ts aliases that specifier to the
// real catalog when the sibling exists, or to this stub when it doesn't.
//
// Resolving to a stub (instead of a missing relative path) is what keeps both
// Turbopack and webpack from emitting a "Module not found" warning every
// compile. getPreframeAppConfig() reads `catalogApp`/`preframeApp`/`default`,
// finds nothing here, and gracefully skips the app.
// ─────────────────────────────────────────────────────────────────────────────

export const catalogApp = null;
