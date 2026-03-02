'use client';
import { useLogo } from './LogoProvider';
import { LogoSvg } from './LogoSvg';

export function LogoContent() {
  const { params } = useLogo();

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 p-8">
      {/* Main preview */}
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <LogoSvg params={params} size={256} />
          <span className="text-[11px] text-white/30">256px</span>
        </div>
      </div>

      {/* Size strip */}
      <div className="flex items-end gap-6">
        <div className="flex flex-col items-center gap-1">
          <LogoSvg params={params} size={128} />
          <span className="text-[10px] text-white/25">128</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <LogoSvg params={params} size={64} />
          <span className="text-[10px] text-white/25">64</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <LogoSvg params={params} size={32} />
          <span className="text-[10px] text-white/25">32</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <LogoSvg params={params} size={16} />
          <span className="text-[10px] text-white/25">16</span>
        </div>
      </div>

      {/* Light background preview */}
      <div className="flex items-end gap-6 rounded-xl bg-white/90 p-6">
        <div className="flex flex-col items-center gap-1">
          <LogoSvg params={params} size={64} />
          <span className="text-[10px] text-black/30">on light</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <LogoSvg params={params} size={32} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <LogoSvg params={params} size={16} />
        </div>
      </div>
    </div>
  );
}
