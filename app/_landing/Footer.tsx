import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-neutral-800 py-8 px-6">
      <div className="max-w-[1080px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs font-mono tracking-widest uppercase text-neutral-600">
          <span>Hudson</span>
          <span className="text-neutral-700">·</span>
          <span>by @arach</span>
        </div>
        <nav className="flex items-center gap-5 text-xs font-mono tracking-widest uppercase">
          <Link
            href="/demo"
            className="text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            Demo
          </Link>
          <Link
            href="/docs"
            className="text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            Docs
          </Link>
          <Link
            href="/llms.txt"
            className="text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            llms.txt
          </Link>
        </nav>
      </div>
    </footer>
  );
}
