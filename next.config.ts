import type { NextConfig } from "next";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

// ─────────────────────────────────────────────────────────────────────────────
// Auto-create app/local/apps.local.ts if missing
// ─────────────────────────────────────────────────────────────────────────────
// The local directory is gitignored and holds developer-specific app
// registrations. On a fresh clone this file won't exist, so we create an
// empty stub so the import in app/apps/registry.ts always resolves.
// See app/catalog/apps.local.example.ts for a full working template.
// ─────────────────────────────────────────────────────────────────────────────

const localDir = join(__dirname, "app", "local");
const localAppsFile = join(localDir, "apps.local.ts");

if (!existsSync(localDir)) {
  mkdirSync(localDir, { recursive: true });
}

if (!existsSync(localAppsFile)) {
  writeFileSync(
    localAppsFile,
    [
      "// ─────────────────────────────────────────────────────────────────────────",
      "// Local App Registration (gitignored)",
      "// ─────────────────────────────────────────────────────────────────────────",
      "// Add your apps here to load them into the Hudson workspace.",
      "// This file is auto-created on first run and never committed to git.",
      "//",
      "// For a full working example, see: app/catalog/apps.local.example.ts",
      "// ─────────────────────────────────────────────────────────────────────────",
      "",
      "import type { WorkspaceAppConfig, HudsonWorkspace } from 'hudsonkit';",
      "",
      "export const localApps: WorkspaceAppConfig[] = [];",
      "export const localWorkspaces: HudsonWorkspace[] = [];",
      "",
    ].join("\n"),
  );
}

const localWorkspacesFile = join(localDir, "workspaces.json");
if (!existsSync(localWorkspacesFile)) {
  writeFileSync(localWorkspacesFile, "[]\n");
}

// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// turbopack.root
// ─────────────────────────────────────────────────────────────────────────────
// Default: the Hudson repo root (__dirname).
//
// The previous default — `join(__dirname, "..")` — pulled every sibling repo
// under ../ into Turbopack's watch graph. That dramatically expanded the
// FSEvents queue, multiplied watcher counts when consumers added their own
// dev servers, and contributed to the May runaway-watcher incident.
//
// If you genuinely need the broader root (e.g. you're integrating a sibling
// sandbox app from ../some-app while iterating in-tree), set
// HUDSON_TURBOPACK_PARENT=1 in your shell. The opt-in keeps the dangerous
// scope explicit per-shell instead of baked into the repo for everyone.
// ─────────────────────────────────────────────────────────────────────────────
const turbopackRoot = process.env.HUDSON_TURBOPACK_PARENT === "1"
  ? join(__dirname, "..")
  : __dirname;

const nextConfig: NextConfig = {
  transpilePackages: ["hudsonkit", "@voxd/client"],
  serverExternalPackages: ["@earendil-works/pi-ai", "esbuild"],
  turbopack: {
    root: turbopackRoot,
    resolveAlias: {
      tailwindcss: join(__dirname, "node_modules", "tailwindcss"),
    },
  },
  async rewrites() {
    return [
      { source: "/llms.txt", destination: "/api/llms-txt" },
      { source: "/llms-full.txt", destination: "/api/llms-full-txt" },
    ];
  },
};

export default nextConfig;
