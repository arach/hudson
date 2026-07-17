import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HudsonKit — Demo',
  description:
    'See HudsonKit in action. A multi-app canvas workspace for React.',
  openGraph: {
    title: 'HudsonKit — Demo',
    description:
      'See HudsonKit in action. A multi-app canvas workspace for React.',
    images: [{ url: '/og-demo.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HudsonKit — Demo',
    description:
      'See HudsonKit in action. A multi-app canvas workspace for React.',
    images: ['/og-demo.png'],
  },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
