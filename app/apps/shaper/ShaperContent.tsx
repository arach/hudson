'use client';

import { useShaper } from './ShaperProvider';
import { ZoomControls } from 'hudsonkit';
import { CanvasRenderer } from './components/CanvasRenderer';
import { ToolPalette } from './components/ToolPalette';
import { DropZone } from './components/DropZone';
import { AnimationTimeline } from './components/AnimationTimeline';

export function ShaperContent() {
  const ctx = useShaper();

  const {
    showEditor, showDropScreen,
    tool, isPanning, zoom, pan, showGrid, showGuides,
    containerRef, canvasRef, fileInputRef,
    showOriginal, showSilhouette, displayImageSrc, projectImage,
    handleWheel, handlePointMouseDown, handleCanvasMouseMove, handleCanvasMouseUp,
    clearMousePos, handleGlobalDragOver, handleGlobalDrop, handleFileSelect,
    zoomIn, zoomOut, resetZoom,
    animationModeEnabled, isAnimating, animationProgress, animationSpeed,
    setIsAnimating, setAnimationProgress, setAnimationSpeed,
  } = ctx;

  // mousePos is tracked via ref + direct DOM manipulation in ShaperProvider.
  // No React state needed — the provider updates these elements directly.

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-neutral-950 text-neutral-300"
      onDragOver={handleGlobalDragOver}
      onDrop={handleGlobalDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/svg+xml,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Canvas */}
      {showEditor && (
        <div
          ref={containerRef}
          className={`absolute inset-0 ${tool === 'pen' ? 'cursor-crosshair' : ''} ${(tool === 'hand' || isPanning) ? 'cursor-grab' : ''} ${isPanning ? '!cursor-grabbing' : ''}`}
          style={{
            backgroundColor: '#0a0a0a',
            backgroundImage: showGrid ? 'radial-gradient(circle, #333 1px, transparent 1px)' : 'none',
            backgroundSize: '20px 20px',
          }}
          onWheel={handleWheel}
          onMouseDown={handlePointMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={() => { handleCanvasMouseUp(); clearMousePos(); }}
        >
          <div
            ref={canvasRef}
            className="absolute"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              left: '50%',
              top: '50%',
              marginLeft: '-512px',
              marginTop: '-512px',
              width: 1024,
              height: 1024,
              overflow: 'visible',
            }}
          >
            {showOriginal && (
              <img src={displayImageSrc} alt="Original" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
            )}
            {showSilhouette && (
              <img src={projectImage ? displayImageSrc : '/shaper/talkie-silhouette.png'} alt="Silhouette" className="absolute inset-0 w-full h-full object-contain opacity-50 pointer-events-none" />
            )}
            <CanvasRenderer />
          </div>

          {/* Tool palette */}
          <ToolPalette />

          {/* Crosshair guides — positioned by ShaperProvider via direct DOM updates */}
          {showGuides && (
            <>
              <div data-shaper-guide-v className="absolute top-0 bottom-0 w-px pointer-events-none bg-emerald-500/10" style={{ display: 'none' }} />
              <div data-shaper-guide-h className="absolute left-0 right-0 h-px pointer-events-none bg-emerald-500/10" style={{ display: 'none' }} />
              <div data-shaper-guide-label className="absolute text-[9px] font-mono text-emerald-500/50 pl-2 pt-1 whitespace-nowrap pointer-events-none" style={{ display: 'none' }} />
            </>
          )}
        </div>
      )}

      {/* Drop zone */}
      {showDropScreen && <DropZone />}

      {/* Zoom controls */}
      {showEditor && (
        <div
          className="absolute right-3 z-30 transition-all duration-200"
          style={{ bottom: `${12 + (animationModeEnabled ? 64 : 0)}px` }}
        >
          <ZoomControls
            scale={zoom}
            onZoom={(newScale) => ctx.setZoom(newScale)}
            min={0.1}
            max={2}
          />
        </div>
      )}

      {/* Animation timeline */}
      {animationModeEnabled && (
        <AnimationTimeline
          isPlaying={isAnimating}
          progress={animationProgress}
          speed={animationSpeed}
          onPlayPause={() => setIsAnimating(!isAnimating)}
          onReset={() => { setIsAnimating(false); setAnimationProgress(0); }}
          onProgressChange={(p) => { setIsAnimating(false); setAnimationProgress(p); }}
          onSpeedChange={(s) => setAnimationSpeed(s)}
          style={{
            left: 0,
            right: 0,
            bottom: 0,
            position: 'absolute',
          }}
        />
      )}

    </div>
  );
}
