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
const useParentRoot = process.env.HUDSON_TURBOPACK_PARENT === "1";
const turbopackRoot = useParentRoot ? join(__dirname, "..") : __dirname;
const rootNodeModules = join(__dirname, "node_modules");
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

// ─────────────────────────────────────────────────────────────────────────────
// Optional sibling app: ~/dev/preframe
// ─────────────────────────────────────────────────────────────────────────────
// registry.ts imports the preframe catalog through the stable `@preframe/catalog`
// specifier, which we alias here to either the real catalog or a local stub.
//
// preframe lives at ../preframe — OUTSIDE the default Turbopack root (__dirname).
// It only resolves when the root is broadened to the parent via
// HUDSON_TURBOPACK_PARENT=1 (the same opt-in that pulls sibling repos in). So we
// point at the real catalog only in parent-root, non-production mode; otherwise
// we point at the stub. Aliasing to a real, in-root module (the stub) is what
// stops Turbopack from reporting "Module not found" on every default `bun dev`,
// and keeps preframe out of production bundles. The runtime gate in registry.ts
// (IS_DEV_ENV + null catalog) then gracefully skips the app.
// ─────────────────────────────────────────────────────────────────────────────
const preframeStub = join(__dirname, "app", "catalog", "preframe-catalog.stub.ts");
const preframeEnabled = useParentRoot && process.env.NODE_ENV !== "production";
const preframeCatalog = preframeEnabled
  ? ([
      join(__dirname, "..", "preframe", "catalog.ts"),
      join(__dirname, "..", "preframe", "catalog.tsx"),
      join(__dirname, "..", "preframe", "catalog", "index.ts"),
      join(__dirname, "..", "preframe", "catalog.js"),
      join(__dirname, "..", "preframe", "catalog", "index.js"),
    ].find((candidate) => existsSync(candidate)) ?? preframeStub)
  : preframeStub;

const nextConfig: NextConfig = {
  transpilePackages: ["hudsonkit", "@voxd/client"],
  serverExternalPackages: ["@earendil-works/pi-ai", "esbuild"],
  turbopack: {
    root: turbopackRoot,
    resolveAlias: {
      ...turbopackSingletonAliases,
      tailwindcss: toTurbopackAliasPath(join(rootNodeModules, "tailwindcss")),
      "@preframe/catalog": toTurbopackAliasPath(preframeCatalog),
    },
  },
  webpack(config) {
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      ...singletonAliases,
      "@preframe/catalog": preframeCatalog,
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
