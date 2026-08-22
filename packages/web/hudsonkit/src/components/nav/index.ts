// Data-driven convenience layer.
export { HudSideNav } from './HudSideNav';
export type { HudNavNode, HudSideNavProps } from './HudSideNav';

// Provider + hook (collapse state, keyboard shortcut, persistence).
export {
  HudSideNavProvider,
  useHudSideNav,
  useOptionalHudSideNav,
  HUD_SIDE_NAV_KEYBOARD_SHORTCUT,
  HUD_SIDE_NAV_EXPANDED_WIDTH,
  HUD_SIDE_NAV_MIN_EXPANDED_WIDTH,
  HUD_SIDE_NAV_MAX_EXPANDED_WIDTH,
  HUD_SIDE_NAV_COLLAPSED_WIDTH,
  HUD_SIDE_NAV_TOOLTIP_DELAY,
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
export type {
  HudSideNavRegionProps,
  HudSideNavMenuButtonProps,
  HudSideNavTriggerProps,
} from './primitives';

// Full-height anchored-L composition + separate contextual rail.
export {
  HudSideNavLayout,
  HudSideRail,
  HUD_SIDE_NAV_TOP_ROW_HEIGHT,
  HUD_SIDE_NAV_BOTTOM_BAR_HEIGHT,
  HUD_SIDE_RAIL_EXPANDED_WIDTH,
  HUD_SIDE_RAIL_COLLAPSED_WIDTH,
  HUD_SIDE_RAIL_HEADER_HEIGHT,
} from './HudSideNavLayout';
export type { HudSideNavLayoutProps, HudSideRailProps } from './HudSideNavLayout';

// Shared pointer/keyboard resize behavior for custom rail compositions.
export {
  HudRailResizeHandle,
  resolveHudRailResizeCommit,
  HUD_RAIL_DRAG_COLLAPSE_MARGIN,
  HUD_RAIL_DRAG_EXPAND_TRAVEL,
  HUD_RAIL_KEYBOARD_RESIZE_STEP,
} from './HudRailResizeHandle';
export type { HudRailResizeHandleProps } from './HudRailResizeHandle';

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
