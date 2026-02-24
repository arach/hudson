export interface TocEntry {
  id: string;
  text: string;
  level: number;
}

/** Extract h2 and h3 headings from markdown source for table of contents */
export function extractToc(markdown: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const lines = markdown.split("\n");
  const seen = new Map<string, number>();
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (!match) continue;

    const level = match[1].length;
    const text = match[2]
      .replace(/`([^`]+)`/g, "$1") // strip inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // strip links
      .trim();

    let id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");

    // Deduplicate: rehype-slug appends -1, -2, etc. for duplicate headings
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    if (count > 0) id = `${id}-${count}`;

    entries.push({ id, text, level });
  }

  return entries;
}
