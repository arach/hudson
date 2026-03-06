import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Minus } from 'lucide-react';

interface ZoomControlsProps {
  scale: number;
  onZoom: (newScale: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

const ZoomControls: React.FC<ZoomControlsProps> = ({
  scale,
  onZoom,
  min = 0.2,
  max = 3,
  step = 0.1,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max]);

  const handleZoomIn = useCallback(() => {
    onZoom(clamp(scale + step));
  }, [scale, step, onZoom, clamp]);

  const handleZoomOut = useCallback(() => {
    onZoom(clamp(scale - step));
  }, [scale, step, onZoom, clamp]);

  const startEditing = useCallback(() => {
    setEditValue(Math.round(scale * 100).toString());
    setIsEditing(true);
  }, [scale]);

  const commitEdit = useCallback(() => {
    setIsEditing(false);
    const parsed = parseInt(editValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      onZoom(clamp(parsed / 100));
    }
  }, [editValue, onZoom, clamp]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit();
    else if (e.key === 'Escape') setIsEditing(false);
  }, [commitEdit]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <div
      className="pointer-events-auto flex flex-col items-center bg-neutral-950/95 backdrop-blur-xl border border-neutral-700/80 rounded-md shadow-[0_0_20px_rgba(0,0,0,0.6)] overflow-hidden"
    >
      <button
        onClick={handleZoomIn}
        className="w-9 h-8 flex items-center justify-center hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
        title="Zoom in"
      >
        <Plus size={14} />
      </button>

      <div className="w-full border-t border-b border-neutral-700/50">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="w-9 py-1.5 text-center text-[11px] font-mono text-white bg-black/60 outline-none tabular-nums"
          />
        ) : (
          <button
            onClick={startEditing}
            className="w-9 py-1.5 text-center text-[11px] font-mono text-neutral-200 hover:text-white hover:bg-white/10 transition-colors cursor-text tabular-nums"
            title="Click to set zoom"
          >
            {Math.round(scale * 100)}%
          </button>
        )}
      </div>

      <button
        onClick={handleZoomOut}
        className="w-9 h-8 flex items-center justify-center hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
        title="Zoom out"
      >
        <Minus size={14} />
      </button>
    </div>
  );
};

export default ZoomControls;
