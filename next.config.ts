import type { NextConfig } from "next";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, relative, sep } from "path";

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

const rootNodeModules = join(__dirname, "node_modules");
const turbopackRoot = join(__dirname, "..");
const singletonAliases = {
  "react": join(rootNodeModules, "react"),
  "react/jsx-runtime": join(rootNodeModules, "react", "jsx-runtime.js"),
  "react/jsx-dev-runtime": join(rootNodeModules, "react", "jsx-dev-runtime.js"),
  "react-dom": join(rootNodeModules, "react-dom"),
  "react-dom/client": join(rootNodeModules, "react-dom", "client.js"),
  "ai": join(rootNodeModules, "ai"),
  "@ai-sdk/react": join(rootNodeModules, "@ai-sdk", "react"),
  "lucide-react": join(rootNodeModules, "lucide-react"),
};
const toTurbopackAliasPath = (target: string) => {
  const rel = relative(turbopackRoot, target).split(sep).join("/");
  return rel.startsWith(".") ? rel : `./${rel}`;
};
const turbopackSingletonAliases = Object.fromEntries(
  Object.entries(singletonAliases).map(([key, target]) => [key, toTurbopackAliasPath(target)]),
);

const nextConfig: NextConfig = {
  transpilePackages: ["hudsonkit", "@voxd/client"],
  serverExternalPackages: ["@earendil-works/pi-ai", "esbuild"],
  turbopack: {
    root: turbopackRoot,
    resolveAlias: {
      ...turbopackSingletonAliases,
      tailwindcss: toTurbopackAliasPath(join(rootNodeModules, "tailwindcss")),
    },
  },
  webpack(config) {
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      ...singletonAliases,
    };
    return config;
  },
  async rewrites() {
    return [
      { source: "/llms.txt", destination: "/api/llms-txt" },
      { source: "/llms-full.txt", destination: "/api/llms-full-txt" },
    ];
  },
};

export default nextConfig;
