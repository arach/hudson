// Narrow subpath — opt-in context menu. Pulls `motion` and
// `@base-ui/react` transitively, so it's isolated from the default
// overlays barrel.
export { HudsonContextMenu } from './components/overlays/ContextMenu';
export type {
  ContextMenuEntry,
  ContextMenuAction,
  ContextMenuSeparator,
  ContextMenuGroup,
} from './components/overlays/ContextMenu';
