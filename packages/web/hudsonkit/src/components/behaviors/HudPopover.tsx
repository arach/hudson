'use client';

import React from 'react';
import { Popover } from '@base-ui-components/react/popover';
import {
  chromeBorderStyle,
  OVERLAY_ITEM,
  OVERLAY_POPUP_POPOVER,
  OVERLAY_POSITIONER,
} from '../overlays/menuChrome';

export type HudPopoverSide = 'top' | 'bottom' | 'left' | 'right';

export interface HudPopoverProps {
  children: React.ReactNode;
  /** Body of the popover (or use title/description props for structured content). */
  content?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  side?: HudPopoverSide;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  /** When true, trap focus and lock outside pointer interaction. @default false */
  modal?: boolean | 'trap-focus';
  className?: string;
  /**
   * Trigger: single element is composed via Base UI `render` (must accept
   * unknown props); otherwise children is used, or wrapped in a button.
   */
  trigger?: React.ReactElement<Record<string, unknown>>;
}

/**
 * Base UI Popover for thread-history pickers, agent detail hovers, etc.
 * Same popup chrome as HudMenu (token-pure, dense).
 */
export function HudPopover({
  children,
  content,
  title,
  description,
  side = 'bottom',
  align = 'start',
  sideOffset = 6,
  open,
  defaultOpen,
  onOpenChange,
  disabled = false,
  modal = false,
  className = '',
  trigger,
}: HudPopoverProps) {
  const triggerEl: React.ReactElement<Record<string, unknown>> | null =
    trigger ??
    (React.isValidElement(children)
      ? (children as React.ReactElement<Record<string, unknown>>)
      : null);
  const body = content ?? (trigger ? children : null);

  const triggerNode =
    triggerEl != null ? (
      <Popover.Trigger
        disabled={disabled}
        render={triggerEl}
        nativeButton={
          typeof triggerEl.type === 'string' ? triggerEl.type === 'button' : true
        }
      />
    ) : (
      <Popover.Trigger disabled={disabled} className={OVERLAY_ITEM}>
        {children}
      </Popover.Trigger>
    );

  return (
    <Popover.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      modal={modal}
    >
      {triggerNode}
      <Popover.Portal>
        <Popover.Positioner
          className={OVERLAY_POSITIONER}
          side={side}
          align={align}
          sideOffset={sideOffset}
        >
          <Popover.Popup
            className={[OVERLAY_POPUP_POPOVER, className].filter(Boolean).join(' ')}
            style={chromeBorderStyle}
          >
            {title != null && (
              <Popover.Title className="m-0 mb-1 font-semibold text-[12px] leading-snug tracking-tight text-popover-foreground">
                {title}
              </Popover.Title>
            )}
            {description != null && (
              <Popover.Description className="m-0 text-[11px] leading-relaxed text-muted-foreground">
                {description}
              </Popover.Description>
            )}
            {body}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Escape hatch: raw Base UI Popover namespace. */
export { Popover as BasePopover };
