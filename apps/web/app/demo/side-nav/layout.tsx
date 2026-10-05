import type { Metadata } from 'next';
import { canonicalUrl } from '../../../site/seo';

export const metadata: Metadata = {
  alternates: { canonical: canonicalUrl('/demo/side-nav/') },
  robots: { index: false, follow: true },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
