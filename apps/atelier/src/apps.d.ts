// Atelier mounts Hudson's real apps (app/apps/*) at runtime via the Vite `@apps`
// alias. We declare them here as `HudsonApp` rather than mapping a tsconfig path
// into Hudson's source: Hudson owns typechecking its own apps, and Atelier just
// trusts the published contract. This keeps Atelier's `tsc` scoped to Atelier's
// own code (no re-linting Hudson's apps under a stricter config, no cross-copy
// type-identity clashes from duplicate transitive deps).
declare module "@apps/shaper" {
  import type { HudsonApp } from "hudsonkit";
  export const shaperApp: HudsonApp;
}

declare module "@apps/logo" {
  import type { HudsonApp } from "hudsonkit";
  export const logoApp: HudsonApp;
}
