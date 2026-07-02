import { getAllDocs } from "@/app/lib/docs";

export async function GET() {
  const docs = getAllDocs();

  const lines = [
    "# hudson",
    "> Multi-app canvas workspace platform for React",
    "",
    "## Documentation",
    ...docs.map(
      (d) => `- ${d.title}: https://hudsonkit.com/docs/${d.slug}`
    ),
    "",
    "## Full documentation",
    "https://hudsonkit.com/llms-full.txt",
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
