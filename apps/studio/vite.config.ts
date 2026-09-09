import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const hudsonRoot = fileURLToPath(new URL("../..", import.meta.url));
const studioRoot = process.env.STUDIO_PACKAGE_ROOT
  ? path.resolve(process.env.STUDIO_PACKAGE_ROOT)
  : fileURLToPath(new URL("../../../studio", import.meta.url));
const hudsonNodeModules = path.join(hudsonRoot, "node_modules");
// studio$ = exact package root only. A bare "studio" alias to index.ts breaks
// CSS imports (studio/theme.css → index.ts/theme.css ENOTDIR).
const singletonAliases = [
  {
    find: "studio/theme.css",
    replacement: path.join(studioRoot, "src/theme/aliases.css"),
  },
  {
    find: "studio/doc.css",
    replacement: path.join(studioRoot, "src/doc/eng-doc.css"),
  },
  {
    find: "studio/shell.css",
    replacement: path.join(studioRoot, "src/shell/shell.css"),
  },
  {
    find: "studio/injection.css",
    replacement: path.join(studioRoot, "src/injection/styles.css"),
  },
  {
    find: "studio/flows/styles.css",
    replacement: path.join(studioRoot, "src/flows/styles.css"),
  },
  {
    find: "studio/flows",
    replacement: path.join(studioRoot, "src/flows/index.ts"),
  },
  {
    find: /^studio$/,
    replacement: path.join(studioRoot, "src/index.ts"),
  },
  // Studio Flows imports hudsonkit primitives from source.
  {
    find: "hudsonkit/styles/tokens.css",
    replacement: path.join(
      hudsonRoot,
      "packages/web/hudsonkit/src/styles/tokens.css",
    ),
  },
  {
    find: "hudsonkit/app-shell",
    replacement: path.join(hudsonRoot, "packages/web/hudsonkit/src/app-shell.ts"),
  },
  {
    find: "hudsonkit/canvas",
    replacement: path.join(hudsonRoot, "packages/web/hudsonkit/src/canvas.ts"),
  },
  {
    find: "hudsonkit/chrome",
    replacement: path.join(hudsonRoot, "packages/web/hudsonkit/src/chrome.ts"),
  },
  {
    find: "hudsonkit/primitives",
    replacement: path.join(hudsonRoot, "packages/web/hudsonkit/src/primitives.ts"),
  },
  {
    find: "hudsonkit/theme",
    replacement: path.join(hudsonRoot, "packages/web/hudsonkit/src/theme.ts"),
  },
  {
    find: "hudsonkit/overlays",
    replacement: path.join(hudsonRoot, "packages/web/hudsonkit/src/overlays.ts"),
  },
  {
    find: /^hudsonkit$/,
    replacement: path.join(hudsonRoot, "packages/web/hudsonkit/src/index.ts"),
  },
  {
    find: /^hudsonkit\/(.*)$/,
    replacement: path.join(hudsonRoot, "packages/web/hudsonkit/src/$1"),
  },
  { find: "react", replacement: path.join(hudsonNodeModules, "react") },
  {
    find: "react/jsx-runtime",
    replacement: path.join(hudsonNodeModules, "react", "jsx-runtime.js"),
  },
  {
    find: "react/jsx-dev-runtime",
    replacement: path.join(hudsonNodeModules, "react", "jsx-dev-runtime.js"),
  },
  { find: "react-dom", replacement: path.join(hudsonNodeModules, "react-dom") },
  {
    find: "react-dom/client",
    replacement: path.join(hudsonNodeModules, "react-dom", "client.js"),
  },
  { find: "ai", replacement: path.join(hudsonNodeModules, "ai") },
  {
    find: "@ai-sdk/react",
    replacement: path.join(hudsonNodeModules, "@ai-sdk", "react"),
  },
];

// Surfaces filesystem mtimes for engineering markdown as `virtual:eng-mtimes`.
// import.meta.glob has no mtime channel; this plugin closes that gap so the
// content loaders can sort by recency without a separate build step.
function engMtimesPlugin(): Plugin {
  const VIRTUAL_ID = "virtual:eng-mtimes";
  const RESOLVED_ID = "\0virtual:eng-mtimes";
  const SOURCES = [
    "docs",
    "docs/specs",
    "packages/native/apple/HudsonKit/Docs",
  ];

  function build(): Record<string, number> {
    const mtimes: Record<string, number> = {};
    for (const rel of SOURCES) {
      const dir = path.join(hudsonRoot, rel);
      if (!fs.existsSync(dir)) continue;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
        const key = `${rel}/${entry.name}`;
        mtimes[key] = fs.statSync(path.join(dir, entry.name)).mtimeMs;
      }
    }
    return mtimes;
  }

  return {
    name: "eng-mtimes",
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      return `export default ${JSON.stringify(build())};`;
    },
  };
}

const studioNodeModules = path.join(studioRoot, "node_modules");

export default defineConfig({
  plugins: [react(), engMtimesPlugin()],
  resolve: {
    // false so nested deps under studio/node_modules resolve correctly when
    // following the linked studio package (codemirror / react-markdown tree).
    preserveSymlinks: false,
    dedupe: ["react", "react-dom"],
    alias: singletonAliases,
  },
  server: {
    port: 3033,
    fs: {
      allow: [hudsonRoot, studioRoot, studioNodeModules],
    },
    proxy: {
      // Studio Flows service + discuss, kept same-origin for the browser.
      "/api": {
        target: process.env.STUDIO_FLOWS_API_ORIGIN ?? "http://127.0.0.1:29982",
        changeOrigin: true,
      },
      "/mcp": {
        target: process.env.STUDIO_FLOWS_API_ORIGIN ?? "http://127.0.0.1:29982",
        changeOrigin: true,
      },
      "/health": {
        target: process.env.STUDIO_FLOWS_API_ORIGIN ?? "http://127.0.0.1:29982",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ["studio", "hudsonkit"],
    // hudsonkit is excluded so it stays linked to source, which means Vite
    // doesn't scan its transitive deps. xterm is loaded by a dynamic import
    // inside hudsonkit's TerminalRelay — we need to include it explicitly
    // so Vite pre-bundles it for the browser.
    include: ["@xterm/xterm", "@xterm/addon-fit"],
  },
});
