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
    <nav className="w-[220px] shrink-0 hidden xl:block overflow-y-auto py-4 px-3 sticky top-12 h-[calc(100vh-48px)] self-start">
      <div className="text-[10px] font-mono font-bold tracking-widest text-neutral-500 uppercase px-2 mb-2">
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
                    ? "text-emerald-400"
                    : "text-neutral-500 hover:text-neutral-300"
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
