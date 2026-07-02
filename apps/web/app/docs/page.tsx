import { redirect } from "next/navigation";
import { getAllDocs } from "@/app/lib/docs";

export default function DocsIndex() {
  const docs = getAllDocs();
  const first = docs[0];
  redirect(`/docs/${first?.slug ?? "overview"}`);
}
