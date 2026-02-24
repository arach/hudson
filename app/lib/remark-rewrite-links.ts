import { visit } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Root, Link } from "mdast";

/**
 * Remark plugin that rewrites relative .md links to /docs/<slug> routes.
 * e.g. ./quickstart.md → /docs/quickstart
 *      ./api.md#hooks  → /docs/api#hooks
 */
const remarkRewriteLinks: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "link", (node: Link) => {
      const url = node.url;
      if (!url) return;

      // Only rewrite relative .md links
      const match = url.match(/^\.\/([^#]+)\.md(#.*)?$/);
      if (match) {
        const slug = match[1];
        const hash = match[2] ?? "";
        node.url = `/docs/${slug}${hash}`;
      }
    });
  };
};

export default remarkRewriteLinks;
