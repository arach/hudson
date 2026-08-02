// hudsonkit/nav — application-level side navigation.
//
// A data-driven, up-to-three-tier side nav (destinations → sections → items)
// that drops into AppShell's `slots.LeftPanel`, plus a composable primitive set
// (Provider / Header / Content / Footer / Group / Menu / Rail / Trigger) modeled
// on a first-class sidebar anatomy. Separate from `hudsonkit/patterns` (app-
// interior content rails/lists) because this is structural app navigation: the
// primary rail an app is organised around, not a surface's inner list.

export * from './components/nav';
