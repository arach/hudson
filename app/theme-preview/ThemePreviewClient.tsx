'use client';

import Link from 'next/link';
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppShell } from 'hudsonkit/app-shell';
import type { CommandOption, HudsonApp } from 'hudsonkit';
import { useTheme } from 'hudsonkit';
import {
  ArrowRight,
  BookOpenText,
  LayoutTemplate,
  Monitor,
  Palette,
  PanelsTopLeft,
  ScanSearch,
  SlidersHorizontal,
  Sparkles,
  SwatchBook,
  Type,
} from 'lucide-react';

type PreviewSection = 'overview' | 'surfaces' | 'typography';
type PreviewDensity = 'calm' | 'compact';

interface PreviewCard {
  id: string;
  title: string;
  eyebrow: string;
  body: string;
  tone: 'accent' | 'info' | 'warning';
}

interface ThemePreviewContextValue {
  section: PreviewSection;
  setSection: (section: PreviewSection) => void;
  density: PreviewDensity;
  setDensity: (density: PreviewDensity) => void;
  query: string;
  setQuery: (query: string) => void;
  selectedCardId: string;
  setSelectedCardId: (id: string) => void;
}

const PREVIEW_CARDS: PreviewCard[] = [
  {
    id: 'hudson-chrome',
    title: 'Chrome Fidelity',
    eyebrow: 'Shell Surface',
    body: 'Navigation, panels, command palette, minimap, and terminal now read from semantic tokens instead of neutral hard-codes.',
    tone: 'accent',
  },
  {
    id: 'editorial-template',
    title: 'Editorial Template',
    eyebrow: 'Alternate Aesthetic',
    body: 'Warmer surfaces, tighter radii, and a serif-capable content treatment make the template change obvious beyond color alone.',
    tone: 'warning',
  },
  {
    id: 'runtime-switching',
    title: 'Runtime Switching',
    eyebrow: 'Live Theme Axis',
    body: 'Theme and template both persist in localStorage and update immediately without a rebuild or a full reload.',
    tone: 'info',
  },
  {
    id: 'legacy-vars',
    title: 'Legacy Compatibility',
    eyebrow: 'Token Bridge',
    body: 'Existing app content using --hud-* continues to work because the template scopes re-point those values at the new semantic layer.',
    tone: 'accent',
  },
  {
    id: 'light-mode',
    title: 'Light Mode Delivery',
    eyebrow: 'Visual QA',
    body: 'Switch to light mode to validate near-white surfaces, readable borders, and chromed panels across the AppShell primitives.',
    tone: 'info',
  },
];

const ThemePreviewContext = createContext<ThemePreviewContextValue | null>(null);

function useThemePreview() {
  const context = useContext(ThemePreviewContext);

  if (!context) {
    throw new Error('useThemePreview must be used inside ThemePreviewProvider');
  }

  return context;
}

function ThemePreviewProvider({
  children,
}: {
  children: ReactNode;
  disabled?: boolean;
  visible?: boolean;
  focused?: boolean;
}) {
  const [section, setSection] = useState<PreviewSection>('overview');
  const [density, setDensity] = useState<PreviewDensity>('calm');
  const [query, setQuery] = useState('');
  const [selectedCardId, setSelectedCardId] = useState(PREVIEW_CARDS[0].id);

  const value = useMemo<ThemePreviewContextValue>(() => ({
    section,
    setSection,
    density,
    setDensity,
    query,
    setQuery,
    selectedCardId,
    setSelectedCardId,
  }), [density, query, section, selectedCardId]);

  return (
    <ThemePreviewContext.Provider value={value}>
      {children}
    </ThemePreviewContext.Provider>
  );
}

function ThemeToolbar() {
  const { theme, resolvedTheme, template, setTheme, setTemplate } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <div className="hidden items-center gap-1 rounded-full border border-border/70 bg-card/80 p-1 md:flex">
        {(['light', 'dark', 'system'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setTheme(option)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] transition-colors ${
              theme === option
                ? 'bg-accent/12 text-accent'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <select
        aria-label="Select template"
        value={template}
        onChange={(event) => setTemplate(event.target.value as typeof template)}
        className="h-7 rounded-md border border-input/70 bg-card px-2.5 text-[11px] font-mono uppercase tracking-[0.14em] text-foreground outline-none transition-colors focus:border-ring"
      >
        <option value="hudson">Hudson</option>
        <option value="editorial">Editorial</option>
      </select>
      <div className="hidden rounded-full bg-info/10 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-info lg:block">
        {resolvedTheme}
      </div>
    </div>
  );
}

function ThemePreviewNavCenter() {
  const { template, resolvedTheme } = useTheme();

  return (
    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
      <Sparkles size={11} className="text-accent" />
      <span>{template}</span>
      <span className="text-border">/</span>
      <span>{resolvedTheme}</span>
    </div>
  );
}

function ThemePreviewLeftPanel() {
  const { section, setSection, density, setDensity } = useThemePreview();

  return (
    <div className="space-y-6 p-4">
      <div>
        <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
          Sections
        </div>
        <div className="space-y-2">
          {[
            { id: 'overview', label: 'Overview', icon: PanelsTopLeft },
            { id: 'surfaces', label: 'Surface Grid', icon: SwatchBook },
            { id: 'typography', label: 'Typography', icon: Type },
          ].map((item) => {
            const isActive = section === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id as PreviewSection)}
                className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors ${
                  isActive
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-border bg-card text-foreground/80 hover:border-ring/50 hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon size={14} />
                <span className="text-[12px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
          Density
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['calm', 'compact'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDensity(option)}
              className={`rounded-md border px-3 py-2 text-[11px] font-mono uppercase tracking-[0.16em] transition-colors ${
                density === option
                  ? 'border-info/35 bg-info/10 text-info'
                  : 'border-border bg-card text-foreground/80 hover:bg-muted hover:text-foreground'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[var(--radius)] border border-border/70 bg-card/70 p-3">
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
          <BookOpenText size={12} />
          What To Check
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-card-foreground">
          Toggle theme and template from the nav or `Cmd+K`, then compare the chrome, borders,
          radii, and serif treatment in the content area.
        </p>
      </div>
    </div>
  );
}

function ThemePreviewLeftFooter() {
  return (
    <div className="border-t border-border/60 bg-card/80 px-4 py-3">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.16em] text-foreground/80 transition-colors hover:text-foreground"
      >
        Back Home
        <ArrowRight size={12} />
      </Link>
    </div>
  );
}

function ThemePreviewContent() {
  const { template, resolvedTheme } = useTheme();
  const { section, query, density, selectedCardId, setSelectedCardId } = useThemePreview();
  const resolvedThemeLabel = resolvedTheme ?? 'system';
  const gapClass = density === 'compact' ? 'gap-3' : 'gap-5';
  const filteredCards = PREVIEW_CARDS.filter((card) => {
    if (!query) return true;
    const haystack = `${card.title} ${card.eyebrow} ${card.body}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-8 md:px-8">
        <div className="rounded-[var(--radius)] border border-border/70 bg-gradient-to-br from-card via-card to-background p-6 shadow-[var(--hud-shadow-panel)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.22em] text-accent">
                <Monitor size={11} />
                Full Chrome Theming Preview
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                The AppShell theming work is easiest to judge here.
              </h1>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                This route uses the SDK `AppShell`, so the nav, panels, command palette, status bar,
                terminal drawer, and tool accordion all reflect the semantic token system.
              </p>
            </div>
            <div className="grid min-w-[220px] gap-3 md:grid-cols-1">
              <MetricCard label="Theme" value={resolvedThemeLabel} tone="info" />
              <MetricCard label="Template" value={template} tone="accent" />
              <MetricCard label="Radius" value={template === 'editorial' ? '4px' : '8px'} tone="warning" />
            </div>
          </div>
        </div>

        {section === 'overview' && (
          <div className={`mt-6 grid md:grid-cols-2 xl:grid-cols-3 ${gapClass}`}>
            {filteredCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => setSelectedCardId(card.id)}
                className={`rounded-[var(--radius)] border p-5 text-left transition-transform transition-colors hover:-translate-y-0.5 ${
                  selectedCardId === card.id
                    ? toneClasses(card.tone, true)
                    : 'border-border/70 bg-card/70 text-card-foreground hover:border-ring/50'
                }`}
              >
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                  {card.eyebrow}
                </div>
                <div className="mt-3 text-lg font-semibold">{card.title}</div>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                  {card.body}
                </p>
              </button>
            ))}
          </div>
        )}

        {section === 'surfaces' && (
          <div className={`mt-6 grid md:grid-cols-2 xl:grid-cols-3 ${gapClass}`}>
            <SurfaceCard label="Background" className="bg-background text-foreground border-border" />
            <SurfaceCard label="Card" className="bg-card text-card-foreground border-border" />
            <SurfaceCard label="Muted" className="bg-muted text-secondary-foreground border-border" />
            <SurfaceCard label="Accent" className="bg-accent text-accent-foreground border-accent/30" />
            <SurfaceCard label="Info" className="bg-info/15 text-info border-info/30" />
            <SurfaceCard label="Warning" className="bg-warning/15 text-warning border-warning/30" />
            <SurfaceCard label="Destructive" className="bg-destructive/12 text-destructive border-destructive/30" />
            <SurfaceCard label="Popover" className="bg-popover text-popover-foreground border-border" />
            <SurfaceCard label="Primary" className="bg-primary text-primary-foreground border-primary/20" />
          </div>
        )}

        {section === 'typography' && (
          <div className={`mt-6 grid lg:grid-cols-[1.25fr_0.75fr] ${gapClass}`}>
            <div className="rounded-[var(--radius)] border border-border/70 bg-card/70 p-6">
              <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
                Sans Body
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                Semantic tokens are doing the heavy lifting now.
              </h2>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                The shell chrome no longer depends on hard-coded neutral and emerald utility classes.
                That means the same components can render a crisp near-white light mode and still stay
                close to the original dark Hudson look.
              </p>
            </div>
            <div
              className="rounded-[var(--radius)] border border-border/70 bg-card/70 p-6"
              style={{ fontFamily: 'var(--hud-font-serif)' }}
            >
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Serif Voice
              </div>
              <div className="mt-3 text-2xl leading-tight text-card-foreground">
                Editorial is meant to feel warmer, tighter, and a touch more printed.
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
                If you load Source Serif 4, this panel becomes the clearest proof that templates can
                shift typography and tone, not only color.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ThemePreviewInspector() {
  const { theme, resolvedTheme, template } = useTheme();
  const { section, density, query, selectedCardId } = useThemePreview();
  const resolvedThemeLabel = resolvedTheme ?? 'system';

  return (
    <div className="space-y-4 p-4">
      <InspectorBlock title="Runtime State">
        <InspectorRow label="Theme" value={theme} />
        <InspectorRow label="Resolved" value={resolvedThemeLabel} />
        <InspectorRow label="Template" value={template} />
        <InspectorRow label="Section" value={section} />
        <InspectorRow label="Density" value={density} />
        <InspectorRow label="Query" value={query || 'none'} />
      </InspectorBlock>

      <InspectorBlock title="Selected Surface">
        <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-[13px] text-card-foreground">
          {PREVIEW_CARDS.find((card) => card.id === selectedCardId)?.title ?? 'None'}
        </div>
      </InspectorBlock>

      <InspectorBlock title="Token Swatches">
        <div className="grid grid-cols-2 gap-2">
          <SwatchChip label="bg" swatchClass="bg-background" />
          <SwatchChip label="card" swatchClass="bg-card" />
          <SwatchChip label="accent" swatchClass="bg-accent" />
          <SwatchChip label="info" swatchClass="bg-info" />
          <SwatchChip label="warn" swatchClass="bg-warning" />
          <SwatchChip label="border" swatchClass="bg-border" />
        </div>
      </InspectorBlock>
    </div>
  );
}

function ThemePreviewTerminal() {
  const { theme, template } = useTheme();

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <div className="border-b border-border/60 px-4 py-3 text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
        Theme Commands
      </div>
      <div className="space-y-4 p-4 font-mono text-[13px]">
        <div className="rounded-md border border-border/60 bg-card/70 p-3 text-card-foreground">
          Current preference: <span className="text-accent">{theme}</span> /{' '}
          <span className="text-info">{template}</span>
        </div>
        <pre className="overflow-x-auto rounded-md border border-border/60 bg-card/70 p-3 text-muted-foreground">
{`Cmd+K
Theme: Light
Theme: Dark
Theme: System
Template: Hudson
Template: Editorial
Template: Drafting`}
        </pre>
      </div>
    </div>
  );
}

function PaletteTool() {
  return (
    <div className="grid grid-cols-2 gap-2 py-1">
      <SwatchChip label="accent" swatchClass="bg-accent" />
      <SwatchChip label="info" swatchClass="bg-info" />
      <SwatchChip label="warning" swatchClass="bg-warning" />
      <SwatchChip label="destructive" swatchClass="bg-destructive" />
    </div>
  );
}

function TypographyTool() {
  return (
    <div className="space-y-2 py-1">
      <div className="rounded-md border border-border/60 bg-card/60 p-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        Sans chrome still stays clean.
      </div>
      <div
        className="rounded-md border border-border/60 bg-card/60 p-3 text-[15px] leading-relaxed text-card-foreground"
        style={{ fontFamily: 'var(--hud-font-serif)' }}
      >
        Editorial adds a warmer serif voice to content surfaces.
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'accent' | 'info' | 'warning';
}) {
  return (
    <div className={`rounded-[var(--radius)] border px-4 py-3 ${toneClasses(tone, true)}`}>
      <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold capitalize">{value}</div>
    </div>
  );
}

function SurfaceCard({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <div className={`rounded-[var(--radius)] border p-5 ${className}`}>
      <div className="text-[10px] font-mono uppercase tracking-[0.22em] opacity-70">
        {label}
      </div>
      <div className="mt-6 text-lg font-semibold">Semantic sample</div>
      <div className="mt-2 text-[14px] leading-relaxed opacity-80">
        This surface is reading from the active theme and template tokens.
      </div>
    </div>
  );
}

function InspectorBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-border/70 bg-card/70 p-3">
      <div className="mb-3 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InspectorRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/50 px-3 py-2 text-[12px]">
      <span className="font-mono uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="text-card-foreground">{value}</span>
    </div>
  );
}

function SwatchChip({
  label,
  swatchClass,
}: {
  label: string;
  swatchClass: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/50 px-2 py-2">
      <div className={`h-4 w-4 rounded-full border border-white/10 ${swatchClass}`} />
      <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function toneClasses(tone: PreviewCard['tone'], active: boolean) {
  if (tone === 'accent') {
    return active
      ? 'border-accent/35 bg-accent/10 text-card-foreground'
      : 'border-border/70 bg-card/70 text-card-foreground';
  }
  if (tone === 'info') {
    return active
      ? 'border-info/35 bg-info/10 text-card-foreground'
      : 'border-border/70 bg-card/70 text-card-foreground';
  }
  return active
    ? 'border-warning/35 bg-warning/10 text-card-foreground'
    : 'border-border/70 bg-card/70 text-card-foreground';
}

const themePreviewApp: HudsonApp = {
  id: 'theme-preview',
  name: 'Theme Preview',
  description: 'Visual QA surface for the AppShell theming system',
  mode: 'panel',
  leftPanel: {
    title: 'Preview',
    icon: <LayoutTemplate size={12} />,
  },
  rightPanel: {
    title: 'Inspector',
    icon: <ScanSearch size={12} />,
  },
  Provider: ThemePreviewProvider,
  tools: [
    {
      id: 'palette',
      name: 'Palette',
      icon: <Palette size={11} />,
      Component: PaletteTool,
    },
    {
      id: 'type',
      name: 'Typography',
      icon: <Type size={11} />,
      Component: TypographyTool,
    },
  ],
  slots: {
    Content: ThemePreviewContent,
    LeftPanel: ThemePreviewLeftPanel,
    Inspector: ThemePreviewInspector,
    LeftFooter: ThemePreviewLeftFooter,
    Terminal: ThemePreviewTerminal,
  },
  hooks: {
    useCommands: () => {
      const { setSection, setDensity, setSelectedCardId } = useThemePreview();

      return [
        {
          id: 'preview:overview',
          label: 'Show Overview',
          shortcut: 'Cmd+1',
          icon: <PanelsTopLeft size={14} />,
          action: () => setSection('overview'),
        },
        {
          id: 'preview:surfaces',
          label: 'Show Surface Grid',
          shortcut: 'Cmd+2',
          icon: <SwatchBook size={14} />,
          action: () => setSection('surfaces'),
        },
        {
          id: 'preview:typography',
          label: 'Show Typography View',
          shortcut: 'Cmd+3',
          icon: <Type size={14} />,
          action: () => setSection('typography'),
        },
        {
          id: 'preview:density:calm',
          label: 'Density: Calm',
          icon: <SlidersHorizontal size={14} />,
          action: () => setDensity('calm'),
        },
        {
          id: 'preview:density:compact',
          label: 'Density: Compact',
          icon: <SlidersHorizontal size={14} />,
          action: () => setDensity('compact'),
        },
        ...PREVIEW_CARDS.map((card) => ({
          id: `preview:card:${card.id}`,
          label: `Focus ${card.title}`,
          icon: <BookOpenText size={14} />,
          action: () => setSelectedCardId(card.id),
        })),
      ] satisfies CommandOption[];
    },
    useStatus: () => {
      const { template } = useTheme();

      if (template === 'editorial') {
        return { label: 'EDITORIAL', color: 'amber' as const };
      }

      return { label: 'HUDSON', color: 'emerald' as const };
    },
    useSearch: () => {
      const { query, setQuery } = useThemePreview();
      return { value: query, onChange: setQuery, placeholder: 'Filter preview notes...' };
    },
    useNavCenter: () => <ThemePreviewNavCenter />,
    useNavActions: () => <ThemeToolbar />,
    useLayoutMode: () => 'panel',
  },
};

export function ThemePreviewClient() {
  return <AppShell app={themePreviewApp} assistant={false} managedTheme={false} />;
}
