import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import rehypeShiki from "@shikijs/rehype";
import remarkRewriteLinks from "./remark-rewrite-links";

/** Render markdown to HTML with syntax highlighting and GFM support */
export async function renderMarkdown(source: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRewriteLinks)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypeShiki, {
      theme: "vitesse-dark",
    })
    .use(rehypeStringify)
    .process(source);

  return String(result);
}
