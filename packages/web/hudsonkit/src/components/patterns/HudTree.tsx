'use client';

import React, { useCallback, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { HudListItem } from '../primitives';
import type { HudDensity } from '../primitives';
import { cx } from './utils';

export interface HudTreeNode {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  trailing?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
  children?: readonly HudTreeNode[];
}

export interface HudTreeProps {
  nodes: readonly HudTreeNode[];
  selectedId?: string | null;
  expandedIds?: ReadonlySet<string>;
  defaultExpandedIds?: Iterable<string>;
  onExpandedChange?: (expandedIds: ReadonlySet<string>) => void;
  onSelect?: (node: HudTreeNode) => void;
  density?: HudDensity;
  className?: string;
  empty?: React.ReactNode;
}

export function HudTree({
  nodes,
  selectedId,
  expandedIds,
  defaultExpandedIds,
  onExpandedChange,
  onSelect,
  density = 'default',
  className,
  empty,
}: HudTreeProps) {
  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(
    () => new Set(defaultExpandedIds),
  );
  const expanded = expandedIds ?? internalExpanded;

  const setExpanded = useCallback((next: Set<string>) => {
    if (!expandedIds) setInternalExpanded(next);
    onExpandedChange?.(next);
  }, [expandedIds, onExpandedChange]);

  const toggleExpanded = useCallback((id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  }, [expanded, setExpanded]);

  if (nodes.length === 0 && empty) {
    return <div className={cx('px-3 py-4 text-[11px] text-muted-foreground', className)}>{empty}</div>;
  }

  return (
    <div className={cx('flex flex-col gap-1', className)}>
      {nodes.map(node => (
        <HudTreeRow
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          expanded={expanded}
          onToggleExpanded={toggleExpanded}
          onSelect={onSelect}
          density={density}
        />
      ))}
    </div>
  );
}

interface HudTreeRowProps {
  node: HudTreeNode;
  depth: number;
  selectedId?: string | null;
  expanded: ReadonlySet<string>;
  onToggleExpanded: (id: string) => void;
  onSelect?: (node: HudTreeNode) => void;
  density: HudDensity;
}

function HudTreeRow({
  node,
  depth,
  selectedId,
  expanded,
  onToggleExpanded,
  onSelect,
  density,
}: HudTreeRowProps) {
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const isExpanded = hasChildren && expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const paddingLeft = useMemo(() => depth * (density === 'compact' ? 12 : 14), [depth, density]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-stretch gap-1" style={{ paddingLeft }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleExpanded(node.id)}
            className="flex w-5 shrink-0 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-muted/40 hover:text-foreground"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronRight size={12} className={cx('transition-transform duration-150', isExpanded && 'rotate-90')} />
          </button>
        ) : (
          <span className="w-5 shrink-0" aria-hidden="true" />
        )}

        <div className="min-w-0 flex-1">
          <HudListItem
            selected={isSelected}
            disabled={node.disabled}
            icon={node.icon}
            description={node.description}
            trailing={(
              <>
                {node.badge}
                {node.trailing}
              </>
            )}
            density={density}
            onClick={onSelect ? () => onSelect(node) : undefined}
            className="rounded-sm"
          >
            {node.title}
          </HudListItem>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="ml-[10px] border-l border-border/45">
          {children.map(child => (
            <HudTreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expanded={expanded}
              onToggleExpanded={onToggleExpanded}
              onSelect={onSelect}
              density={density}
            />
          ))}
        </div>
      )}
    </div>
  );
}
