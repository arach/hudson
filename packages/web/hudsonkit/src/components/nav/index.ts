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
