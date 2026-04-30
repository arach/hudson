import Link from 'next/link';
import { ArrowRight, Package } from 'lucide-react';

export function SiteHeader({ sticky = false }: { sticky?: boolean }) {
  return (
    <header
      className={`${sticky ? 'sticky top-0' : 'relative'} z-50 flex h-14 items-center justify-between border-b border-border/50 bg-background/70 px-6 backdrop-blur-sm md:px-10`}
    >
      <Link
        href="/"
        className="flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <HudsonMark className="h-5 w-5 text-cyan-500" />
        <span className="font-brand text-[15px] tracking-wider">HUDSONKIT</span>
      </Link>
      <nav className="flex items-center gap-1 text-[13px]">
        <Link
          href="/docs"
          className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Docs
        </Link>
        <a
          href="https://www.npmjs.com/package/hudsonkit"
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Package className="h-3.5 w-3.5" />
          npm
        </a>
        <Link
          href="/app"
          className="ml-2 flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-cyan-600 transition hover:border-cyan-500/60 hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Open Preview
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </nav>
    </header>
  );
}

export function HudsonMark({ className }: { className?: string }) {
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
