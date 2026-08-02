// Data-driven convenience layer.
export { HudSideNav } from './HudSideNav';
export type { HudNavNode, HudSideNavProps } from './HudSideNav';

// Provider + hook (collapse state, keyboard shortcut, persistence).
export {
  HudSideNavProvider,
  useHudSideNav,
  useOptionalHudSideNav,
  HUD_SIDE_NAV_KEYBOARD_SHORTCUT,
} from './context';
export type {
  HudSideNavProviderProps,
  HudSideNavContextValue,
  HudSideNavCollapsible,
  HudSideNavSide,
  HudSideNavState,
} from './context';

// Composable primitives.
export {
  HudSideNavHeader,
  HudSideNavContent,
  HudSideNavFooter,
  HudSideNavGroup,
  HudSideNavGroupLabel,
  HudSideNavMenu,
  HudSideNavMenuItem,
  HudSideNavMenuButton,
  HudSideNavMenuSub,
  HudSideNavMenuSubButton,
  HudSideNavRail,
  HudSideNavTrigger,
  HudSideNavCaret,
} from './primitives';
export type { HudSideNavRegionProps, HudSideNavMenuButtonProps } from './primitives';

// Breadcrumb (minimal chrome).
export { HudBreadcrumb } from './HudBreadcrumb';
export type { HudBreadcrumbProps, HudBreadcrumbItem } from './HudBreadcrumb';

// Opt-in behaviors (HUD-014 A3–A4).
export { useRovingNav } from './useRovingNav';
export {
  useSnapCollapseAt,
  PENDING_PROGRAMMATIC_WIDTH_CLEAR_MS,
  HUD_CONTEXT_LIST_WIDTH,
  HUD_DESTINATION_COMPACT_WIDTH,
  HUD_DESTINATION_EXPANDED_WIDTH,
  HUD_NAV_NATURAL_COLLAPSED,
  HUD_NAV_NATURAL_EXPANDED,
  HUD_NAV_SNAP_COLLAPSE_AT,
  HUD_NAV_SNAP_HYSTERESIS,
} from './useSnapCollapseAt';
export type { UseSnapCollapseAtOptions, SnapCollapseNaturalWidths } from './useSnapCollapseAt';
