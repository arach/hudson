"use client";

import { useState, useCallback, useRef } from "react";

interface CopyPageButtonsProps {
  markdown: string;
}

function CopyButton({ label, getText }: { label: string; getText: () => string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(getText()).then(() => {
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [getText]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-neutral-500 border border-neutral-800 rounded-md hover:text-neutral-200 hover:border-neutral-600 transition-colors cursor-pointer"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      {copied ? "Copied" : label}
    </button>
  );
}

export function CopyPageButtons({ markdown }: CopyPageButtonsProps) {
  const getPlainText = useCallback(() => {
    const article = document.querySelector(".docs-prose");
    return article?.textContent ?? "";
  }, []);

  const getMarkdown = useCallback(() => markdown, [markdown]);

  return (
    <div className="flex items-center gap-2">
      <CopyButton label="Copy for agent" getText={getPlainText} />
      <CopyButton label="Copy markdown" getText={getMarkdown} />
    </div>
  );
}
