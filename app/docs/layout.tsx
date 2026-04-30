import { getAllDocs } from "@/app/lib/docs";
import { SiteHeader } from "@/app/_components/SiteHeader";
import { DocsSidebar } from "./_components/DocsSidebar";
import "./docs.css";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const docs = getAllDocs();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader sticky />
      <div className="flex flex-1">
        <DocsSidebar docs={docs} />
        {children}
      </div>
    </div>
  );
}
