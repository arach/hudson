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

/** Electrobun's views:// protocol rejects 0-byte files. Pad empty CSS. */
function padEmptyCss(): Plugin {
  return {
    name: "pad-empty-css",
    async writeBundle(options) {
      const fs = await import("fs");
      const outDir = options.dir || path.resolve(__dirname, "dist/mainview");
      const assetsDir = path.join(outDir, "assets");
      if (!fs.existsSync(assetsDir)) return;
      for (const file of fs.readdirSync(assetsDir)) {
        if (!file.endsWith(".css")) continue;
        const fp = path.join(assetsDir, file);
        const stat = fs.statSync(fp);
        if (stat.size === 0) fs.writeFileSync(fp, "/* empty */");
      }
    },
  };
}

export default defineConfig({
  root: "src/mainview",
  plugins: [
    stubCssImports(["../../app/docs/docs.css"]),
    react(),
    tailwindcss(),
    padEmptyCss(),
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
  base: "./",
  build: {
    outDir: "../../dist/mainview",
    emptyOutDir: true,
  },
  server: {
    port: 5188,
    strictPort: true,
  },
});
