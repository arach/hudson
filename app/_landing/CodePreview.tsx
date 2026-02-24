import Link from 'next/link';
import { renderMarkdown } from '@/app/lib/markdown';
import { GlyphWavesBg } from './GlyphWavesBg';

const INTERFACE_SOURCE = `\`\`\`typescript
export interface HudsonApp {
  id: string;
  name: string;
  description?: string;
  mode: 'canvas' | 'panel';

  Provider: React.FC<{ children: ReactNode }>;

  slots: {
    Content: React.FC;
    LeftPanel?: React.FC;
    Inspector?: React.FC;
    Terminal?: React.FC;
  };

  hooks: {
    useCommands: () => CommandOption[];
    useStatus: () => { label: string; color: StatusColor };
    useSearch?: () => SearchConfig;
  };
}
\`\`\``;

export async function CodePreview() {
  const html = await renderMarkdown(INTERFACE_SOURCE);

  return (
    <section className="py-32 px-8 lg:px-16 relative overflow-hidden">
      <GlyphWavesBg />

      <div className="relative max-w-[800px] mx-auto">
        <h2 className="text-2xl font-mono font-bold tracking-wide text-neutral-100 mb-3">
          This is all you need
        </h2>
        <p className="text-sm text-neutral-500 mb-12">
          Implement the HudsonApp interface and plug into any workspace
        </p>

        <div className="relative landing-code">
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>

        <Link
          href="/docs/building-apps"
          className="inline-block mt-8 text-sm font-mono text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          See the full guide &rarr;
        </Link>
      </div>
    </section>
  );
}
