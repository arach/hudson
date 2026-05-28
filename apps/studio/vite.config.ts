import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const hudsonRoot = fileURLToPath(new URL("../..", import.meta.url));
const studioRoot = fileURLToPath(new URL("../../../studio", import.meta.url));

// Surfaces filesystem mtimes for engineering markdown as `virtual:eng-mtimes`.
// import.meta.glob has no mtime channel; this plugin closes that gap so the
// content loaders can sort by recency without a separate build step.
function engMtimesPlugin(): Plugin {
  const VIRTUAL_ID = "virtual:eng-mtimes";
  const RESOLVED_ID = "\0virtual:eng-mtimes";
  const SOURCES = [
    "docs",
    "specs",
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

export default defineConfig({
  plugins: [react(), engMtimesPlugin()],
  server: {
    port: 3033,
    fs: {
      allow: [hudsonRoot, studioRoot],
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
