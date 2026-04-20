import Link from 'next/link';
import {
  ArrowRight,
  Code2,
  Github,
  Layers,
  LayoutGrid,
  Maximize2,
  MousePointer2,
  PanelsTopLeft,
  Terminal,
} from 'lucide-react';
import { InterestForm } from './_components/InterestForm';
import { GlyphWavesBackground } from './_components/GlyphWavesBackground';

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[var(--background)] text-[var(--foreground)]">
      <GlyphWavesBackground />
      <BackgroundGrid />
      <Nav />
      <Hero />
      <LivePreview />
      <Features />
      <CodeSnippet />
      <Shells />
      <Interest />
      <Footer />
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chrome
// ─────────────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <header className="relative z-10 flex items-center justify-between px-6 md:px-10 h-14 border-b border-white/5">
      <Link href="/" className="flex items-center gap-2">
        <HudsonMark className="w-5 h-5 text-cyan-400" />
        <span className="font-brand text-[15px] tracking-wider">HUDSON</span>
      </Link>
      <nav className="flex items-center gap-1 text-[13px]">
        <Link
          href="/docs"
          className="px-3 py-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/5 transition"
        >
          Docs
        </Link>
        <a
          href="https://github.com/arach/hudson"
          className="px-3 py-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/5 transition flex items-center gap-1.5"
        >
          <Github className="w-3.5 h-3.5" />
          GitHub
        </a>
        <Link
          href="/app"
          className="ml-2 px-3 py-1.5 rounded-md border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20 hover:border-cyan-400/50 transition flex items-center gap-1.5"
        >
          Open Workspace
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </nav>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative px-6 md:px-10 pt-20 pb-14 md:pt-28 md:pb-20">
      <div className="max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.02] text-[11px] tracking-wider uppercase text-white/50 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          v0.1 — Source-available under FSL-1.1-MIT
        </div>
        <h1 className="font-brand text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
          Build rich, composable,
          <br />
          canvas-friendly,
          <br />
          <span className="text-cyan-300">AI-powered web apps.</span>
        </h1>
        <p className="mt-8 max-w-2xl text-base md:text-lg text-white/60 leading-relaxed">
          Hudson is a shell and primitives library for composing canvas
          workspaces and single-app dashboards. Provider + Slots + Hooks —
          apps own state, the shell renders chrome.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/app"
            className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-cyan-400/40 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20 hover:border-cyan-400/60 transition"
          >
            Open the Workspace
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-white/20 transition text-white/80"
          >
            Read the Docs
          </Link>
          <code className="ml-2 px-3 py-2 rounded-md border border-white/5 bg-white/[0.02] font-mono text-[13px] text-white/60">
            bun add @hudsonos/sdk
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
            <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-400/70">
              Live / Interactive
            </div>
            <h2 className="mt-1 text-xl md:text-2xl font-medium text-white/90">
              The workspace, running inline
            </h2>
          </div>
          <Link
            href="/app"
            className="hidden md:inline-flex items-center gap-1.5 text-[12px] text-white/60 hover:text-white transition"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Open fullscreen
          </Link>
        </div>

        <HudFrame>
          <iframe
            src="/preview"
            title="Hudson workspace preview"
            className="block w-full h-[560px] md:h-[640px] border-0"
            loading="lazy"
          />
        </HudFrame>

        <div className="mt-3 flex items-center gap-4 text-[11px] text-white/40">
          <div className="flex items-center gap-1.5">
            <MousePointer2 className="w-3 h-3" />
            Click to interact
          </div>
          <div className="hidden md:block">•</div>
          <div>Space + drag to pan</div>
          <div className="hidden md:block">•</div>
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
    <section className="relative px-6 md:px-10 py-20 border-t border-white/5">
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
      <h3 className="mt-1 text-2xl md:text-3xl font-medium text-white/90 mb-8">
        {title}
      </h3>
      <ul className="space-y-6">
        {items.map((it, i) => (
          <li key={i} className="flex gap-4">
            <div className="flex-shrink-0 w-9 h-9 rounded-md border border-cyan-400/20 bg-cyan-400/5 flex items-center justify-center">
              <it.icon className="w-4 h-4 text-cyan-300" />
            </div>
            <div>
              <div className="text-[14px] font-medium text-white/90">
                {it.title}
              </div>
              <p className="mt-1 text-[13px] text-white/55 leading-relaxed">
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
    <section className="relative px-6 md:px-10 py-20 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-2">
            <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-400/70">
              One interface, everything wired
            </div>
            <h3 className="mt-1 text-2xl md:text-3xl font-medium text-white/90">
              Define a{' '}
              <code className="font-mono text-cyan-300">HudsonApp</code>, get
              the rest.
            </h3>
            <p className="mt-4 text-[14px] text-white/55 leading-relaxed">
              A single object plugs your component into the workspace — menu,
              intents, settings, AI capabilities. No shell code to write.
            </p>
          </div>
          <div className="lg:col-span-3">
            <HudFrame compact>
              <pre className="font-mono text-[12.5px] leading-[1.7] overflow-x-auto px-6 py-5 bg-[#06080a]">
                <Code />
              </pre>
            </HudFrame>
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
      <span className="text-white/60">{'{ defineApp }'}</span>{' '}
      <span className="text-rose-300">from</span>{' '}
      <span className="text-emerald-300">&apos;@hudsonos/sdk&apos;</span>;{'\n\n'}
      <span className="text-rose-300">export const</span>{' '}
      <span className="text-cyan-300">notepadApp</span> ={' '}
      <span className="text-white/70">defineApp</span>({'{\n'}
      {'  '}id: <span className="text-emerald-300">&apos;notepad&apos;</span>,
      {'\n'}
      {'  '}name: <span className="text-emerald-300">&apos;Notepad&apos;</span>,
      {'\n'}
      {'  '}icon: <span className="text-cyan-300">NotepadIcon</span>,{'\n'}
      {'  '}Provider: <span className="text-cyan-300">NotepadProvider</span>,
      {'\n'}
      {'  '}useContent:{' '}
      <span className="text-cyan-300">useNotepadContent</span>,{'\n'}
      {'  '}useNav: <span className="text-cyan-300">useNotepadNav</span>,{'\n'}
      {'  '}intents: <span className="text-cyan-300">notepadIntents</span>,
      {'\n'}
      {'}});'}
    </code>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shells
// ─────────────────────────────────────────────────────────────────────────────

function Shells() {
  return (
    <section className="relative px-6 md:px-10 py-20 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-400/70 text-center">
          Two shells, same primitives
        </div>
        <h3 className="mt-1 text-center text-2xl md:text-3xl font-medium text-white/90 mb-12">
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
            body="Infinite pan/zoom plane with windowed apps. Used by Hudson's own /app route. Use when the interface is the environment."
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
      ? 'border-cyan-400/20 hover:border-cyan-400/40'
      : 'border-emerald-400/20 hover:border-emerald-400/40';
  const text = accent === 'cyan' ? 'text-cyan-300' : 'text-emerald-300';
  return (
    <div
      className={`relative rounded-lg border ${ring} bg-white/[0.02] p-6 transition`}
    >
      <div className="flex items-baseline justify-between">
        <div className={`font-brand text-lg ${text}`}>{name}</div>
        <div className="text-[11px] uppercase tracking-wider text-white/40">
          {accent === 'cyan' ? 'Multi-app' : 'Single app'}
        </div>
      </div>
      <div className="mt-2 text-[15px] font-medium text-white/85">
        {tagline}
      </div>
      <p className="mt-3 text-[13px] text-white/55 leading-relaxed">{body}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Interest
// ─────────────────────────────────────────────────────────────────────────────

function Interest() {
  return (
    <section className="relative px-6 md:px-10 py-20 border-t border-white/5">
      <div className="max-w-2xl mx-auto">
        <HudFrame>
          <div className="px-6 md:px-10 py-10">
            <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-400/70">
              Interested?
            </div>
            <h3 className="mt-1 text-2xl md:text-3xl font-medium text-white/90">
              Hudson is shipping in the open.
            </h3>
            <p className="mt-3 text-[14px] text-white/55 leading-relaxed">
              If you&apos;re thinking about building on Hudson — or just want
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
    <footer className="relative border-t border-white/5 px-6 md:px-10 py-10">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <HudsonMark className="w-4 h-4 text-white/40" />
          <span className="font-brand text-[13px] tracking-wider text-white/50">
            HUDSON
          </span>
          <span className="ml-2 text-[12px] text-white/30">
            © 2026 Arach Tchoupani
          </span>
        </div>
        <div className="flex items-center gap-5 text-[12px] text-white/40">
          <Link href="/docs" className="hover:text-white/80 transition">
            Docs
          </Link>
          <Link href="/app" className="hover:text-white/80 transition">
            Workspace
          </Link>
          <a
            href="https://github.com/arach/hudson"
            className="hover:text-white/80 transition"
          >
            GitHub
          </a>
          <span className="text-white/30">FSL-1.1-MIT</span>
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
      className={`relative rounded-xl border border-white/10 bg-white/[0.015] ${
        compact
          ? ''
          : 'shadow-[0_20px_60px_-20px_rgba(34,211,238,0.15)]'
      } overflow-hidden`}
    >
      <Corners />
      <div className="relative">{children}</div>
    </div>
  );
}

function Corners() {
  const base = 'absolute w-3 h-3 border-cyan-400/40 pointer-events-none';
  return (
    <>
      <span className={`${base} top-1 left-1 border-t border-l`} />
      <span className={`${base} top-1 right-1 border-t border-r`} />
      <span className={`${base} bottom-1 left-1 border-b border-l`} />
      <span className={`${base} bottom-1 right-1 border-b border-r`} />
    </>
  );
}

function BackgroundGrid() {
  return (
    <>
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage:
            'radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 80%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 80%)',
        }}
      />
      <div
        className="fixed -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] pointer-events-none rounded-full opacity-[0.12]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(34,211,238,0.5), transparent 60%)',
          filter: 'blur(80px)',
        }}
      />
    </>
  );
}

function HudsonMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  );
}
