import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const hostRoot = fileURLToPath(new URL(".", import.meta.url));
const packageRoot = path.join(hostRoot, "..");
const hudsonRoot = path.join(packageRoot, "../../..");
const hudsonkitRoot = path.join(hudsonRoot, "packages/web/hudsonkit");
const studioAppRoot = path.join(hudsonRoot, "apps/studio");
const hudsonNodeModules = path.join(hudsonRoot, "node_modules");

const apiPort = Number(process.env.HUDSON_PAPER_API_PORT ?? 29982);
const publicPort = Number(process.env.HUDSON_PAPER_PORT ?? 29980);

export default defineConfig({
  root: hostRoot,
  plugins: [react()],
  resolve: {
    preserveSymlinks: false,
    dedupe: ["react", "react-dom"],
    alias: [
      // Specific subpaths first (before generic hudsonkit/*)
      {
        find: "hudsonkit/styles/tokens.css",
        replacement: path.join(hudsonkitRoot, "src/styles/tokens.css"),
      },
      {
        find: "hudsonkit/app-shell",
        replacement: path.join(hudsonkitRoot, "src/app-shell.ts"),
      },
      {
        find: "hudsonkit/canvas",
        replacement: path.join(hudsonkitRoot, "src/canvas.ts"),
      },
      {
        find: "hudsonkit/chrome",
        replacement: path.join(hudsonkitRoot, "src/chrome.ts"),
      },
      {
        find: "hudsonkit/primitives",
        replacement: path.join(hudsonkitRoot, "src/primitives.ts"),
      },
      {
        find: "hudsonkit/theme",
        replacement: path.join(hudsonkitRoot, "src/theme.ts"),
      },
      {
        find: "hudsonkit/overlays",
        replacement: path.join(hudsonkitRoot, "src/overlays.ts"),
      },
      // Shared Studio design surfaces (absolute — avoid fragile relative paths)
      {
        find: "@paper-designs/candidate-orientation",
        replacement: path.join(
          studioAppRoot,
          "src/exhibits/fieldwork/CandidateOrientation.tsx",
        ),
      },
      {
        find: /^hudsonkit$/,
        replacement: path.join(hudsonkitRoot, "src/index.ts"),
      },
      {
        find: /^hudsonkit\/(.*)$/,
        replacement: path.join(hudsonkitRoot, "src/$1"),
      },
      { find: "react", replacement: path.join(hudsonNodeModules, "react") },
      {
        find: "react/jsx-runtime",
        replacement: path.join(hudsonNodeModules, "react/jsx-runtime.js"),
      },
      {
        find: "react/jsx-dev-runtime",
        replacement: path.join(hudsonNodeModules, "react/jsx-dev-runtime.js"),
      },
      {
        find: "react-dom",
        replacement: path.join(hudsonNodeModules, "react-dom"),
      },
      {
        find: "react-dom/client",
        replacement: path.join(hudsonNodeModules, "react-dom/client.js"),
      },
      {
        find: "lucide-react",
        replacement: path.join(hudsonNodeModules, "lucide-react"),
      },
    ],
  },
  server: {
    host: process.env.HUDSON_PAPER_HOST ?? "127.0.0.1",
    port: publicPort,
    strictPort: true,
    fs: {
      // Studio exhibits are imported into map cards (shared design source).
      allow: [
        packageRoot,
        hudsonkitRoot,
        hudsonRoot,
        hudsonNodeModules,
        studioAppRoot,
      ],
    },
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
      "/mcp": {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
      "/health": {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
      "/view": {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
      "/browse": {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ["hudsonkit"],
  },
});
