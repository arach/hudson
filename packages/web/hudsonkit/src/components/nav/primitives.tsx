'use client';

// Composable side-nav primitives — the Provider/Header/Content/Footer/Group/
// Menu anatomy, in the Hudson idiom. These sit alongside the data-driven
// `HudSideNav` (which composes the same look): reach for them when an app wants
// full control over the tree, `asChild` links, or bespoke rows.
//
// All of them read `useHudSideNav`, so they honor the provider's collapse mode:
// in `icon` mode labels/eyebrows fold away and only icons remain.

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight, PanelLeft } from 'lucide-react';
import { cx } from '../patterns/utils';
import { useHudSideNav } from './context';
import { LiveCountBadge, LiveDot, navRowBg, navSpine } from './shared';

/** Minimal Slot — merges nav props and composed row content onto one child. */
function Slot({
  children,
  content,
  ...props
}: {
  children: React.ReactNode;
  content: React.ReactNode;
} & Record<string, unknown>) {
  if (!React.isValidElement(children)) return null;
  const childProps = children.props as Record<string, unknown>;
  const slotOnClick = props.onClick as React.MouseEventHandler<HTMLElement> | undefined;
  const childOnClick = childProps.onClick as React.MouseEventHandler<HTMLElement> | undefined;
  const onClick =
    slotOnClick && childOnClick
      ? (event: React.MouseEvent<HTMLElement>) => {
          childOnClick(event);
          if (!event.defaultPrevented) slotOnClick(event);
        }
      : childOnClick ?? slotOnClick;
  return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
    ...props,
    ...childProps,
    className: cx(
      props.className as string | undefined,
      childProps.className as string | undefined,
    ),
    onClick,
    children: content,
  });
}

function useIconCollapsed(): boolean {
  const { state, collapsible } = useHudSideNav();
  return state === 'collapsed' && collapsible === 'icon';
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------
export interface HudSideNavRegionProps {
  children: React.ReactNode;
  className?: string;
}

/** Sticky top region — branding, workspace switcher, search. */
export function HudSideNavHeader({ children, className }: HudSideNavRegionProps) {
  return <div className={cx('shrink-0 border-b border-border/70 p-3', className)}>{children}</div>;
}

/** Scrollable middle region between header and footer. */
export function HudSideNavContent({ children, className }: HudSideNavRegionProps) {
  return (
    <div
      className={cx(
        'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto frame-scrollbar py-2',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Sticky bottom region — account, status, actions. */
export function HudSideNavFooter({ children, className }: HudSideNavRegionProps) {
  return <div className={cx('shrink-0 border-t border-border/70 p-3', className)}>{children}</div>;
}

/** A themed section. Pair with `HudSideNavGroupLabel`. */
export function HudSideNavGroup({ children, className }: HudSideNavRegionProps) {
  return (
    <div role="group" className={cx('flex flex-col', className)}>
      {children}
    </div>
  );
}

/** Mono-eyebrow section label. Folds away in icon-collapsed mode. */
export function HudSideNavGroupLabel({ children, className }: HudSideNavRegionProps) {
  const iconCollapsed = useIconCollapsed();
  if (iconCollapsed) return null;
  return (
    <div
      className={cx(
        'px-3 pb-1 pt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
export function HudSideNavMenu({ children, className }: HudSideNavRegionProps) {
  return <ul className={cx('flex flex-col gap-0.5', className)}>{children}</ul>;
}

export function HudSideNavMenuItem({ children, className }: HudSideNavRegionProps) {
  return <li className={cx('flex flex-col', className)}>{children}</li>;
}

export interface HudSideNavMenuButtonProps {
  children: React.ReactNode;
  /** Leading icon — the only affordance shown in icon-collapsed mode. */
  icon?: LucideIcon;
  /** Marks the current destination/item. Neutral emphasis, never accent. */
  isActive?: boolean;
  /** Live/active work. The one accent usage: dot, accent count, accent spine. */
  live?: boolean;
  /** Convenience trailing count badge. Accent tone only when `live`. */
  count?: number;
  /** Arbitrary trailing content (custom badge, timestamp). */
  badge?: React.ReactNode;
  /** Render this row as a leaf (item) rather than a top-level destination. */
  size?: 'destination' | 'item';
  disabled?: boolean;
  onClick?: () => void;
  /** Merge props onto a single child (e.g. an `<a>` or router `<Link>`). */
  asChild?: boolean;
  /** Disclosure state for a hand-composed expandable row. */
  expanded?: boolean;
  /** Tooltip / accessible label — also the icon-collapsed hover title. */
  tooltip?: string;
  className?: string;
}

export function HudSideNavMenuButton({
  children,
  icon: Icon,
  isActive,
  live,
  count,
  badge,
  size = 'destination',
  disabled,
  onClick,
  asChild,
  expanded,
  tooltip,
  className,
}: HudSideNavMenuButtonProps) {
  const iconCollapsed = useIconCollapsed();
  const isDestination = size === 'destination';
  const label =
    asChild && React.isValidElement(children)
      ? (children.props as { children?: React.ReactNode }).children
      : children;

  const content = iconCollapsed ? (
    <>
      {Icon ? (
        <Icon size={18} className={isActive ? 'text-foreground' : 'text-muted-foreground'} />
      ) : null}
      {live && (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--hud-nav-live)]"
        />
      )}
      <span className="sr-only">{label}</span>
    </>
  ) : (
    <>
      {Icon && (
        <Icon
          size={isDestination ? 16 : 14}
          className={cx('shrink-0', isActive ? 'text-foreground' : 'text-muted-foreground')}
        />
      )}
      <span
        className={cx(
          'min-w-0 flex-1 truncate',
          isDestination ? 'text-[12px] font-medium' : 'text-[11px]',
          isActive ? 'text-foreground' : 'text-foreground/78 group-hover:text-foreground',
        )}
      >
        {label}
      </span>
      {(typeof count === 'number' || badge || live) && (
        <span className="flex shrink-0 items-center gap-1.5">
          {typeof count === 'number' && <LiveCountBadge count={count} live={live} />}
          {badge}
          {live && <LiveDot />}
        </span>
      )}
    </>
  );

  const classes = cx(
    'group relative flex w-full items-center gap-2 text-left transition-colors',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40 focus-visible:ring-inset',
    iconCollapsed
      ? cx(
          'h-9 justify-center rounded-md',
          isActive
            ? 'bg-secondary/80 text-foreground'
            : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
        )
      : cx('border-l-2 py-2 pl-2.5 pr-2.5', navSpine(isActive, live), navRowBg(isActive)),
    disabled && 'pointer-events-none opacity-50',
    className,
  );

  if (asChild) {
    return (
      <Slot
        className={classes}
        content={content}
        title={tooltip}
        onClick={onClick}
        aria-current={isActive ? 'page' : undefined}
        aria-expanded={expanded}
        aria-disabled={disabled || undefined}
        data-active={isActive ? '' : undefined}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={tooltip}
      aria-current={isActive ? 'page' : undefined}
      aria-expanded={expanded}
      data-active={isActive ? '' : undefined}
      className={classes}
    >
      {content}
    </button>
  );
}

/** Nested submenu list — indented, with a hairline depth rail. */
export function HudSideNavMenuSub({ children, className }: HudSideNavRegionProps) {
  const iconCollapsed = useIconCollapsed();
  if (iconCollapsed) return null;
  return (
    <ul className={cx('ml-[18px] flex flex-col border-l border-border/45 pl-1', className)}>
      {children}
    </ul>
  );
}

export function HudSideNavMenuSubButton(props: Omit<HudSideNavMenuButtonProps, 'size'>) {
  return (
    <li className="flex flex-col">
      <HudSideNavMenuButton {...props} size="item" />
    </li>
  );
}

// ---------------------------------------------------------------------------
// Controls — Rail (edge toggle strip) + Trigger (button)
// ---------------------------------------------------------------------------
/** Thin toggle strip along the sidebar's inner edge. Hidden when non-collapsible. */
export function HudSideNavRail({ className }: { className?: string }) {
  const { toggle, side, collapsible } = useHudSideNav();
  if (collapsible === 'none') return null;
  return (
    <button
      type="button"
      aria-label="Toggle sidebar"
      title="Toggle sidebar"
      tabIndex={-1}
      onClick={toggle}
      className={cx(
        'group/rail absolute inset-y-0 z-20 hidden w-3 cursor-pointer sm:block',
        side === 'left' ? '-right-1.5' : '-left-1.5',
        className,
      )}
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover/rail:bg-border" />
    </button>
  );
}

/** Button that toggles the sidebar. Place inside or outside the sidebar. */
export function HudSideNavTrigger({
  className,
  label = 'Toggle sidebar',
}: {
  className?: string;
  label?: string;
}) {
  const { toggle } = useHudSideNav();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={toggle}
      className={cx(
        'inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors',
        'hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40',
        className,
      )}
    >
      <PanelLeft size={16} />
    </button>
  );
}

/** Shared caret used by expandable rows. */
export function HudSideNavCaret({ expanded }: { expanded: boolean }) {
  return (
    <ChevronRight
      size={10}
      strokeWidth={2.5}
      className={cx(
        'shrink-0 text-muted-foreground/70 transition-transform duration-150',
        expanded && 'rotate-90',
      )}
    />
  );
}
