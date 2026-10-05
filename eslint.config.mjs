import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    "**/.next/**",
    ".claude/**",
    ".data/**",
    "**/out/**",
    "apps/web/site/out/**",
    "build/**",
    "apps/web/public/embed/**",
    "**/next-env.d.ts",
    // Build artifacts and generated bundles — never lint these.
    "**/dist/**",
    "**/dist-dev/**",
    "**/.build/**",
    "**/*.app/**",
    "**/*.bundle/**",
    "**/_next/**",
    // Vendored, pre-minified code editor bundle shipped as a Swift resource.
    "**/HudsonCodeEditor/**",
  ]),
]);

export default eslintConfig;
