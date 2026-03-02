import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

/**
 * Stub out CSS files that use theme() and are imported via JS side-effects.
 * In the Next.js build Tailwind processes them within the full theme context;
 * in our standalone Vite build they'd be compiled in isolation and fail.
 * The styles are already covered by the Tailwind utility classes.
 */
function stubCssImports(files: string[]): Plugin {
  const resolved = new Set(files.map((f) => path.resolve(__dirname, f)));
  return {
    name: "stub-css-imports",
    enforce: "pre",
    load(id) {
      if (resolved.has(id)) return "/* stubbed for native build */";
    },
  };
}

export default defineConfig({
  root: "src/mainview",
  plugins: [
    stubCssImports(["../../app/docs/docs.css"]),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@hudson/sdk/styles": path.resolve(__dirname, "../../packages/hudson-sdk/src/styles/frame.css"),
      "@hudson/sdk/shell": path.resolve(__dirname, "../../packages/hudson-sdk/src/shell.ts"),
      "@hudson/sdk": path.resolve(__dirname, "../../packages/hudson-sdk/src/index.ts"),
      "@hudson/shell": path.resolve(__dirname, "../../app/shell"),
      "@hudson/apps": path.resolve(__dirname, "../../app/apps"),
      "@/": path.resolve(__dirname, "../../") + "/",
      "next/image": path.resolve(__dirname, "src/mainview/shims/next-image.tsx"),
    },
  },
  publicDir: path.resolve(__dirname, "../../public"),
  build: {
    outDir: "../../dist/mainview",
    emptyOutDir: true,
  },
  server: {
    port: 5188,
    strictPort: true,
  },
});
