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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { HudDensity } from '../primitives';
import { cx } from '../patterns/utils';
import { HudTooltip } from '../behaviors/HudTooltip';
import {
  HudSideNavProvider,
  useHudSideNav,
  useOptionalHudSideNav,
  type HudSideNavCollapsible,
  type HudSideNavSide,
} from './context';
import { HudSideNavRail, HudSideNavCaret } from './primitives';
import {
  HUD_SIDE_NAV_HEADER_HEIGHT,
  LiveCountBadge,
  LiveDot,
  indentFor,
  navRailSelectedBg,
  navRowBg,
  navSpine,
  renderHudNavIcon,
  type HudNavIcon,
} from './shared';
import { useRovingNav } from './useRovingNav';

/** A single navigation node. Nodes nest via `children` to form the tier tree. */
export interface HudNavNode {
  /** Stable identity — also the value passed to `onSelect` / `selectedId`. */
  id: string;
  /** Row label. Plain text is ideal; any node is accepted. */
  label: React.ReactNode;
  /** Accessible/collapsed-rail label when `label` is not plain text. Falls back to `id`. */
  accessibilityLabel?: string;
  /** Optional Hudson icon component or preconfigured icon element. Rendered on
   *  destinations and leaves, and it is the only affordance shown in compact mode. */
  icon?: HudNavIcon;
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
  /** Initial expanded ids when uncontrolled. In uncontrolled mode, ancestors
   *  of `selectedId` are revealed on top of this as selection changes. */
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
  /** Structural width defaults used when this nav self-provides. */
  defaultExpandedWidth?: number;
  expandedWidth?: number;
  onExpandedWidthChange?: (width: number) => void;
  minExpandedWidth?: number;
  maxExpandedWidth?: number;
  collapsedWidth?: number;
  /** Settled-hover delay for compact labels when this nav self-provides. */
  tooltipDelay?: number;
  /** Render a rail toggle strip along the sidebar's inner edge. */
  rail?: boolean;
  /** Optional content pinned above the tree (brand row, workspace switch, …). */
  header?: React.ReactNode;
  /**
   * Compact override for `header`. Omit it (or pass `undefined`/`null`) to
   * reuse `header` on the icon rail; pass `false` for no header while
   * collapsed, e.g. when `HudWindowFrame`'s title bar carries the brand.
   */
  collapsedHeader?: React.ReactNode | false;
  /** Optional content pinned below the tree (account, status, actions, …). */
  footer?: React.ReactNode;
  /**
   * Compact override for `footer`. Omit it to reuse `footer` on the icon rail;
   * pass `false` for no footer while collapsed.
   */
  collapsedFooter?: React.ReactNode | false;
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

/** `false` means "nothing while collapsed"; `undefined`/`null` fall back to the expanded slot. */
function compactSlot(compact: React.ReactNode | false | undefined, expanded: React.ReactNode) {
  if (compact === false) return null;
  return compact ?? expanded;
}

export function HudSideNav(props: HudSideNavProps) {
  const outer = useOptionalHudSideNav();
  // Already inside a provider (composable usage) — consume it directly.
  if (outer) return <HudSideNavView {...props} />;

  // Standalone — self-provide. The legacy `collapsed` prop maps to a controlled
  // `icon`-mode provider so the shipped behavior is byte-identical.
  const {
    collapsed,
    defaultOpen,
    collapsible,
    side,
    persistKey,
    keyboardShortcut,
    defaultExpandedWidth,
    expandedWidth,
    onExpandedWidthChange,
    minExpandedWidth,
    maxExpandedWidth,
    collapsedWidth,
    tooltipDelay,
  } = props;
  return (
    <HudSideNavProvider
      {...(collapsed !== undefined ? { open: !collapsed } : {})}
      defaultOpen={defaultOpen ?? true}
      collapsible={collapsible ?? 'icon'}
      side={side ?? 'left'}
      persistKey={persistKey}
      keyboardShortcut={keyboardShortcut}
      defaultExpandedWidth={defaultExpandedWidth}
      expandedWidth={expandedWidth}
      onExpandedWidthChange={onExpandedWidthChange}
      minExpandedWidth={minExpandedWidth}
      maxExpandedWidth={maxExpandedWidth}
      collapsedWidth={collapsedWidth}
      tooltipDelay={tooltipDelay}
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
  collapsedHeader,
  collapsedFooter,
  density = 'default',
  selectionWash = false,
  rovingFocus = false,
  ariaLabel = 'Primary',
  className,
  empty,
}: HudSideNavProps) {
  const { state, collapsible, side, expandedWidth, collapsedWidth } = useHudSideNav();
  const rovingKeyDown = useRovingNav();
  const iconCollapsed = state === 'collapsed' && collapsible === 'icon';
  const offcanvasHidden = state === 'collapsed' && collapsible === 'offcanvas';
  const navRef = useRef<HTMLElement>(null);

  const [internalExpansion, setInternalExpansion] = useState(() => {
    const seed = new Set(defaultExpandedIds);
    if (selectedId && items) {
      for (const id of collectAncestors(items, selectedId) ?? []) seed.add(id);
    }
    return { ids: seed, revealedSelectedId: selectedId };
  });
  if (
    expandedIds === undefined &&
    internalExpansion.revealedSelectedId !== selectedId
  ) {
    // React supports a guarded render-time state adjustment for prop changes.
    // This reveals a newly selected node without a cascading effect render,
    // while still allowing the user to collapse it again until selection moves.
    const next = new Set(internalExpansion.ids);
    if (selectedId && items) {
      for (const id of collectAncestors(items, selectedId) ?? []) next.add(id);
    }
    setInternalExpansion({ ids: next, revealedSelectedId: selectedId });
  }
  const internalExpanded = internalExpansion.ids;
  const expanded = expandedIds ?? internalExpanded;

  const setExpanded = useCallback(
    (next: Set<string>) => {
      if (expandedIds === undefined) {
        setInternalExpansion((current) => ({ ...current, ids: next }));
      }
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
  const expandedBody = dataDriven ? (
    items!.length === 0 ? (
      empty ? <div className="px-3 py-4 text-[11px] text-muted-foreground">{empty}</div> : null
    ) : (
      <div className="flex flex-col gap-0.5">
        {items!.map((node) => (
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
  ) : children;
  const collapsedBody = dataDriven ? (
    items!.length === 0 ? (
      empty ? <div className="px-2 py-4 text-center text-[10px] text-muted-foreground">{empty}</div> : null
    ) : (
      <CollapsedRail
        items={items!}
        selectedId={selectedId}
        onSelect={onSelect}
        density={density}
        selectionWash={selectionWash}
      />
    )
  ) : children;
  const keepBothPresentations = dataDriven && collapsible === 'icon';
  const visibleHeader = iconCollapsed ? compactSlot(collapsedHeader, header) : header;
  const visibleFooter = iconCollapsed ? compactSlot(collapsedFooter, footer) : footer;

  useEffect(() => {
    const nav = navRef.current;
    const active = document.activeElement;
    if (!nav || !(active instanceof HTMLElement) || !nav.contains(active)) return;
    if (!active.closest('[data-rail-content]')) return;

    const pane = nav.querySelector<HTMLElement>(
      `[data-rail-content="${iconCollapsed ? 'collapsed' : 'expanded'}"]`,
    );
    const target =
      pane?.querySelector<HTMLElement>('[aria-current="page"]') ??
      pane?.querySelector<HTMLElement>('button:not(:disabled)');
    if (!target) return;
    const frame = requestAnimationFrame(() => target.focus());
    return () => cancelAnimationFrame(frame);
  }, [iconCollapsed, selectedId]);

  return (
    <nav
      ref={navRef}
      aria-label={ariaLabel}
      data-state={state}
      data-collapsible={collapsible === 'none' ? undefined : collapsible}
      data-side={side}
      data-selection-wash={selectionWash ? '' : undefined}
      onKeyDown={rovingFocus ? rovingKeyDown : undefined}
      className={cx('relative flex min-h-0 flex-col', offcanvasHidden && 'hidden', className)}
    >
      {visibleHeader && (
        <div
          className={cx(
            'flex shrink-0 items-center border-b border-[color-mix(in_srgb,var(--hud-chrome-border,oklch(var(--border)))_70%,transparent)]',
            density === 'compact' ? 'px-2' : 'px-3',
          )}
          style={{ height: `var(--hud-side-nav-header-height, ${HUD_SIDE_NAV_HEADER_HEIGHT}px)` }}
        >
          {visibleHeader}
        </div>
      )}
      {keepBothPresentations ? (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            data-rail-content="expanded"
            aria-hidden={iconCollapsed}
            inert={iconCollapsed}
            className={cx(
              'absolute inset-0 overflow-y-auto frame-scrollbar transition-opacity motion-reduce:delay-0 motion-reduce:duration-[1ms]',
              iconCollapsed
                ? 'pointer-events-none opacity-0 duration-[90ms] ease-linear'
                : 'opacity-100 delay-[90ms] duration-[120ms] ease-out',
            )}
          >
            <div
              className={density === 'compact' ? 'py-1.5' : 'py-2'}
              style={{ width: expandedWidth }}
            >
              {expandedBody}
            </div>
          </div>
          <div
            data-rail-content="collapsed"
            aria-hidden={!iconCollapsed}
            inert={!iconCollapsed}
            className={cx(
              'absolute inset-0 overflow-y-auto frame-scrollbar transition-opacity motion-reduce:delay-0 motion-reduce:duration-[1ms]',
              iconCollapsed
                ? 'opacity-100 delay-[90ms] duration-[120ms] ease-out'
                : 'pointer-events-none opacity-0 duration-[90ms] ease-linear',
            )}
          >
            <div
              className={density === 'compact' ? 'py-1.5' : 'py-2'}
              style={{ width: collapsedWidth }}
            >
              {collapsedBody}
            </div>
          </div>
        </div>
      ) : (
        <div
          className={cx(
            'min-h-0 flex-1 overflow-y-auto frame-scrollbar',
            density === 'compact' ? 'py-1.5' : 'py-2',
          )}
        >
          {expandedBody}
        </div>
      )}
      {visibleFooter && (
        <div className="shrink-0 border-t border-[color-mix(in_srgb,var(--hud-chrome-border,oklch(var(--border)))_70%,transparent)] p-3">
          {visibleFooter}
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
          aria-expanded={isExpanded}
          onClick={activate}
          style={{ paddingLeft: indentFor(depth, compact) }}
          className={cx(
            'group flex w-full items-center gap-1.5 pr-3 font-mono uppercase transition-colors',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40 focus-visible:ring-inset',
            compact ? 'py-1 text-[9px] tracking-[0.16em]' : 'py-1.5 text-[10px] tracking-[0.18em]',
            node.disabled
              ? 'pointer-events-none opacity-50'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <HudSideNavCaret expanded={isExpanded} />
          <span className="min-w-0 flex-1 truncate text-left">{node.label}</span>
          <TrailingCluster node={node} compact={compact} />
        </button>
        {isExpanded && (
          <div className="flex flex-col">
            {children.map((child) => (
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

  const isDestination = depth === 0;
  const renderedIcon = renderHudNavIcon(
    node.icon,
    isDestination ? (compact ? 15 : 16) : compact ? 13 : 14,
    cx('shrink-0', isSelected ? 'text-foreground' : 'text-muted-foreground'),
  );

  return (
    <div className="flex flex-col">
      <button
        type="button"
        disabled={node.disabled}
        aria-current={isSelected ? 'page' : undefined}
        aria-expanded={hasChildren ? isExpanded : undefined}
        onClick={activate}
        style={{ paddingLeft: indentFor(depth, compact) }}
        className={cx(
          'group flex w-full items-center gap-2 border-l-2 pr-2.5 text-left transition-colors',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40 focus-visible:ring-inset',
          compact ? 'py-1.5' : 'py-2',
          navSpine(isSelected, node.live),
          navRowBg(isSelected, selectionWash),
          node.disabled && 'pointer-events-none opacity-50',
        )}
      >
        {renderedIcon ?? (
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
              ? compact
                ? 'text-[11px] font-medium'
                : 'text-[12px] font-medium'
              : compact
              ? 'text-[10px]'
              : 'text-[11px]',
            isSelected ? 'text-foreground' : 'text-foreground/78 group-hover:text-foreground',
          )}
        >
          {node.label}
        </span>
        <TrailingCluster node={node} compact={compact} />
      </button>

      {hasChildren && isExpanded && (
        <div className="flex flex-col">
          {children.map((child) => (
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
      {typeof node.count === 'number' && <LiveCountBadge count={node.count} live={node.live} />}
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
  const { side, tooltipDelay } = useHudSideNav();
  return (
    <div className="flex flex-col items-center gap-1 px-1.5">
      {items.map((node) => {
        const isSelected = selectedId === node.id;
        const renderedIcon = renderHudNavIcon(node.icon, compact ? 16 : 18);
        const label =
          node.accessibilityLabel ?? (typeof node.label === 'string' ? node.label : node.id);
        return (
          <HudTooltip
            key={node.id}
            content={label}
            side={side === 'left' ? 'right' : 'left'}
            delay={tooltipDelay}
            disabled={node.disabled}
          >
            <button
              type="button"
              disabled={node.disabled}
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
              {renderedIcon ?? (
                <span className="font-mono text-[11px] uppercase">{label.slice(0, 2)}</span>
              )}
              {node.live && (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--hud-nav-live)]"
                />
              )}
            </button>
          </HudTooltip>
        );
      })}
    </div>
  );
}
