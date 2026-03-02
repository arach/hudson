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
      "import type { WorkspaceAppConfig, HudsonWorkspace } from '@hudson/sdk';",
      "",
      "export const localApps: WorkspaceAppConfig[] = [];",
      "export const localWorkspaces: HudsonWorkspace[] = [];",
      "",
    ].join("\n"),
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const nextConfig: NextConfig = {
  transpilePackages: ["@hudson/sdk"],
  turbopack: {
    root: join(__dirname, ".."),
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
