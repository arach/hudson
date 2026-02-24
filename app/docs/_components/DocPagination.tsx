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
    <div className="flex justify-between items-center mt-12 pt-6 border-t border-neutral-800">
      {prev ? (
        <Link
          href={`/docs/${prev.slug}`}
          className="group flex flex-col gap-0.5"
        >
          <span className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase">
            Previous
          </span>
          <span className="text-sm text-neutral-400 group-hover:text-emerald-400 transition-colors">
            &larr; {prev.title}
          </span>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={`/docs/${next.slug}`}
          className="group flex flex-col gap-0.5 items-end"
        >
          <span className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase">
            Next
          </span>
          <span className="text-sm text-neutral-400 group-hover:text-emerald-400 transition-colors">
            {next.title} &rarr;
          </span>
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
