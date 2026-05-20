// ---------------------------------------------------------------------------
// HudsonApp.backend — per-app backend convention (HUD-008)
//
// Apps declare a backend namespace + storage namespace through the manifest
// so hudsonkit can derive defaults (`/api/{app.id}`, `~/hudson/{app.id}/.data`)
// without copy/paste plumbing on each route. See specs/hud-008-app-backends.md.
// ---------------------------------------------------------------------------

export interface HudsonAppBackend {
  /** HTTP API base. Defaults to `/api/${app.id}`. May be absolute for a sibling service. */
  apiBase?: string;

  /**
   * Storage namespace under `~/hudson/{dataDir}/.data` and `{project}/.data/{dataDir}`.
   * Defaults to `app.id`.
   *
   * Namespace-only: a single relative directory name, not an absolute path. No
   * separators, no `..`. Use only for genuine off-default storage namespaces,
   * not to preserve grandfathered paths.
   */
  dataDir?: string;

  /**
   * Optional health endpoint used by createAppApiClient.
   * Omit for same-origin Hudson routes. Provide e.g. `/api/health` for sibling services.
   */
  healthCheck?: string;

  /** Optional request timeout for health probes. Defaults to 2_000ms. */
  healthTimeoutMs?: number;
}
