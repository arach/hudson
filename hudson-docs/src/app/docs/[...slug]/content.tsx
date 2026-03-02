'use client'

import { components } from '@/lib/dewey'
import type { DocData } from '@/lib/docs'

const { MarkdownContent, TableOfContents } = components

export function DocContent({ doc }: { doc: DocData }) {
  return (
    <div className="docs-content-grid">
      <article className="docs-article">
        <div className="docs-article-header">
          <h1 className="docs-article-title">{doc.title}</h1>
          {doc.description && (
            <p className="docs-article-description">{doc.description}</p>
          )}
        </div>
        <MarkdownContent content={doc.content} />
      </article>
      <aside className="docs-toc">
        <div className="docs-toc-sticky">
          <TableOfContents markdown={doc.content} />
        </div>
      </aside>
    </div>
  )
}
