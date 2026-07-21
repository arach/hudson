'use client';

// HudSideNav — application-level side navigation for panel-based Hudson apps.
//
// A single data-driven tree drives up to three tiers inside one panel (it drops
// straight into AppShell's `slots.LeftPanel`):
//
//   Level 1 — destinations : the primary rail. Icon + label rows; the app's
//             top-level places. Expandable when they carry children.
//   Level 2 — sections     : mono-eyebrow groups within a destination. A child
//             node that itself has children renders as a collapsible section.
//   Level 3 — items        : leaf rows under a section (or directly under a
//             destination, for the natural two-level case).
//
// This is the convenience layer. For hand-composed navs, use the primitives
// (HudSideNavProvider/Header/Content/Footer/Group/Menu/…) exported alongside it;
// pass `children` here to compose them inside the same shell.
//
// Collapse is owned by HudSideNavProvider. HudSideNav self-provides one when it
// is not already inside a provider, so the standalone API needs no wrapper.
//
// Two-tier accent rule (matches the rest of the kit): the live signal is the
// only place colour is spent — the live dot, the live count tone, and the live
// left-spine all read `--hud-nav-live` (defaults to accent). Plain *selection*
// is a neutral filled chip, never the live tone, so "where I am" and "what is
// live" stay legible as two separate channels.

import React, { useCallback, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { HudDensity } from '../primitives';
import { cx } from '../patterns/utils';
import {
  HudSideNavProvider,
  useHudSideNav,
  useOptionalHudSideNav,
  type HudSideNavCollapsible,
  type HudSideNavSide,
} from './context';
import { HudSideNavRail, HudSideNavCaret } from './primitives';
import { LiveCountBadge, LiveDot, indentFor, navRailSelectedBg, navRowBg, navSpine } from './shared';
import { useRovingNav } from './useRovingNav';

/** A single navigation node. Nodes nest via `children` to form the tier tree. */
export interface HudNavNode {
  /** Stable identity — also the value passed to `onSelect` / `selectedId`. */
  id: string;
  /** Row label. Plain text is ideal; any node is accepted. */
  label: React.ReactNode;
  /** Optional Lucide icon. Rendered on destinations and leaves, and it is the
   *  only affordance shown in collapsed (icons-only) mode. */
  icon?: LucideIcon;
  /** Convenience trailing count. Rendered as a badge; tone follows `live`. */
  count?: number;
  /** Arbitrary trailing content (custom badge, timestamp, …). Sits before the
   *  live dot. */
  badge?: React.ReactNode;
  /** Live/active work on this node. Drives the ONLY accent usage: a pulsing
   *  accent dot, an accent count tone, and an accent left-spine. */
  live?: boolean;
  /** Dim + non-interactive. */
  disabled?: boolean;
  /** Child nodes. A node with children is expandable; at depth ≥ 1 it renders
   *  as a mono-eyebrow section. */
  children?: readonly HudNavNode[];
}

export interface HudSideNavProps {
  /** Level-1 destinations. Each may nest sections and items via `children`.
   *  Omit when composing the tree by hand via `children`. */
  items?: readonly HudNavNode[];
  /** Hand-composed body (primitives). Ignored when `items` is provided. */
  children?: React.ReactNode;
  /** Currently selected node id (any tier). */
  selectedId?: string | null;
  /** Fired when an enabled node's row is activated. Selection is the
   *  consumer's business — no routing is assumed. */
  onSelect?: (node: HudNavNode) => void;
  /** Controlled expanded set. Omit to let HudSideNav own expansion. */
  expandedIds?: ReadonlySet<string>;
  /** Initial expanded ids when uncontrolled. The ancestors of `selectedId` are
   *  always revealed on top of this, so the current node is visible. */
  defaultExpandedIds?: Iterable<string>;
  /** Notified whenever the expanded set changes (both controlled + uncontrolled). */
  onExpandedChange?: (expandedIds: ReadonlySet<string>) => void;
  /**
   * Force icons-only collapse. Back-compat shorthand: when set, HudSideNav
   * self-provides a provider in `icon` mode with this as the controlled state.
   * Prefer a `HudSideNavProvider` + `collapsible`/`persistKey` for new code.
   */
  collapsed?: boolean;
  /** Provider defaults used only when HudSideNav self-provides (no outer
   *  provider). Ignored when rendered inside a `HudSideNavProvider`. */
  defaultOpen?: boolean;
  collapsible?: HudSideNavCollapsible;
  side?: HudSideNavSide;
  /** localStorage key to persist collapse (self-provided provider only). */
  persistKey?: string;
  /** Cmd/Ctrl shortcut key, or `false` to disable (self-provided provider only). */
  keyboardShortcut?: string | false;
  /** Render a rail toggle strip along the sidebar's inner edge. */
  rail?: boolean;
  /** Optional content pinned above the tree (brand row, workspace switch, …). */
  header?: React.ReactNode;
  /** Optional content pinned below the tree (account, status, actions, …). */
  footer?: React.ReactNode;
  /** Density register. Defaults to `default`. */
  density?: HudDensity;
  /**
   * Opt-in selection wash visible on all themes (action-tint + ink spine).
   * Default off — keeps the legacy secondary chip for back-compat (HUD-014 A3).
   */
  selectionWash?: boolean;
  /**
   * Opt-in Arrow/Home/End roving focus across visible buttons in this nav.
   * Default off (HUD-014 A3).
   */
  rovingFocus?: boolean;
  /** Accessible name for the <nav> landmark. Defaults to "Primary". */
  ariaLabel?: string;
  className?: string;
  /** Rendered when `items` is empty. */
  empty?: React.ReactNode;
}

// Walk the tree once to find the ancestor ids of a target, so uncontrolled
// expansion can reveal the selected node on first paint.
function collectAncestors(
  nodes: readonly HudNavNode[],
  targetId: string,
  trail: string[] = [],
): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return trail;
    if (node.children?.length) {
      const found = collectAncestors(node.children, targetId, [...trail, node.id]);
      if (found) return found;
    }
  }
  return null;
}

export function HudSideNav(props: HudSideNavProps) {
  const outer = useOptionalHudSideNav();
  // Already inside a provider (composable usage) — consume it directly.
  if (outer) return <HudSideNavView {...props} />;

  // Standalone — self-provide. The legacy `collapsed` prop maps to a controlled
  // `icon`-mode provider so the shipped behavior is byte-identical.
  const { collapsed, defaultOpen, collapsible, side, persistKey, keyboardShortcut } = props;
  return (
    <HudSideNavProvider
      {...(collapsed !== undefined ? { open: !collapsed } : {})}
      defaultOpen={defaultOpen ?? true}
      collapsible={collapsible ?? 'icon'}
      side={side ?? 'left'}
      persistKey={persistKey}
      keyboardShortcut={keyboardShortcut}
    >
      <HudSideNavView {...props} />
    </HudSideNavProvider>
  );
}

function HudSideNavView({
  items,
  children,
  selectedId,
  onSelect,
  expandedIds,
  defaultExpandedIds,
  onExpandedChange,
  rail,
  header,
  footer,
  density = 'default',
  selectionWash = false,
  rovingFocus = false,
  ariaLabel = 'Primary',
  className,
  empty,
}: HudSideNavProps) {
  const { state, collapsible, side } = useHudSideNav();
  const rovingKeyDown = useRovingNav();
  const iconCollapsed = state === 'collapsed' && collapsible === 'icon';
  const offcanvasHidden = state === 'collapsed' && collapsible === 'offcanvas';

  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(() => {
    const seed = new Set(defaultExpandedIds);
    if (selectedId && items) {
      for (const id of collectAncestors(items, selectedId) ?? []) seed.add(id);
    }
    return seed;
  });
  const expanded = expandedIds ?? internalExpanded;

  const setExpanded = useCallback(
    (next: Set<string>) => {
      if (!expandedIds) setInternalExpanded(next);
      onExpandedChange?.(next);
    },
    [expandedIds, onExpandedChange],
  );

  const toggleExpanded = useCallback(
    (id: string) => {
      const next = new Set(expanded);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setExpanded(next);
    },
    [expanded, setExpanded],
  );

  const dataDriven = items !== undefined;
  const body = dataDriven ? (
    items!.length === 0 && empty ? (
      <div className="px-3 py-4 text-[11px] text-muted-foreground">{empty}</div>
    ) : iconCollapsed ? (
      <CollapsedRail
        items={items!}
        selectedId={selectedId}
        onSelect={onSelect}
        density={density}
        selectionWash={selectionWash}
      />
    ) : (
      <div className="flex flex-col gap-0.5">
        {items!.map(node => (
          <HudNavRow
            key={node.id}
            node={node}
            depth={0}
            selectedId={selectedId}
            expanded={expanded}
            onToggleExpanded={toggleExpanded}
            onSelect={onSelect}
            density={density}
            selectionWash={selectionWash}
          />
        ))}
      </div>
    )
  ) : (
    children
  );

  return (
    <nav
      aria-label={ariaLabel}
      data-state={state}
      data-collapsible={collapsible === 'none' ? undefined : collapsible}
      data-side={side}
      data-selection-wash={selectionWash ? '' : undefined}
      onKeyDown={rovingFocus ? rovingKeyDown : undefined}
      className={cx('relative flex min-h-0 flex-col', offcanvasHidden && 'hidden', className)}
    >
      {header && (
        <div
          className={cx(
            'shrink-0 border-b border-[color-mix(in_srgb,var(--hud-chrome-border,oklch(var(--border)))_70%,transparent)]',
            density === 'compact' ? 'p-2' : 'p-3',
          )}
        >
          {header}
        </div>
      )}
      <div className={cx('min-h-0 flex-1 overflow-y-auto frame-scrollbar', density === 'compact' ? 'py-1.5' : 'py-2')}>
        {body}
      </div>
      {footer && (
        <div className="shrink-0 border-t border-[color-mix(in_srgb,var(--hud-chrome-border,oklch(var(--border)))_70%,transparent)] p-3">
          {footer}
        </div>
      )}
      {rail && <HudSideNavRail />}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Row — a destination (depth 0), a section (depth ≥ 1 + children), or a leaf.
// ---------------------------------------------------------------------------
interface HudNavRowProps {
  node: HudNavNode;
  depth: number;
  selectedId?: string | null;
  expanded: ReadonlySet<string>;
  onToggleExpanded: (id: string) => void;
  onSelect?: (node: HudNavNode) => void;
  density: HudDensity;
  selectionWash?: boolean;
}

function HudNavRow({
  node,
  depth,
  selectedId,
  expanded,
  onToggleExpanded,
  onSelect,
  density,
  selectionWash = false,
}: HudNavRowProps) {
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const isSection = depth >= 1 && hasChildren;
  const isExpanded = hasChildren && expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const compact = density === 'compact';

  const activate = useCallback(() => {
    if (node.disabled) return;
    onSelect?.(node);
    // A destination or section with children also toggles disclosure on click,
    // mirroring the donor rails (select + reveal in one gesture).
    if (hasChildren) onToggleExpanded(node.id);
  }, [node, onSelect, hasChildren, onToggleExpanded]);

  // Sections (depth ≥ 1 groups) render as a mono eyebrow with a caret.
  if (isSection) {
    return (
      <div className="flex flex-col">
        <button
          type="button"
          disabled={node.disabled}
          onClick={activate}
          style={{ paddingLeft: indentFor(depth, compact) }}
          className={cx(
            'group flex w-full items-center gap-1.5 pr-3 font-mono uppercase transition-colors',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40 focus-visible:ring-inset',
            compact ? 'py-1 text-[9px] tracking-[0.16em]' : 'py-1.5 text-[10px] tracking-[0.18em]',
            node.disabled ? 'pointer-events-none opacity-50' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <HudSideNavCaret expanded={isExpanded} />
          <span className="min-w-0 flex-1 truncate text-left">{node.label}</span>
          <TrailingCluster node={node} compact={compact} />
        </button>
        {isExpanded && (
          <div className="flex flex-col">
            {children.map(child => (
              <HudNavRow
                key={child.id}
                node={child}
                depth={depth + 1}
                selectedId={selectedId}
                expanded={expanded}
                onToggleExpanded={onToggleExpanded}
                onSelect={onSelect}
                density={density}
                selectionWash={selectionWash}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const Icon = node.icon;
  const isDestination = depth === 0;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        disabled={node.disabled}
        aria-current={isSelected ? 'page' : undefined}
        onClick={activate}
        style={{ paddingLeft: indentFor(depth, compact) }}
        className={cx(
          'group flex w-full items-center gap-2 border-l-2 pr-2.5 text-left transition-colors',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40 focus-visible:ring-inset',
          compact ? 'py-1.5' : 'py-2',
          // When selectionWash draws its own inset spine, keep the border transparent.
          selectionWash && isSelected && !node.live ? 'border-l-transparent' : navSpine(isSelected, node.live),
          navRowBg(isSelected, selectionWash),
          node.disabled && 'pointer-events-none opacity-50',
        )}
      >
        {Icon ? (
          <Icon
            size={isDestination ? (compact ? 15 : 16) : compact ? 13 : 14}
            className={cx('shrink-0', isSelected ? 'text-foreground' : 'text-muted-foreground')}
          />
        ) : (
          !isDestination && <span className="w-1 shrink-0" aria-hidden="true" />
        )}
        {hasChildren && (
          <span className="-ml-1 flex">
            <HudSideNavCaret expanded={isExpanded} />
          </span>
        )}
        <span
          className={cx(
            'min-w-0 flex-1 truncate',
            isDestination
              ? compact ? 'text-[11px] font-medium' : 'text-[12px] font-medium'
              : compact ? 'text-[10px]' : 'text-[11px]',
            isSelected ? 'text-foreground' : 'text-foreground/78 group-hover:text-foreground',
          )}
        >
          {node.label}
        </span>
        <TrailingCluster node={node} compact={compact} />
      </button>

      {hasChildren && isExpanded && (
        <div className="flex flex-col">
          {children.map(child => (
            <HudNavRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expanded={expanded}
              onToggleExpanded={onToggleExpanded}
              onSelect={onSelect}
              density={density}
              selectionWash={selectionWash}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Trailing metadata: count (live token only when live) → custom badge → live dot.
function TrailingCluster({ node, compact }: { node: HudNavNode; compact: boolean }) {
  if (typeof node.count !== 'number' && !node.badge && !node.live) return null;
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {typeof node.count === 'number' && (
        <LiveCountBadge count={node.count} live={node.live} />
      )}
      {node.badge}
      {node.live && <LiveDot compact={compact} />}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Collapsed rail — icons-only level-1 destinations. Deeper tiers are hidden.
// ---------------------------------------------------------------------------
function CollapsedRail({
  items,
  selectedId,
  onSelect,
  density,
  selectionWash = false,
}: {
  items: readonly HudNavNode[];
  selectedId?: string | null;
  onSelect?: (node: HudNavNode) => void;
  density: HudDensity;
  selectionWash?: boolean;
}) {
  const compact = density === 'compact';
  return (
    <div className="flex flex-col items-center gap-1 px-1.5">
      {items.map(node => {
        const isSelected = selectedId === node.id;
        const Icon = node.icon;
        const label = typeof node.label === 'string' ? node.label : undefined;
        return (
          <button
            key={node.id}
            type="button"
            disabled={node.disabled}
            title={label}
            aria-label={label}
            aria-current={isSelected ? 'page' : undefined}
            onClick={() => !node.disabled && onSelect?.(node)}
            className={cx(
              'relative flex items-center justify-center rounded-md transition-colors',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40',
              compact ? 'h-8 w-8' : 'h-9 w-9',
              isSelected
                ? navRailSelectedBg(selectionWash)
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
              node.disabled && 'pointer-events-none opacity-50',
            )}
          >
            {Icon ? <Icon size={compact ? 16 : 18} /> : <span className="font-mono text-[11px] uppercase">{label?.slice(0, 2)}</span>}
            {node.live && (
              <span
                aria-hidden="true"
                className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--hud-nav-live)]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
