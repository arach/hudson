import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllDocs, getAllSlugs, getDocBySlug } from "@/app/lib/docs";
import { renderMarkdown } from "@/app/lib/markdown";
import { extractToc } from "@/app/lib/toc";
import { TableOfContents } from "../_components/TableOfContents";
import { DocPagination } from "../_components/DocPagination";

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
    title: `${doc.title} — Hudson Docs`,
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
          <article
            className="docs-prose"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <DocPagination docs={docs} currentSlug={fullSlug} />
        </div>
      </main>
      <TableOfContents entries={toc} />
    </>
  );
}
