"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DocMeta } from "@/app/lib/docs";

export function DocsSidebar({ docs }: { docs: DocMeta[] }) {
  const pathname = usePathname();

  return (
    <nav className="w-[260px] shrink-0 border-r border-neutral-800 overflow-y-auto py-4 px-3 hidden md:block sticky top-12 h-[calc(100vh-48px)] self-start">
      <div className="text-[10px] font-mono font-bold tracking-widest text-neutral-500 uppercase px-3 mb-2">
        Documentation
      </div>
      <ul className="space-y-0.5">
        {docs.map((doc) => {
          const href = `/docs/${doc.slug}`;
          const active = pathname === href;
          return (
            <li key={doc.slug}>
              <Link
                href={href}
                className={`block px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
                }`}
              >
                {doc.title}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 pt-4 border-t border-neutral-800">
        <div className="text-[10px] font-mono font-bold tracking-widest text-neutral-500 uppercase px-3 mb-2">
          For AI Agents
        </div>
        <ul className="space-y-0.5">
          <li>
            <a
              href="/llms.txt"
              target="_blank"
              className="block px-3 py-1.5 rounded-md text-sm text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50 transition-colors font-mono"
            >
              llms.txt
            </a>
          </li>
          <li>
            <a
              href="/llms-full.txt"
              target="_blank"
              className="block px-3 py-1.5 rounded-md text-sm text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50 transition-colors font-mono"
            >
              llms-full.txt
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}
