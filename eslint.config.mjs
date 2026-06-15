import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Guardrail: fail on runtime circular imports. `import type` edges are erased
  // at compile time and are not counted, so type-only sharing between a Provider
  // and its hook does not trip this — only real value cycles do.
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "import/no-cycle": ["error", { ignoreExternal: true }],
    },
  },
  // Guardrail: apps must not reach "up" into the registry or workspace defs —
  // that inversion is the source of import cycles (registry imports apps, never
  // the reverse). Anything an app needs about its workspace arrives at runtime
  // via shell context. registry.ts itself is exempt (it IS the aggregator).
  {
    files: ["app/apps/**/*.ts", "app/apps/**/*.tsx"],
    ignores: ["app/apps/registry.ts"],
    rules: {
      "import/no-restricted-paths": ["error", {
        zones: [
          {
            target: "./app/apps",
            from: "./app/apps/registry.ts",
            message: "Apps must not import the registry. Read the active workspace from useActiveWorkspace() (app/shell/ActiveWorkspaceContext) instead.",
          },
          {
            target: "./app/apps",
            from: "./app/workspaces",
            message: "Apps must not import workspace definitions. Read the active workspace from useActiveWorkspace() (app/shell/ActiveWorkspaceContext) instead.",
          },
        ],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".claude/**",
    ".data/**",
    "examples/**/.build/**",
    "out/**",
    "site/out/**",
    "site/site/out/**",
    "build/**",
    "public/embed/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
