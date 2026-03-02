import docsJson from '../../docs.json'
import type { PageNode } from '@arach/dewey'

interface DocsGroup {
  id: string
  title: string
  items: { id: string; title: string; description?: string }[]
}

interface DocsJson {
  name: string
  groups: DocsGroup[]
}

export function getNavTree(): PageNode[] {
  const data = docsJson as DocsJson
  return data.groups.map((group) => ({
    type: 'folder' as const,
    name: group.title,
    defaultOpen: true,
    children: group.items.map((item) => ({
      type: 'page' as const,
      id: item.id,
      name: item.title,
      description: item.description,
    })),
  }))
}
