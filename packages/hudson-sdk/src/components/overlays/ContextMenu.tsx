'use client';

import React from 'react';
import { ContextMenu } from '@base-ui-components/react/context-menu';
import { motion, AnimatePresence } from 'motion/react';

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
      className="flex items-center gap-3 px-3 py-1.5 text-[12px] font-mono text-popover-foreground outline-none select-none data-[highlighted]:bg-accent/10 data-[highlighted]:text-accent data-[disabled]:opacity-40 data-[disabled]:pointer-events-none cursor-default"
    >
      {item.icon && <span className="w-4 h-4 flex items-center justify-center text-muted-foreground">{item.icon}</span>}
      <span className="flex-1">{item.label}</span>
      {item.shortcut && (
        <span className="text-muted-foreground text-[10px] ml-4 tracking-wider">{item.shortcut}</span>
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
      <ContextMenu.Popup className="bg-popover/95 backdrop-blur-xl border border-border/60 rounded-lg shadow-2xl py-1 min-w-[180px] z-[200] outline-none">
        {items.map((entry, idx) => {
          if (isSeparator(entry)) {
            return <ContextMenu.Separator key={`sep-${idx}`} className="h-px bg-border/60 my-1" />;
          }
          if (isGroup(entry)) {
            return (
              <ContextMenu.Group key={`grp-${idx}`}>
                <ContextMenu.GroupLabel className="px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
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

export function HudsonContextMenu({ items, children }: HudsonContextMenuProps) {
  if (items.length === 0) return <>{children}</>;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger render={<div style={{ display: 'contents' }} />}>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="z-[200]" sideOffset={4}>
          <AnimatePresence>
            <PopupContent items={items} />
          </AnimatePresence>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
