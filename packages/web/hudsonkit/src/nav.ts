// hudsonkit/nav — application-level side navigation.
//
// A data-driven, up-to-three-tier side nav (destinations → sections → items)
// that drops into AppShell's `slots.LeftPanel`. Separate from `hudsonkit/patterns`
// (app-interior content rails/lists) because this is structural app navigation:
// the primary rail an app is organised around, not a surface's inner list.

export { HudSideNav } from './components/nav';
export type { HudNavNode, HudSideNavProps } from './components/nav';
