import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { getAllDocs } from "@/app/lib/docs";

const DOCS_DIR = path.join(process.cwd(), "docs");

export async function GET() {
  const docs = getAllDocs();
  const parts: string[] = [];

  // Add all published docs in order
  for (const doc of docs) {
    const raw = fs.readFileSync(path.join(DOCS_DIR, `${doc.slug}.md`), "utf-8");
    const { content } = matter(raw);
    parts.push(`# ${doc.title}\n\n${content.trim()}`);
  }

  // Append agent overview if it exists
  const agentPath = path.join(DOCS_DIR, "agent", "overview.agent.md");
  if (fs.existsSync(agentPath)) {
    const raw = fs.readFileSync(agentPath, "utf-8");
    const { content } = matter(raw);
    parts.push(`# Agent Overview\n\n${content.trim()}`);
  }

  return new Response(parts.join("\n\n---\n\n") + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
