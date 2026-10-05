import type { Metadata } from "next";
import { ThemePreviewClient } from './ThemePreviewClient';

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function ThemePreviewPage() {
  return <ThemePreviewClient />;
}
