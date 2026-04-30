import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllDocs, getAllSlugs, getDocBySlug } from "@/app/lib/docs";
import { renderMarkdown } from "@/app/lib/markdown";
import { extractToc } from "@/app/lib/toc";
import { TableOfContents } from "../_components/TableOfContents";
import { DocPagination } from "../_components/DocPagination";
import { CopyCodeButton } from "../_components/CopyCodeButton";
import { CopyPageButtons } from "../_components/CopyPageButtons";

interface Props {
  params: Promise<{ slug: string[] }>;
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug: slug.split("/") }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const fullSlug = slug.join("/");
  const doc = getDocBySlug(fullSlug);
  if (!doc) return {};
  return {
    title: `${doc.title} — HudsonKit Docs`,
    description: doc.description,
  };
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params;
  const fullSlug = slug.join("/");
  const doc = getDocBySlug(fullSlug);
  if (!doc) notFound();

  const [html, toc, docs] = await Promise.all([
    renderMarkdown(doc.content),
    Promise.resolve(extractToc(doc.content)),
    Promise.resolve(getAllDocs()),
  ]);

  return (
    <>
      <main className="flex-1 min-w-0">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="flex justify-end mb-4">
            <CopyPageButtons markdown={doc.content} />
          </div>
          <article
            className="docs-prose"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <CopyCodeButton />
          <DocPagination docs={docs} currentSlug={fullSlug} />

          {/* AI agent links */}
          <div className="mt-10 flex items-center justify-between border-t border-border/60 pt-6">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              For AI agents
            </span>
            <div className="flex items-center gap-4">
              <a
                href="/llms.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] text-muted-foreground transition-colors hover:text-cyan-400"
              >
                llms.txt
              </a>
              <span className="text-border">|</span>
              <a
                href="/llms-full.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] text-muted-foreground transition-colors hover:text-cyan-400"
              >
                llms-full.txt
              </a>
            </div>
          </div>
        </div>
      </main>
      <TableOfContents entries={toc} />
    </>
  );
}
