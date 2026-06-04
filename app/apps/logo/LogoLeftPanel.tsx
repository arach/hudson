'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, RotateCcw, ChevronRight, Code2 } from 'lucide-react';
import { HudsonContextMenu, type ContextMenuEntry } from 'hudsonkit/context-menu';
import { useLogo } from './LogoProvider';
import {
  compactLogoTemplateLabel,
  isBuiltinVariant,
  normalizeLogoTemplateLineage,
  type LogoTemplate,
} from './types';

// ---------------------------------------------------------------------------
// Left panel — variant selection (navigation only).
// Two-section tree: template roots and brand roots, both with recursive children.
// ---------------------------------------------------------------------------

// Persisted set holds IDs of *expanded* brand parents. Default (empty) =
// all brand families collapsed, matching the requested default state.
const EXPANDED_BRANDS_KEY = 'logo.sidebar.expandedBrands';

function loadExpandedBrands(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(EXPANDED_BRANDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((v): v is string => typeof v === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function persistExpandedBrands(set: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(EXPANDED_BRANDS_KEY, JSON.stringify([...set]));
  } catch { /* quota/full — fine to drop */ }
}

interface TemplateTreeNode {
  template: LogoTemplate;
  children: TemplateTreeNode[];
}

interface SidebarSections {
  styles: TemplateTreeNode[];
  brands: TemplateTreeNode[];
  orphans: TemplateTreeNode[]; // children whose parent isn't in the active set
}

/**
 * Bucket templates into the two sidebar sections.
 *
 * - Styles: root templates whose kind is not `brand`.
 * - Brands: root templates whose kind is `brand`.
 * - Children: nested recursively under their real parent, regardless of depth.
 * - Orphans: children whose parent is missing; rendered as roots so they remain reachable.
 *
 * Templates without explicit `kind` default to the style section at the root.
 */
export function bucketTemplatesForSidebar(templates: LogoTemplate[]): SidebarSections {
  const normalizedTemplates = normalizeLogoTemplateLineage(templates);
  const byId = new Map(normalizedTemplates.map(t => [t.id, t]));
  const childrenByParent = new Map<string, LogoTemplate[]>();

  for (const t of normalizedTemplates) {
    if (t.parentId) {
      if (byId.has(t.parentId)) {
        const list = childrenByParent.get(t.parentId) ?? [];
        list.push(t);
        childrenByParent.set(t.parentId, list);
      }
    }
  }

  const byName = (a: LogoTemplate, b: LogoTemplate) => a.name.localeCompare(b.name);
  const makeNode = (template: LogoTemplate): TemplateTreeNode => ({
    template,
    children: (childrenByParent.get(template.id) ?? [])
      .slice()
      .sort(byName)
      .map(makeNode),
  });

  const roots = normalizedTemplates.filter(t => !t.parentId).slice().sort(byName);
  const styles = roots.filter(t => t.kind !== 'brand').map(makeNode);
  const brands = roots.filter(t => t.kind === 'brand').map(makeNode);
  const orphans = normalizedTemplates
    .filter(t => t.parentId && !byId.has(t.parentId))
    .slice()
    .sort(byName)
    .map(makeNode);

  return { styles, brands, orphans };
}

function treeContainsTemplate(node: TemplateTreeNode, id: string): boolean {
  return node.template.id === id || node.children.some(child => treeContainsTemplate(child, id));
}

export function LogoLeftPanel() {
  const {
    setVariant, params,
    templates, discardTemplate, restoreTemplate, discardedIds,
    setCodeOpen,
  } = useLogo();

  const openCodeMode = useCallback((templateId: string) => {
    setVariant(templateId);
    setCodeOpen(true);
  }, [setVariant, setCodeOpen]);

  const [showDiscarded, setShowDiscarded] = useState(false);
  // Lazy init from localStorage. Component is 'use client' so this runs on the
  // client and doesn't risk hydration mismatch.
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(loadExpandedBrands);

  useEffect(() => {
    persistExpandedBrands(expandedBrands);
  }, [expandedBrands]);

  const activeTemplates = useMemo(
    () => templates.filter(t => !discardedIds.has(t.id)),
    [templates, discardedIds],
  );
  const sections = useMemo(() => bucketTemplatesForSidebar(activeTemplates), [activeTemplates]);
  const discardedTemplates = templates.filter(t => discardedIds.has(t.id));

  // Default: brand families collapsed. Set tracks the IDs that the user has
  // explicitly opened — anything not in the set renders collapsed.
  const isExpanded = (node: TemplateTreeNode) =>
    expandedBrands.has(node.template.id) || node.children.some(child => treeContainsTemplate(child, params.variant));

  const toggleBranch = (parentId: string) => {
    setExpandedBrands(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  const renderTreeNode = (node: TemplateTreeNode, depth: number, ancestors: LogoTemplate[] = []) => {
    const expanded = isExpanded(node);
    const hasChildren = node.children.length > 0;
    return (
      <div key={node.template.id} className="flex flex-col">
        <SidebarRow
          template={node.template}
          label={compactLogoTemplateLabel(node.template, ancestors)}
          active={params.variant === node.template.id}
          depth={depth}
          expandable={hasChildren}
          expanded={expanded}
          onToggleExpand={hasChildren ? () => toggleBranch(node.template.id) : undefined}
          onSelect={() => setVariant(node.template.id)}
          onDiscard={() => discardTemplate(node.template.id)}
          onOpenInCode={() => openCodeMode(node.template.id)}
        />
        {hasChildren && expanded && node.children.map(child => renderTreeNode(child, depth + 1, [...ancestors, node.template]))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3 px-2 py-3 text-sm overflow-y-auto h-full">
      {templates.length === 0 && (
        <div className="text-[11px] text-muted-foreground px-2 py-3 text-center border border-dashed border-border/60 rounded-lg mx-1">
          Loading templates
        </div>
      )}

      {/* Styles */}
      {sections.styles.length > 0 && (
        <div className="flex flex-col">
          <SectionHeader label="Templates" />
          {sections.styles.map(node => renderTreeNode(node, 0))}
        </div>
      )}

      {/* Brands */}
      {(sections.brands.length > 0 || sections.orphans.length > 0) && (
        <div className="flex flex-col">
          <SectionHeader label="Brands" />
          {sections.brands.map(node => renderTreeNode(node, 0))}
          {sections.orphans.map(node => renderTreeNode(node, 0))}
        </div>
      )}

      {/* Discarded templates (collapsible) */}
      {discardedTemplates.length > 0 && (
        <div className="flex flex-col mt-3">
          <button
            onClick={() => setShowDiscarded(v => !v)}
            className="flex items-center gap-1 px-2.5 h-6 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <ChevronRight size={11} strokeWidth={2} className={`-ml-0.5 transition-transform duration-200 ease-out ${showDiscarded ? 'rotate-90' : ''}`} />
            Discarded · {discardedTemplates.length}
          </button>
          {showDiscarded && (
            <div className="flex flex-col">
              {discardedTemplates.map(t => (
                <div
                  key={t.id}
                  className="group/drow flex items-center h-[30px] rounded-md pl-5 pr-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.045]"
                >
                  <span
                    className="flex-1 truncate font-sans text-[12.5px] leading-none tracking-[-0.005em]"
                    title={t.name}
                  >
                    {t.name}
                  </span>
                  <button
                    onClick={() => restoreTemplate(t.id)}
                    className="flex w-6 shrink-0 items-center justify-center rounded text-muted-foreground/80 opacity-0 transition-opacity hover:text-accent focus:opacity-100 group-hover/drow:opacity-100"
                    title="Restore template"
                  >
                    <RotateCcw size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header — compact uppercase label above each section.
// ---------------------------------------------------------------------------

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center px-2.5 h-6 mb-0.5 mt-3 first:mt-0 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60 select-none">
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar row — tight 28-30px row, text-only, accent-bar active state.
// ---------------------------------------------------------------------------

interface SidebarRowProps {
  template: LogoTemplate;
  label: string;
  active: boolean;
  depth: number;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onSelect: () => void;
  onDiscard: () => void;
  onOpenInCode: () => void;
}

function SidebarRow({
  template, label, active, depth, expandable, expanded, onToggleExpand, onSelect, onDiscard, onOpenInCode,
}: SidebarRowProps) {
  const isBuiltin = template.builtin === true || isBuiltinVariant(template.id);
  // Every row reserves a fixed caret gutter (the leading spacer + caret slot)
  // so sibling names align whether or not they have an expand caret. Nesting
  // depth shifts the whole row right in 14px steps.

  const menuItems = useMemo<ContextMenuEntry[]>(() => {
    const items: ContextMenuEntry[] = [
      {
        id: 'open-in-code',
        label: isBuiltin ? 'View code…' : 'Open in code…',
        action: onOpenInCode,
        icon: <Code2 size={12} />,
      },
    ];
    if (!isBuiltin) {
      items.push({ type: 'separator' });
      items.push({
        id: 'discard',
        label: 'Discard template',
        action: onDiscard,
        icon: <X size={12} />,
      });
    }
    return items;
  }, [isBuiltin, onOpenInCode, onDiscard]);

  return (
    <HudsonContextMenu items={menuItems}>
      <div
        style={depth > 0 ? { marginLeft: `${depth * 14}px` } : undefined}
        className={`group/row relative flex items-center h-[30px] rounded-md transition-colors ${
          active ? 'bg-accent/[0.07]' : 'hover:bg-foreground/[0.045]'
        }`}
      >
        {active && (
          <span
            aria-hidden="true"
            className="absolute -left-0.5 top-1/2 h-[15px] w-[2px] -translate-y-1/2 rounded-full bg-accent"
          />
        )}
        {/* Fixed caret gutter — keeps every name's left edge aligned. */}
        <span className="flex h-full w-5 shrink-0 items-center justify-center">
          {expandable && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-foreground/[0.06] hover:text-muted-foreground group-hover/row:text-muted-foreground/80"
              title={expanded ? 'Collapse' : 'Expand'}
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              <ChevronRight
                size={12}
                strokeWidth={2}
                className={`transition-transform duration-200 ease-out ${expanded ? 'rotate-90' : ''}`}
              />
            </button>
          )}
        </span>
        <button
          type="button"
          onClick={onSelect}
          title={template.name}
          className={`flex min-w-0 flex-1 items-center pr-1.5 text-left font-sans text-[12.5px] leading-none tracking-[-0.005em] transition-colors ${
            active
              ? 'font-medium text-foreground'
              : 'text-foreground/65 group-hover/row:text-foreground/90'
          }`}
        >
          <span className="truncate">{label}</span>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenInCode(); }}
          className="flex w-6 shrink-0 items-center justify-center text-muted-foreground/70 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover/row:opacity-100"
          title={isBuiltin ? 'View template code' : 'Open template in code mode'}
          aria-label="Open in code mode"
        >
          <Code2 size={11} />
        </button>
        {!isBuiltin && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDiscard(); }}
            className="flex w-6 shrink-0 items-center justify-center text-muted-foreground/70 opacity-0 transition-opacity hover:text-warning focus:opacity-100 group-hover/row:opacity-100"
            title="Discard template (recoverable for 7 days)"
            aria-label="Discard template"
          >
            <X size={11} />
          </button>
        )}
      </div>
    </HudsonContextMenu>
  );
}
