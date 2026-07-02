"use client";

import { useEffect, useState } from "react";
import type { TocEntry } from "@/app/lib/toc";

export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (entries.length === 0) return;

    const observer = new IntersectionObserver(
      (intersections) => {
        for (const entry of intersections) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );

    const headings = entries
      .map((e) => document.getElementById(e.id))
      .filter(Boolean) as HTMLElement[];

    for (const heading of headings) {
      observer.observe(heading);
    }

    return () => observer.disconnect();
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <nav className="hidden h-[calc(100vh-56px)] w-[220px] shrink-0 self-start overflow-y-auto px-3 py-4 xl:sticky xl:top-14 xl:block">
      <div className="mb-2 px-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        On This Page
      </div>
      <ul className="space-y-0.5">
        {entries.map((entry) => {
          const active = activeId === entry.id;
          return (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                className={`block text-xs py-1 transition-colors ${
                  entry.level === 3 ? "pl-5" : "pl-2"
                } ${
                  active
                    ? "text-cyan-400"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {entry.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
