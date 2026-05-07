import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Code2,
  Layers,
  LayoutGrid,
  Maximize2,
  MousePointer2,
  PanelsTopLeft,
  Terminal,
} from 'lucide-react';
import { InterestForm } from './_components/InterestForm';
import { GlyphWavesBackground } from './_components/GlyphWavesBackground';
import { HudsonDelightWorkbench, ParallaxBackground } from './_components/LandingDelights';
import { ThemePreviewControls } from './_components/ThemePreviewControls';
import { HudsonMark, SiteHeader } from './_components/SiteHeader';

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <GlyphWavesBackground />
      <ParallaxBackground />
      <ThemePreviewControls />
      <SiteHeader />
      <Hero />
      <LivePreview />
      <HudsonDelightWorkbench />
      <Features />
      <CodeSnippet />
      <Shells />
      <Interest />
      <Footer />
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative px-6 md:px-10 pt-20 pb-14 md:pt-28 md:pb-20">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-brand text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
          Build rich, composable,
          <br />
          canvas-friendly,
          <br />
          <span className="text-cyan-500">AI-powered web apps.</span>
        </h1>
        <p className="mt-8 max-w-2xl text-base md:text-lg text-muted-foreground leading-relaxed">
          HudsonKit is a shell and primitives library for composing canvas
          workspaces and single-app dashboards. Provider + Slots + Hooks —
          apps own state, the shell renders chrome.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/app"
            className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-cyan-500/50 bg-cyan-500/10 text-cyan-600 hover:bg-cyan-500/20 hover:border-cyan-500/70 transition font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open the Preview
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-border bg-muted/20 hover:bg-muted/40 hover:border-border transition text-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BookOpen className="w-4 h-4" />
            Read the Docs
          </Link>
          <code className="ml-2 px-3 py-2 rounded-md border border-border/50 bg-muted/20 font-mono text-[13px] text-muted-foreground">
            bun add hudsonkit
          </code>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live Preview
// ─────────────────────────────────────────────────────────────────────────────

function LivePreview() {
  return (
    <section className="relative px-6 md:px-10 pb-20">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-500">
              Live / Interactive
            </div>
            <h2 className="mt-1 text-xl md:text-2xl font-medium text-foreground/90">
              The workspace, running inline
            </h2>
          </div>
          <Link
            href="/app"
            className="hidden md:inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Open fullscreen
          </Link>
        </div>

        <HudFrame>
          <iframe
            // theme + template pinned via query param so the preview paints
            // predictably regardless of the visitor's stored preference or
            // OS preference — HudsonThemeScript + ThemeProvider both honour
            // these params and skip writing to localStorage, so the iframe
            // never clobbers the main site's theme state.
            src="/preview?theme=dark&template=hudson"
            title="Hudson workspace preview"
            className="block w-full h-[560px] md:h-[640px] border-0"
            loading="lazy"
          />
        </HudFrame>

        <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground/80">
          <div className="flex items-center gap-1.5">
            <MousePointer2 className="w-3 h-3" />
            Click to interact
          </div>
          <div className="hidden md:block">·</div>
          <div>Space + drag to pan</div>
          <div className="hidden md:block">·</div>
          <div>Scroll to zoom</div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Features
// ─────────────────────────────────────────────────────────────────────────────

function Features() {
  return (
    <section className="relative px-6 md:px-10 py-20 border-t border-border/50">
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16">
          <FeatureColumn
            eyebrow="The Pattern"
            title="Provider + Slots + Hooks"
            items={[
              {
                icon: Layers,
                title: 'Apps own their state',
                body: 'Each app is a React Provider. The shell nests providers and renders slots.',
              },
              {
                icon: PanelsTopLeft,
                title: 'Slots, not prescriptions',
                body: 'Apps declare what they want in the nav, side panels, overlays. The shell composes.',
              },
              {
                icon: Code2,
                title: 'Strict TypeScript interface',
                body: 'Implement HudsonApp and you get chrome, windows, intents, and AI for free.',
              },
            ]}
          />
          <FeatureColumn
            eyebrow="The Primitives"
            title="Canvas · Windows · Chrome"
            items={[
              {
                icon: LayoutGrid,
                title: 'Canvas workspace',
                body: 'Pan, zoom, and windowed apps on an infinite plane. Or static panels for dashboards.',
              },
              {
                icon: Terminal,
                title: 'Built-in AI + terminal',
                body: 'Bottom drawer ships with Hudson AI and an embedded PTY terminal.',
              },
              {
                icon: MousePointer2,
                title: 'Keyboard-first',
                body: 'Command palette, focus model, hold-space pan — designed for power users.',
              },
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function FeatureColumn({
  eyebrow,
  title,
  items,
}: {
  eyebrow: string;
  title: string;
  items: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    body: string;
  }[];
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-400/70">
        {eyebrow}
      </div>
      <h3 className="mt-1 text-2xl md:text-3xl font-medium text-foreground/90 mb-8">
        {title}
      </h3>
      <ul className="space-y-6">
        {items.map((it, i) => (
          <li key={i} className="flex gap-4">
            <div className="flex-shrink-0 w-9 h-9 rounded-md border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center">
              <it.icon className="w-4 h-4 text-cyan-600" />
            </div>
            <div>
              <div className="text-[14px] font-medium text-foreground/90">
                {it.title}
              </div>
              <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
                {it.body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Code snippet
// ─────────────────────────────────────────────────────────────────────────────

function CodeSnippet() {
  return (
    <section id="code" className="relative px-6 md:px-10 py-20 border-t border-border/50">
      <div className="max-w-5xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-2">
            <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-500">
              One interface, everything wired
            </div>
            <h3 className="mt-1 text-2xl md:text-3xl font-medium text-foreground/90">
              Define a{' '}
              <code className="font-mono text-cyan-500">HudsonApp</code>
              , get the rest.
            </h3>
            <p className="mt-4 text-[14px] text-muted-foreground leading-relaxed">
              A single object plugs your component into the workspace — menu,
              intents, settings, AI capabilities. No shell code to write.
            </p>
          </div>
          <div className="lg:col-span-3">
            <div className="relative rounded-xl border border-slate-900/10 dark:border-border overflow-hidden bg-[#06080a] shadow-[0_24px_60px_-24px_rgba(8,15,30,0.25)] dark:shadow-[0_20px_60px_-20px_rgba(34,211,238,0.15)]">
              <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="ml-3 font-mono text-[10.5px] tracking-wider uppercase text-white/30">
                  notepad.app.ts
                </span>
              </div>
              <pre className="font-mono text-[12.5px] leading-[1.7] overflow-x-auto px-6 py-5">
                <Code />
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Code() {
  return (
    <code className="text-white/80">
      <span className="text-rose-300">import</span>{' '}
      <span className="text-rose-300">type</span>{' '}
      <span className="text-white/60">{'{ HudsonApp }'}</span>{' '}
      <span className="text-rose-300">from</span>{' '}
      <span className="text-emerald-300">&apos;hudsonkit&apos;</span>;{'\n\n'}
      <span className="text-rose-300">export const</span>{' '}
      <span className="text-cyan-300">notepadApp</span>:{' '}
      <span className="text-cyan-300">HudsonApp</span> = {'{\n'}
      {'  '}id: <span className="text-emerald-300">&apos;notepad&apos;</span>,
      {'\n'}
      {'  '}name: <span className="text-emerald-300">&apos;Notepad&apos;</span>,
      {'\n'}
      {'  '}mode: <span className="text-emerald-300">&apos;panel&apos;</span>,{'\n'}
      {'  '}Provider: <span className="text-cyan-300">NotepadProvider</span>,
      {'\n'}
      {'  '}slots: {'{'} Content: <span className="text-cyan-300">NotepadContent</span> {'}'},{'\n'}
      {'  '}hooks: {'{'}{'\n'}
      {'    '}useCommands: <span className="text-cyan-300">useNotepadCommands</span>,{'\n'}
      {'    '}useStatus: <span className="text-cyan-300">useNotepadStatus</span>,{'\n'}
      {'  '}{'}'},{'\n'}
      {'  '}intents: <span className="text-cyan-300">notepadIntents</span>,
      {'\n'}
      {'};'}
    </code>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shells
// ─────────────────────────────────────────────────────────────────────────────

function Shells() {
  return (
    <section id="shells" className="relative px-6 md:px-10 py-20 border-t border-border/50">
      <div className="max-w-5xl mx-auto">
        <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-500 text-center">
          Two shells, same primitives
        </div>
        <h3 className="mt-1 text-center text-2xl md:text-3xl font-medium text-foreground/90 mb-12">
          Pick the chrome that fits.
        </h3>
        <div className="grid md:grid-cols-2 gap-5">
          <ShellCard
            name="AppShell"
            tagline="Single app. Full chrome."
            body="For most consumers. A polished frame around one HudsonApp — nav, sidebar, status bar. Use when you're shipping a focused tool."
            accent="emerald"
          />
          <ShellCard
            name="WorkspaceShell"
            tagline="Multi-app canvas."
            body="Infinite pan/zoom plane with windowed apps. Use when the interface is the environment."
            accent="cyan"
          />
        </div>
      </div>
    </section>
  );
}

function ShellCard({
  name,
  tagline,
  body,
  accent,
}: {
  name: string;
  tagline: string;
  body: string;
  accent: 'cyan' | 'emerald';
}) {
  const ring =
    accent === 'cyan'
      ? 'border-cyan-500/40 hover:border-cyan-500/70'
      : 'border-emerald-500/40 hover:border-emerald-500/70';
  const text =
    accent === 'cyan' ? 'text-cyan-600 dark:text-cyan-400' : 'text-emerald-600 dark:text-emerald-400';
  const dot = accent === 'cyan' ? 'bg-cyan-500' : 'bg-emerald-500';
  const glow =
    accent === 'cyan'
      ? 'bg-cyan-500/[0.06]'
      : 'bg-emerald-500/[0.06]';
  return (
    <div
      className={`group relative rounded-lg border ${ring} bg-card p-6 transition overflow-hidden shadow-sm hover:shadow-md dark:shadow-none`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 -top-16 h-32 ${glow} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity`}
      />
      <div className="relative">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            <div className={`font-brand text-lg ${text}`}>{name}</div>
          </div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground/80">
            {accent === 'cyan' ? 'Multi-app' : 'Single app'}
          </div>
        </div>
        <div className="mt-3 text-[15px] font-medium text-foreground/90">
          {tagline}
        </div>
        <p className="mt-3 text-[13px] text-muted-foreground leading-relaxed">
          {body}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Interest
// ─────────────────────────────────────────────────────────────────────────────

function Interest() {
  return (
    <section id="interest" className="relative px-6 md:px-10 py-20 border-t border-border/50">
      <div className="max-w-2xl mx-auto">
        <HudFrame>
          <div className="px-6 md:px-10 py-10">
            <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-500">
              Interested?
            </div>
            <h3 className="mt-1 text-2xl md:text-3xl font-medium text-foreground/90">
              HudsonKit is shipping in the open.
            </h3>
            <p className="mt-3 text-[14px] text-muted-foreground leading-relaxed">
              If you&apos;re thinking about building on HudsonKit — or just want
              to follow along as the SDK, workspace, and primitives come
              together — drop your email. We&apos;ll reach out when something
              worth your attention ships.
            </p>
            <div className="mt-6">
              <InterestForm />
            </div>
          </div>
        </HudFrame>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="relative border-t border-border/50 px-6 md:px-10 py-10">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <HudsonMark className="w-4 h-4 text-muted-foreground/80" />
          <span className="font-brand text-[13px] tracking-wider text-muted-foreground">
            HUDSONKIT
          </span>
          <span className="ml-2 text-[12px] text-muted-foreground/60">
            © 2026 Arach Tchoupani
          </span>
        </div>
        <div className="flex items-center gap-5 text-[12px] text-muted-foreground/80">
          <Link
            href="/docs"
            className="hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            Docs
          </Link>
          <Link
            href="/app"
            className="hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            Workspace
          </Link>
          <a
            href="https://www.npmjs.com/package/hudsonkit"
            className="hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            npm
          </a>
          <span className="text-muted-foreground/60">FSL-1.1-MIT</span>
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Decorative primitives
// ─────────────────────────────────────────────────────────────────────────────

function HudFrame({
  children,
  compact,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative rounded-xl border border-border bg-card/80 dark:bg-card/50 ${
        compact
          ? ''
          : 'shadow-[0_24px_70px_-28px_rgba(15,23,42,0.15)] dark:shadow-[0_24px_70px_-28px_rgba(34,211,238,0.18)]'
      } overflow-hidden`}
    >
      <Corners />
      <div className="relative">{children}</div>
    </div>
  );
}

function Corners() {
  const base =
    'absolute w-3 h-3 border-cyan-600/40 dark:border-cyan-500/50 pointer-events-none';
  return (
    <>
      <span className={`${base} top-1 left-1 border-t border-l`} />
      <span className={`${base} top-1 right-1 border-t border-r`} />
      <span className={`${base} bottom-1 left-1 border-b border-l`} />
      <span className={`${base} bottom-1 right-1 border-b border-r`} />
    </>
  );
}
