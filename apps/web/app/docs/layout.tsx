import Link from "next/link";
import { getAllDocs } from "@/app/lib/docs";
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
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-3">
          <Link href="/" className="font-mono text-sm tracking-widest uppercase text-foreground">
            HudsonKit · docs
          </Link>
          <Link href="/" className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
            ← back to home
          </Link>
        </div>
      </header>
      <div className="flex flex-1">
        <DocsSidebar docs={docs} />
        {children}
      </div>
    </div>
  );
}
