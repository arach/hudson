"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DocMeta } from "@/app/lib/docs";

interface SidebarSection {
  label: string | null;
  groups: SidebarGroup[];
}

interface SidebarGroup {
  subsection: string | null;
  docs: DocMeta[];
}

const SECTION_LABELS: Record<string, string> = {
  npm: "NPM PACKAGES",
  cli: "CLI TOOLS",
};

function buildSections(docs: DocMeta[]): SidebarSection[] {
  const sections: SidebarSection[] = [];
  let currentSection: SidebarSection | null = null;
  let currentGroup: SidebarGroup | null = null;

  for (const doc of docs) {
    const sectionLabel = doc.section ?? null;
    const subsectionLabel = doc.subsection ?? null;

    // Start a new section if the section label changed
    if (!currentSection || currentSection.label !== sectionLabel) {
      currentGroup = { subsection: subsectionLabel, docs: [] };
      currentSection = { label: sectionLabel, groups: [currentGroup] };
      sections.push(currentSection);
    }
    // Within the same section, start a new group if the subsection changed
    else if (!currentGroup || currentGroup.subsection !== subsectionLabel) {
      currentGroup = { subsection: subsectionLabel, docs: [] };
      currentSection.groups.push(currentGroup);
    }

    currentGroup.docs.push(doc);
  }

  return sections;
}

export function DocsSidebar({ docs }: { docs: DocMeta[] }) {
  const pathname = usePathname();
  const sections = buildSections(docs);

  return (
    <nav className="hidden h-[calc(100vh-56px)] w-[260px] shrink-0 self-start overflow-y-auto border-r border-border bg-background/75 px-3 py-4 backdrop-blur-sm md:sticky md:top-14 md:block">
      {sections.map((section, i) => (
        <div key={section.label ?? "root"} className={i > 0 ? "mt-5 border-t border-border pt-4" : ""}>
          <div className="mb-2 px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {SECTION_LABELS[section.label ?? ""] ?? "Documentation"}
          </div>
          {section.groups.map((group) => (
            <div key={group.subsection ?? "default"}>
              {group.subsection && (
                <div className="mb-1.5 mt-3 px-3 font-mono text-[11px] font-medium text-muted-foreground">
                  {group.subsection}
                </div>
              )}
              <ul className="space-y-0.5">
                {group.docs.map((doc) => {
                  const href = `/docs/${doc.slug}`;
                  const active = pathname === href;
                  return (
                    <li key={doc.slug}>
                      <Link
                        href={href}
                        className={`block py-1.5 rounded-md text-sm font-medium transition-colors ${
                          group.subsection ? "px-5" : "px-3"
                        } ${
                          active
                            ? "bg-cyan-500/10 text-cyan-400"
                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                        }`}
                      >
                        {doc.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ))}
      <div className="mt-5 border-t border-border pt-4">
        <div className="mb-2 px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          For AI Agents
        </div>
        <ul className="space-y-0.5">
          <li>
            <a
              href="/llms.txt"
              target="_blank"
              className="block rounded-md px-3 py-1.5 font-mono text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              llms.txt
            </a>
          </li>
          <li>
            <a
              href="/llms-full.txt"
              target="_blank"
              className="block rounded-md px-3 py-1.5 font-mono text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              llms-full.txt
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}
