import Link from "next/link";
import type { DocMeta } from "@/app/lib/docs";

interface Props {
  docs: DocMeta[];
  currentSlug: string;
}

export function DocPagination({ docs, currentSlug }: Props) {
  const idx = docs.findIndex((d) => d.slug === currentSlug);
  const prev = idx > 0 ? docs[idx - 1] : null;
  const next = idx < docs.length - 1 ? docs[idx + 1] : null;

  return (
    <div className="mt-12 flex items-center justify-between border-t border-border pt-6">
      {prev ? (
        <Link
          href={`/docs/${prev.slug}`}
          className="group flex flex-col gap-0.5"
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Previous
          </span>
          <span className="text-sm text-muted-foreground transition-colors group-hover:text-cyan-400">
            &larr; {prev.title}
          </span>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={`/docs/${next.slug}`}
          className="group flex flex-col items-end gap-0.5"
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Next
          </span>
          <span className="text-sm text-muted-foreground transition-colors group-hover:text-cyan-400">
            {next.title} &rarr;
          </span>
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
