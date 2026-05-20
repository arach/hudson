'use client';
import { useEffect, useMemo, useState } from 'react';
import { X, RotateCcw, ChevronRight } from 'lucide-react';
import { useLogo } from './LogoProvider';
import { isBuiltinVariant, type LogoTemplate } from './types';

// ---------------------------------------------------------------------------
// Left panel — variant selection (navigation only).
// Two-section tree: STYLES (flat) and BRANDS (collapsible parents with children).
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

interface BrandGroup {
  parent: LogoTemplate;
  children: LogoTemplate[];
}

interface SidebarSections {
  styles: LogoTemplate[];
  brands: BrandGroup[];
  orphans: LogoTemplate[]; // brand children whose parent isn't in the active set
}

/**
 * Bucket templates into the two sidebar sections.
 *
 * - Styles: kind === 'style' (or no kind on a non-brand root) — flat alpha list.
 * - Brands: kind === 'brand' && !parentId — parents, alpha-sorted, with their
 *   alpha-sorted children (kind === 'brand' && parentId === parent.id).
 * - Orphans: brand children whose parent is missing — rendered as roots in the
 *   brands section so they remain reachable.
 *
 * Templates without explicit `kind` default to 'style' grouping. A brand child
 * (has parentId) always lives in the brands section regardless of kind.
 */
function bucket(templates: LogoTemplate[]): SidebarSections {
  const byId = new Map(templates.map(t => [t.id, t]));
  const styles: LogoTemplate[] = [];
  const brandParents: LogoTemplate[] = [];
  const childrenByParent = new Map<string, LogoTemplate[]>();
  const orphans: LogoTemplate[] = [];

  for (const t of templates) {
    if (t.parentId) {
      if (byId.has(t.parentId)) {
        const list = childrenByParent.get(t.parentId) ?? [];
        list.push(t);
        childrenByParent.set(t.parentId, list);
      } else {
        orphans.push(t);
      }
      continue;
    }
    if (t.kind === 'brand') {
      brandParents.push(t);
    } else {
      // No parent, not brand → style. Covers explicit 'style' and untagged.
      styles.push(t);
    }
  }

  const byName = (a: LogoTemplate, b: LogoTemplate) => a.name.localeCompare(b.name);
  styles.sort(byName);
  brandParents.sort(byName);
  orphans.sort(byName);

  const brands: BrandGroup[] = brandParents.map(parent => ({
    parent,
    children: (childrenByParent.get(parent.id) ?? []).slice().sort(byName),
  }));

  return { styles, brands, orphans };
}

export function LogoLeftPanel() {
  const {
    setVariant, params,
    templates, discardTemplate, restoreTemplate, discardedIds,
  } = useLogo();

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
  const sections = useMemo(() => bucket(activeTemplates), [activeTemplates]);
  const discardedTemplates = templates.filter(t => discardedIds.has(t.id));

  // Default: brand families collapsed. Set tracks the IDs that the user has
  // explicitly opened — anything not in the set renders collapsed.
  const isExpanded = (parentId: string) => expandedBrands.has(parentId);

  const toggleBrand = (parentId: string) => {
    setExpandedBrands(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3 px-2 py-3 text-sm overflow-y-auto h-full">
      {templates.length === 0 && (
        <div className="text-[11px] text-muted-foreground px-2 py-3 text-center border border-dashed border-border/60 rounded-lg mx-1">
          Loading templates...
        </div>
      )}

      {/* Styles */}
      {sections.styles.length > 0 && (
        <div className="flex flex-col">
          <SectionHeader label="Templates" />
          {sections.styles.map(t => (
            <SidebarRow
              key={t.id}
              template={t}
              active={params.variant === t.id}
              depth={0}
              onSelect={() => setVariant(t.id)}
              onDiscard={() => discardTemplate(t.id)}
            />
          ))}
        </div>
      )}

      {/* Brands */}
      {(sections.brands.length > 0 || sections.orphans.length > 0) && (
        <div className="flex flex-col">
          <SectionHeader label="Brands" />
          {sections.brands.map(group => {
            const expanded = isExpanded(group.parent.id);
            const hasChildren = group.children.length > 0;
            return (
              <div key={group.parent.id} className="flex flex-col">
                <SidebarRow
                  template={group.parent}
                  active={params.variant === group.parent.id}
                  depth={0}
                  expandable={hasChildren}
                  expanded={expanded}
                  onToggleExpand={hasChildren ? () => toggleBrand(group.parent.id) : undefined}
                  onSelect={() => setVariant(group.parent.id)}
                  onDiscard={() => discardTemplate(group.parent.id)}
                />
                {hasChildren && expanded && group.children.map(child => (
                  <SidebarRow
                    key={child.id}
                    template={child}
                    active={params.variant === child.id}
                    depth={1}
                    onSelect={() => setVariant(child.id)}
                    onDiscard={() => discardTemplate(child.id)}
                  />
                ))}
              </div>
            );
          })}
          {sections.orphans.map(t => (
            <SidebarRow
              key={t.id}
              template={t}
              active={params.variant === t.id}
              depth={0}
              onSelect={() => setVariant(t.id)}
              onDiscard={() => discardTemplate(t.id)}
            />
          ))}
        </div>
      )}

      {/* Discarded templates (collapsible) */}
      {discardedTemplates.length > 0 && (
        <div className="flex flex-col mt-3">
          <button
            onClick={() => setShowDiscarded(v => !v)}
            className="flex items-center gap-1.5 px-2 h-6 text-[11px] uppercase tracking-[0.06em] text-muted-foreground/80 hover:text-foreground/80 transition-colors"
          >
            <ChevronRight size={10} className={`transition-transform ${showDiscarded ? 'rotate-90' : ''}`} />
            Discarded ({discardedTemplates.length})
          </button>
          {showDiscarded && (
            <div className="flex flex-col">
              {discardedTemplates.map(t => (
                <div
                  key={t.id}
                  className="flex items-center gap-1.5 pl-4 pr-1.5 h-[28px] text-muted-foreground"
                >
                  <span
                    className="flex-1 text-[13px] truncate leading-[1.2]"
                    title={t.name}
                  >
                    {t.name}
                  </span>
                  <button
                    onClick={() => restoreTemplate(t.id)}
                    className="p-1 rounded text-muted-foreground/80 hover:text-accent hover:bg-foreground/[0.06] transition-colors"
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
    <div className="flex items-center px-2 h-6 mt-3 first:mt-0 text-[11px] uppercase tracking-[0.06em] text-muted-foreground/70 select-none">
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar row — tight 28-30px row, text-only, accent-bar active state.
// ---------------------------------------------------------------------------

interface SidebarRowProps {
  template: LogoTemplate;
  active: boolean;
  depth: 0 | 1;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onSelect: () => void;
  onDiscard: () => void;
}

function SidebarRow({
  template, active, depth, expandable, expanded, onToggleExpand, onSelect, onDiscard,
}: SidebarRowProps) {
  const isBuiltin = isBuiltinVariant(template.id);
  // Indent: parents have 8px hang for the caret; children indent 14-16px under
  // the parent text. Without an expand caret, parents align with the section.
  const padLeft = depth === 1 ? 'pl-[22px]' : expandable ? 'pl-1' : 'pl-2';

  return (
    <div className="group/row relative flex items-stretch">
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-[3px] bottom-[3px] w-[2px] bg-accent rounded-sm"
        />
      )}
      {expandable && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
          className="flex items-center justify-center w-5 shrink-0 text-muted-foreground/70 hover:text-foreground/80 transition-colors"
          title={expanded ? 'Collapse' : 'Expand'}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRight
            size={8}
            className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </button>
      )}
      <button
        type="button"
        onClick={onSelect}
        title={template.name}
        className={`flex-1 flex items-center min-w-0 ${padLeft} pr-1.5 h-[28px] text-left text-[13px] leading-[1.2] transition-colors ${
          active
            ? 'text-foreground'
            : 'text-foreground/70 hover:text-foreground/90 hover:bg-foreground/[0.06] dark:hover:bg-white/[0.06]'
        }`}
      >
        <span className="truncate">{template.name}</span>
      </button>
      {!isBuiltin && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDiscard(); }}
          className="opacity-0 group-hover/row:opacity-100 focus:opacity-100 flex items-center justify-center w-6 shrink-0 text-muted-foreground/70 hover:text-warning transition-opacity"
          title="Discard template (recoverable for 7 days)"
          aria-label="Discard template"
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}
