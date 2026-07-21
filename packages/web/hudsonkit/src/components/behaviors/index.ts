/**
 * Base UI behavior wrappers.
 *
 * Base UI owns *behaviors* (focus, open/close, positioning, a11y).
 * Hudson owns the *register* (tokens, density, chrome).
 *
 * Import from `hudsonkit/behaviors` (opt-in subpath — pulls
 * `@base-ui-components/react`). Context menu stays on
 * `hudsonkit/context-menu`. Shared chrome lives in `menuChrome`.
 */

export {
  HudTooltip,
  HudTooltipProvider,
  BaseTooltip,
  type HudTooltipProps,
  type HudTooltipProviderProps,
  type HudTooltipSide,
} from './HudTooltip';

export {
  HudMenu,
  BaseMenu,
  type HudMenuProps,
  type HudMenuEntry,
  type HudMenuAction,
  type HudMenuSeparator,
  type HudMenuGroup,
} from './HudMenu';

export {
  HudPopover,
  BasePopover,
  type HudPopoverProps,
  type HudPopoverSide,
} from './HudPopover';

export {
  HudSelectBase,
  BaseSelect,
  type HudSelectBaseProps,
  type HudSelectBaseOption,
  type HudSelectBaseDensity,
} from './HudSelectBase';

export {
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
} from '../overlays/menuChrome';
