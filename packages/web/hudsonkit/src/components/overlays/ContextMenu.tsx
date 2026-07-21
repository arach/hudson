'use client';

import React, { useRef } from 'react';
import { ContextMenu } from '@base-ui-components/react/context-menu';
import { motion, AnimatePresence } from 'motion/react';
import {
  chromeBorderStyle,
  chromeDividerStyle,
  OVERLAY_GROUP_LABEL,
  OVERLAY_ITEM,
  OVERLAY_ITEM_ICON,
  OVERLAY_ITEM_LABEL,
  OVERLAY_ITEM_SHORTCUT,
  OVERLAY_POPUP,
  OVERLAY_POSITIONER,
  OVERLAY_SEPARATOR,
} from './menuChrome';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextMenuAction {
  id: string;
  label: string;
  action: () => void;
  shortcut?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface ContextMenuSeparator {
  type: 'separator';
}

export interface ContextMenuGroup {
  type: 'group';
  label: string;
  items: ContextMenuAction[];
}

export type ContextMenuEntry = ContextMenuAction | ContextMenuSeparator | ContextMenuGroup;

// ---------------------------------------------------------------------------
// HudsonContextMenu
// ---------------------------------------------------------------------------

interface HudsonContextMenuProps {
  items: ContextMenuEntry[];
  children: React.ReactNode;
  /** Modifier that bypasses Hudson's custom menu and lets the browser menu open. */
  nativeMenuModifier?: 'shift' | 'alt' | 'meta' | 'ctrl';
  /**
   * default: normal right-click opens Hudson, modifier opens native browser menu.
   * modifier: normal right-click opens native browser menu, modifier opens Hudson.
   */
  activationMode?: 'default' | 'modifier';
}

function isSeparator(entry: ContextMenuEntry): entry is ContextMenuSeparator {
  return 'type' in entry && entry.type === 'separator';
}

function isGroup(entry: ContextMenuEntry): entry is ContextMenuGroup {
  return 'type' in entry && entry.type === 'group';
}

function MenuItemRow({ item }: { item: ContextMenuAction }) {
  return (
    <ContextMenu.Item
      disabled={item.disabled}
      onClick={item.action}
      label={item.label}
      className={OVERLAY_ITEM}
    >
      {item.icon && <span className={OVERLAY_ITEM_ICON}>{item.icon}</span>}
      <span className={OVERLAY_ITEM_LABEL}>{item.label}</span>
      {item.shortcut && (
        <span className={OVERLAY_ITEM_SHORTCUT}>{item.shortcut}</span>
      )}
    </ContextMenu.Item>
  );
}

const PopupContent = React.forwardRef<HTMLDivElement, { items: ContextMenuEntry[] }>(
  ({ items }, ref) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
    >
      <ContextMenu.Popup
        className={OVERLAY_POPUP}
        style={chromeBorderStyle}
        aria-label="Context menu"
      >
        {items.map((entry, idx) => {
          if (isSeparator(entry)) {
            return (
              <ContextMenu.Separator
                key={`sep-${idx}`}
                className={OVERLAY_SEPARATOR}
                style={chromeDividerStyle}
              />
            );
          }
          if (isGroup(entry)) {
            return (
              <ContextMenu.Group key={`grp-${idx}`}>
                <ContextMenu.GroupLabel className={OVERLAY_GROUP_LABEL}>
                  {entry.label}
                </ContextMenu.GroupLabel>
                {entry.items.map(item => (
                  <MenuItemRow key={item.id} item={item} />
                ))}
              </ContextMenu.Group>
            );
          }
          return <MenuItemRow key={entry.id} item={entry} />;
        })}
      </ContextMenu.Popup>
    </motion.div>
  ),
);
PopupContent.displayName = 'PopupContent';

function shouldBypassToNativeMenu(
  event: React.MouseEvent,
  modifier: HudsonContextMenuProps['nativeMenuModifier'],
) {
  switch (modifier) {
    case 'alt':
      return event.altKey;
    case 'meta':
      return event.metaKey;
    case 'ctrl':
      return event.ctrlKey;
    case 'shift':
    default:
      return event.shiftKey;
  }
}

export function HudsonContextMenu({
  items,
  children,
  nativeMenuModifier = 'alt',
  activationMode = 'default',
}: HudsonContextMenuProps) {
  const keyboardOpenRef = useRef(false);

  if (items.length === 0) return <>{children}</>;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        render={(
          <div
            style={{ display: 'contents' }}
            aria-haspopup="menu"
            onKeyDownCapture={(event) => {
              if (event.defaultPrevented) return;
              const opensContextMenu = event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10');
              if (!opensContextMenu) return;

              event.preventDefault();
              event.stopPropagation();
              const target = event.target instanceof HTMLElement ? event.target : event.currentTarget;
              const rect = target.getBoundingClientRect();
              const clientX = rect.left + Math.min(24, Math.max(0, rect.width / 2));
              const clientY = rect.top + Math.min(24, Math.max(0, rect.height / 2));
              keyboardOpenRef.current = true;
              try {
                event.currentTarget.dispatchEvent(new MouseEvent('contextmenu', {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  clientX,
                  clientY,
                  button: 2,
                }));
              } finally {
                keyboardOpenRef.current = false;
              }
            }}
            onContextMenuCapture={(event) => {
              if (keyboardOpenRef.current) return;
              const modifierActive = shouldBypassToNativeMenu(event, nativeMenuModifier);
              const shouldUseNativeMenu = activationMode === 'modifier' ? !modifierActive : modifierActive;
              if (shouldUseNativeMenu) {
                // stopPropagation (not preventDefault) — React halts dispatch after
                // a capture-phase stop, so base-ui's bubble-phase onContextMenu
                // on this same trigger never fires and the browser's native
                // context menu is allowed to open.
                event.stopPropagation();
              }
            }}
          />
        )}
      >
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className={OVERLAY_POSITIONER} sideOffset={4}>
          <AnimatePresence>
            <PopupContent items={items} />
          </AnimatePresence>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
