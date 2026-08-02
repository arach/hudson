'use client';

import React from 'react';
import { Menu } from '@base-ui-components/react/menu';
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
} from '../overlays/menuChrome';

// ---------------------------------------------------------------------------
// Types — mirror ContextMenuEntry so Menu and ContextMenu share a shape
// ---------------------------------------------------------------------------

export interface HudMenuAction {
  id: string;
  label: string;
  action: () => void;
  shortcut?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface HudMenuSeparator {
  type: 'separator';
}

export interface HudMenuGroup {
  type: 'group';
  label: string;
  items: HudMenuAction[];
}

export type HudMenuEntry = HudMenuAction | HudMenuSeparator | HudMenuGroup;

export interface HudMenuProps {
  items: HudMenuEntry[];
  /**
   * Trigger content. A single ReactElement is composed via Base UI `render`
   * (must accept unknown props); otherwise wrapped in a button.
   */
  children: React.ReactNode;
  disabled?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  className?: string;
}

function isSeparator(entry: HudMenuEntry): entry is HudMenuSeparator {
  return 'type' in entry && entry.type === 'separator';
}

function isGroup(entry: HudMenuEntry): entry is HudMenuGroup {
  return 'type' in entry && entry.type === 'group';
}

function MenuItemRow({ item }: { item: HudMenuAction }) {
  return (
    <Menu.Item
      disabled={item.disabled}
      onClick={item.action}
      label={item.label}
      className={OVERLAY_ITEM}
    >
      {item.icon != null && <span className={OVERLAY_ITEM_ICON}>{item.icon}</span>}
      <span className={OVERLAY_ITEM_LABEL}>{item.label}</span>
      {item.shortcut != null && item.shortcut !== '' && (
        <span className={OVERLAY_ITEM_SHORTCUT}>{item.shortcut}</span>
      )}
    </Menu.Item>
  );
}

function renderEntries(items: HudMenuEntry[]) {
  return items.map((entry, idx) => {
    if (isSeparator(entry)) {
      return (
        <Menu.Separator
          key={`sep-${idx}`}
          className={OVERLAY_SEPARATOR}
          style={chromeDividerStyle}
        />
      );
    }
    if (isGroup(entry)) {
      return (
        <Menu.Group key={`grp-${idx}`}>
          <Menu.GroupLabel className={OVERLAY_GROUP_LABEL}>{entry.label}</Menu.GroupLabel>
          {entry.items.map((item) => (
            <MenuItemRow key={item.id} item={item} />
          ))}
        </Menu.Group>
      );
    }
    return <MenuItemRow key={entry.id} item={entry} />;
  });
}

/**
 * Base UI Menu (dropdown) skinned to the kit ContextMenu idiom:
 * mono 12px rows, tracked group labels, hairline separators, accent highlight.
 *
 * For right-click menus, use HudsonContextMenu — same entry shape, already on Base UI.
 */
export function HudMenu({
  items,
  children,
  disabled = false,
  open,
  defaultOpen,
  onOpenChange,
  side = 'bottom',
  align = 'start',
  sideOffset = 4,
  className = '',
}: HudMenuProps) {
  if (items.length === 0) return <>{children}</>;

  const triggerEl = React.isValidElement(children)
    ? (children as React.ReactElement<Record<string, unknown>>)
    : null;

  const trigger =
    triggerEl != null ? (
      <Menu.Trigger
        disabled={disabled}
        render={triggerEl}
        nativeButton={typeof triggerEl.type === 'string' ? triggerEl.type === 'button' : true}
      />
    ) : (
      <Menu.Trigger disabled={disabled} className={OVERLAY_ITEM}>
        {children}
      </Menu.Trigger>
    );

  return (
    <Menu.Root
      disabled={disabled}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      modal={false}
    >
      {trigger}
      <Menu.Portal>
        <Menu.Positioner
          className={OVERLAY_POSITIONER}
          side={side}
          align={align}
          sideOffset={sideOffset}
        >
          <Menu.Popup
            className={[OVERLAY_POPUP, className].filter(Boolean).join(' ')}
            style={chromeBorderStyle}
          >
            {renderEntries(items)}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Escape hatch: raw Base UI Menu namespace. */
export { Menu as BaseMenu };
