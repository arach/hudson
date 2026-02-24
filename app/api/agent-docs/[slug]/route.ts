import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { renderMarkdown } from '@/app/lib/markdown';
import { AGENT_DOCS } from '@/app/apps/hudson-docs/data';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const entry = AGENT_DOCS.find((d) => d.slug === slug);
  if (!entry) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), 'docs', entry.file);
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const { content } = matter(raw);
  const html = await renderMarkdown(content);

  return NextResponse.json({
    title: entry.title,
    description: entry.description,
    raw: content,
    html,
  });
}
