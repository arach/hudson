import React, { useRef, useState } from 'react';
import { Play, Pause, SkipBack } from 'lucide-react';

interface AnimationTimelineProps {
  isPlaying: boolean;
  progress: number; // 0-1
  speed: number; // 0.25, 0.5, 1, 2, 4
  onPlayPause: () => void;
  onReset: () => void;
  onProgressChange: (progress: number) => void;
  onSpeedChange: (speed: number) => void;
  style?: React.CSSProperties;
}

const AnimationTimeline: React.FC<AnimationTimelineProps> = ({
  isPlaying,
  progress,
  speed,
  onPlayPause,
  onReset,
  onProgressChange,
  onSpeedChange,
  style,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const scrubberRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updateProgress(e);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    updateProgress(e as any);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const updateProgress = (e: React.MouseEvent | MouseEvent) => {
    if (!scrubberRef.current) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const newProgress = x / rect.width;
    onProgressChange(newProgress);
  };

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const formatTime = (progress: number) => {
    const totalSeconds = 5 / speed; // Base 5 seconds at 1x
    const currentSeconds = totalSeconds * progress;
    const mins = Math.floor(currentSeconds / 60);
    const secs = Math.floor(currentSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed z-40 pointer-events-auto" style={style}>
      <div className="h-16 bg-black/95 backdrop-blur-xl border-t border-l border-r border-neutral-800/80 shadow-[0_-4px_30px_rgba(0,0,0,0.5)] flex items-center px-4 gap-4">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

        {/* Playback controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="p-2 rounded hover:bg-white/10 transition-colors text-neutral-400 hover:text-white"
            title="Reset (R)"
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={onPlayPause}
            className={`p-2 rounded transition-colors ${
              isPlaying
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
            }`}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>

        {/* Timeline scrubber */}
        <div className="flex-1 flex items-center gap-3">
          <span className="text-[10px] font-mono text-neutral-500 tabular-nums min-w-[35px]">
            {formatTime(progress)}
          </span>

          <div
            ref={scrubberRef}
            className="flex-1 h-8 flex items-center cursor-pointer group"
            onMouseDown={handleMouseDown}
          >
            <div className="relative w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
              {/* Progress bar */}
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
                style={{ width: `${progress * 100}%` }}
              />
              {/* Playhead */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg border-2 border-blue-500 transition-transform group-hover:scale-125"
                style={{ left: `${progress * 100}%` }}
              />
            </div>
          </div>

          <span className="text-[10px] font-mono text-neutral-500 tabular-nums min-w-[35px]">
            {formatTime(1)}
          </span>
        </div>

        {/* Speed controls */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-neutral-600 uppercase mr-1">Speed</span>
          {[0.25, 0.5, 1, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                speed === s
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'bg-neutral-800/50 text-neutral-500 border border-neutral-700/50 hover:bg-neutral-800 hover:text-neutral-300'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnimationTimeline;
