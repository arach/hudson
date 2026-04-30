import {
  ArrowRight,
  Blocks,
  Braces,
  Github,
  LayoutPanelTop,
  Mic,
  Package,
  TerminalSquare
} from "lucide-react";

const features = [
  {
    icon: LayoutPanelTop,
    title: "App chrome",
    body: "Navigation, rails, inspectors, command palettes, and status surfaces for real tools."
  },
  {
    icon: Blocks,
    title: "Provider + slots",
    body: "Apps own state and content while HudsonKit supplies the surrounding shell contract."
  },
  {
    icon: Mic,
    title: "Voice-ready",
    body: "Optional Vox integration gives native apps a clean boundary for live speech sessions."
  }
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="grid-bg fixed inset-0 pointer-events-none opacity-70" />
      <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/10">
            <Braces className="h-4 w-4 text-cyan-200" />
          </div>
          <span className="text-sm font-semibold tracking-[0.24em] text-white">HUDSONKIT</span>
        </a>
        <nav className="flex items-center gap-2 text-sm">
          <a
            href="https://www.npmjs.com/package/hudsonkit"
            className="hidden rounded-md px-3 py-2 text-white/60 transition hover:bg-white/5 hover:text-white sm:inline-flex"
          >
            npm
          </a>
          <a
            href="https://github.com/arach/hudson"
            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-white/70 transition hover:border-cyan-300/30 hover:text-white"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-12 px-6 pb-24 pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-28">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Available on npm
          </div>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-tight text-white md:text-7xl">
            A polished app shell for Hudson apps.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-white/58">
            HudsonKit packages the UI contracts, native shell primitives, and integration surfaces behind Hudson.
            Build the product experience. Let the kit carry the scaffolding.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a
              href="https://www.npmjs.com/package/hudsonkit"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-cyan-300/40 bg-cyan-300/12 px-5 py-3 text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-300/20"
            >
              <Package className="h-4 w-4" />
              npm package
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="https://github.com/arach/hudson"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-5 py-3 text-white/72 transition hover:border-white/20 hover:text-white"
            >
              Source repository
            </a>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/45 shadow-2xl shadow-cyan-950/20">
          <div className="flex h-10 items-center gap-2 border-b border-white/10 px-4">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
            <span className="ml-3 text-xs text-white/38">install</span>
          </div>
          <div className="space-y-6 p-6 font-mono text-sm">
            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/35">React SDK</div>
              <pre className="overflow-x-auto rounded-md border border-cyan-300/15 bg-cyan-300/[0.04] p-4 text-cyan-100">
                <code>bun add hudsonkit</code>
              </pre>
            </div>
            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/35">Swift package</div>
              <pre className="overflow-x-auto rounded-md border border-white/10 bg-white/[0.035] p-4 text-white/75">
                <code>.package(url: "https://github.com/arach/hudson.git", branch: "sdk-voice-kit")</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-t border-white/8 px-6 py-20">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-lg border border-white/10 bg-white/[0.025] p-6">
              <feature.icon className="h-5 w-5 text-cyan-200" />
              <h2 className="mt-5 text-base font-medium text-white">{feature.title}</h2>
              <p className="mt-3 text-sm leading-6 text-white/52">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/8 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-white/42 sm:flex-row sm:items-center sm:justify-between">
          <span>HudsonKit by Arach Tchoupani</span>
          <span className="inline-flex items-center gap-2">
            <TerminalSquare className="h-4 w-4" />
            hudsonkit@0.2.0
          </span>
        </div>
      </footer>
    </main>
  );
}
