import fs from "fs";
import path from "path";
import matter from "gray-matter";

const DOCS_DIR = path.join(process.cwd(), "docs");

export interface DocMeta {
  slug: string;
  title: string;
  description: string;
  order: number;
}

export interface Doc extends DocMeta {
  content: string;
}

/** Get all published docs (top-level .md files only), sorted by order */
export function getAllDocs(): DocMeta[] {
  const files = fs
    .readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith(".md"));

  return files
    .map((filename) => {
      const slug = filename.replace(/\.md$/, "");
      const raw = fs.readFileSync(path.join(DOCS_DIR, filename), "utf-8");
      const { data } = matter(raw);
      return {
        slug,
        title: (data.title as string) ?? slug,
        description: (data.description as string) ?? "",
        order: (data.order as number) ?? 99,
      };
    })
    .sort((a, b) => a.order - b.order);
}

/** Get all slugs for static generation */
export function getAllSlugs(): string[] {
  return getAllDocs().map((d) => d.slug);
}

/** Get a single doc by slug, including raw markdown content */
export function getDocBySlug(slug: string): Doc | null {
  const filepath = path.join(DOCS_DIR, `${slug}.md`);
  if (!fs.existsSync(filepath)) return null;

  const raw = fs.readFileSync(filepath, "utf-8");
  const { data, content } = matter(raw);

  return {
    slug,
    title: (data.title as string) ?? slug,
    description: (data.description as string) ?? "",
    order: (data.order as number) ?? 99,
    content,
  };
}
