// Narrow subpath — Base UI behavior wrappers (tooltip, menu, popover, select).
// Pulls `@base-ui-components/react`. Does NOT re-export ContextMenu (use
// `hudsonkit/context-menu`) so consumers opt into each surface deliberately.
export {
  HudTooltip,
  HudTooltipProvider,
  BaseTooltip,
  HudMenu,
  BaseMenu,
  HudPopover,
  BasePopover,
  HudSelectBase,
  BaseSelect,
  chromeBorderStyle,
  chromeDividerStyle,
  OVERLAY_POPUP,
  OVERLAY_POPUP_SELECT,
  OVERLAY_POPUP_POPOVER,
  OVERLAY_POPUP_TOOLTIP,
  OVERLAY_ITEM,
  OVERLAY_ITEM_ICON,
  OVERLAY_ITEM_LABEL,
  OVERLAY_ITEM_SHORTCUT,
  OVERLAY_ITEM_CHECK,
  OVERLAY_GROUP_LABEL,
  OVERLAY_SEPARATOR,
  OVERLAY_POSITIONER,
} from './components/behaviors';

export type {
  HudTooltipProps,
  HudTooltipProviderProps,
  HudTooltipSide,
  HudMenuProps,
  HudMenuEntry,
  HudMenuAction,
  HudMenuSeparator,
  HudMenuGroup,
  HudPopoverProps,
  HudPopoverSide,
  HudSelectBaseProps,
  HudSelectBaseOption,
  HudSelectBaseDensity,
} from './components/behaviors';
