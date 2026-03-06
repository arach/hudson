import { visit } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Root, Link } from "mdast";

/**
 * Remark plugin that rewrites relative .md links to /docs/<slug> routes.
 * Supports both flat and nested paths:
 *   ./quickstart.md        → /docs/quickstart
 *   ./api.md#hooks         → /docs/api#hooks
 *   ../sdk/hooks.md        → /docs/npm/sdk/hooks (resolved relative to doc)
 *   sdk/hooks.md           → /docs/npm/sdk/hooks
 */
const remarkRewriteLinks: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "link", (node: Link) => {
      const url = node.url;
      if (!url) return;

      // Only rewrite relative .md links (not absolute or external)
      const match = url.match(/^(\.\.?\/)?([^#:]+)\.md(#.*)?$/);
      if (match) {
        const slug = match[2].replace(/^\.\//, "");
        const hash = match[3] ?? "";
        node.url = `/docs/${slug}${hash}`;
      }
    });
  };
};

export default remarkRewriteLinks;
