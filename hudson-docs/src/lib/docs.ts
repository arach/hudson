import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

export interface DocData {
  slug: string
  title: string
  description?: string
  content: string
  order: number
}

const docsDirectory = path.join(process.cwd(), 'docs')

export function getDocBySlug(slug: string): DocData | null {
  try {
    const fullPath = path.join(docsDirectory, `${slug}.md`)
    const fileContents = fs.readFileSync(fullPath, 'utf-8')
    const { data, content } = matter(fileContents)

    return {
      slug,
      title: (data.title as string) || slug.charAt(0).toUpperCase() + slug.slice(1),
      description: data.description as string | undefined,
      content: content.trim(),
      order: (data.order as number) || 999,
    }
  } catch {
    return null
  }
}

export function getAllDocSlugs(): string[] {
  try {
    const files = fs.readdirSync(docsDirectory)
    return files
      .filter((file) => file.endsWith('.md'))
      .map((file) => file.replace(/\.md$/, ''))
  } catch {
    return []
  }
}
