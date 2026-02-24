import Image from 'next/image';
import { Play } from 'lucide-react';

const PLATFORM: 'youtube' | 'vimeo' | null = null;
const VIDEO_ID: string | null = null;

function getEmbedUrl(): string | null {
  if (!PLATFORM || !VIDEO_ID) return null;
  if (PLATFORM === 'youtube')
    return `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`;
  if (PLATFORM === 'vimeo')
    return `https://player.vimeo.com/video/${VIDEO_ID}`;
  return null;
}

export function VideoSection() {
  const embedUrl = getEmbedUrl();

  return (
    <section className="py-32 flex flex-col items-center px-8 lg:px-16">
      <h2 className="text-2xl font-mono font-bold tracking-wide text-neutral-100 mb-14">
        See it in action
      </h2>

      <div
        className="w-full max-w-[960px] rounded-lg border border-neutral-800 overflow-hidden relative"
        style={{ boxShadow: '0 0 80px rgba(16,185,129,0.06)' }}
      >
        {embedUrl ? (
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src={embedUrl}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Hudson demo video"
            />
          </div>
        ) : (
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <Image
              src="/demo/hero.png"
              alt="Hudson workspace"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-full border border-neutral-500/50 flex items-center justify-center">
                <Play className="w-6 h-6 text-neutral-300 ml-0.5" />
              </div>
              <span className="text-xs font-mono tracking-widest text-neutral-400 uppercase">
                Video coming soon
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
