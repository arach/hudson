import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { atelierHostServicesPlugin } from "./vite.host-services";

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
  // Transitional access for host shell internals that have not graduated into
  // hudsonkit yet. App bundles come from hudson-showroom, not app/apps.
  "@apps": path.join(hudsonRoot, "app", "apps"),
  // Mount Hudson's real host shell while the shell package boundary moves.
  "@app": path.join(hudsonRoot, "app"),
  // Match the main Next tsconfig "@/..." alias when mounting host code in Vite.
  "@": hudsonRoot,
};

export default defineConfig({
  plugins: [react(), atelierHostServicesPlugin({ hudsonRoot })],
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
    "process.env.PORT": JSON.stringify(process.env.PORT ?? "3500"),
    "process.env.NEXT_PUBLIC_HUDSON_EMBED_ORIGINS": JSON.stringify(
      process.env.NEXT_PUBLIC_HUDSON_EMBED_ORIGINS ?? "",
    ),
  },
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
    // these transitive deps, so they'd be served raw; `use-sync-external-store`
    // is a CJS module whose named export hides behind a NODE_ENV conditional, which
    // breaks ESM interop unless we pre-bundle it. Force-include the offenders:
    //   - use-sync-external-store/shim: pulled by @base-ui-components + swr
    //   - @base-ui-components/react: the kit's context-menu / media-query
    //   - xterm: dynamic-imported by hudsonkit's terminal
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
