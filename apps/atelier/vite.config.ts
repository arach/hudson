import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Atelier links `hudsonkit` from source (../../packages/web/hudsonkit). The kit
// declares react / react-dom / ai / lucide-react as peers; to keep a single
// instance of each across the linked kit and this app, alias them to Hudson's
// root node_modules. Without this you get duplicate React → invalid hook calls.
const hudsonRoot = fileURLToPath(new URL("../..", import.meta.url));
const hudsonNodeModules = path.join(hudsonRoot, "node_modules");
const singletonAliases = {
  react: path.join(hudsonNodeModules, "react"),
  "react/jsx-runtime": path.join(hudsonNodeModules, "react", "jsx-runtime.js"),
  "react/jsx-dev-runtime": path.join(hudsonNodeModules, "react", "jsx-dev-runtime.js"),
  "react-dom": path.join(hudsonNodeModules, "react-dom"),
  "react-dom/client": path.join(hudsonNodeModules, "react-dom", "client.js"),
  ai: path.join(hudsonNodeModules, "ai"),
  "@ai-sdk/react": path.join(hudsonNodeModules, "@ai-sdk", "react"),
  "lucide-react": path.join(hudsonNodeModules, "lucide-react"),
  // Reach Hudson's real apps (app/apps/*) so Atelier can mount Shaper / Logo
  // exactly as Hudson does — proving they're portable, not reimplemented.
  "@apps": path.join(hudsonRoot, "app", "apps"),
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    preserveSymlinks: true,
    dedupe: ["react", "react-dom"],
    alias: singletonAliases,
  },
  server: {
    port: 3034,
    fs: {
      // Allow serving the linked kit source + root node_modules.
      allow: [hudsonRoot],
    },
  },
  optimizeDeps: {
    // Keep hudsonkit linked to source so Vite doesn't scan its transitive deps.
    exclude: ["hudsonkit"],
    // Because hudsonkit is excluded, Vite never traverses into it to discover
    // these transitive deps, so they'd be served raw — and `use-sync-external-store`
    // is a CJS module whose named export hides behind a NODE_ENV conditional, which
    // breaks ESM interop unless we pre-bundle it. Force-include the offenders:
    //   - use-sync-external-store/shim — pulled by @base-ui-components + swr
    //   - @base-ui-components/react    — the kit's context-menu / media-query
    //   - xterm                        — dynamic-imported by hudsonkit's terminal
    include: [
      "@xterm/xterm",
      "@xterm/addon-fit",
      "use-sync-external-store/shim",
      "use-sync-external-store/shim/with-selector",
      "@base-ui-components/react",
      // Pre-bundle the AI SDK up front; otherwise Vite discovers it mid-load
      // (the kit's assistant graph) and forces a full-page reload on first visit.
      "@ai-sdk/react",
      "ai",
    ],
  },
});
