'use client';

import { useShaper } from '../ShaperProvider';

export function CanvasRenderer() {
  const {
    bezierData, showPath, strokesPath, pathColor, fillEnabled, fillWeights, fillPattern,
    animationProgress, pathLengthEstimate, isAnimating,
    showAnimationHandles, showAnimationAngles,
    handleLines, controlPoints, anchorPoints, anchorLabels, staticAngleLabels,
    revealedHandles, revealedAnchors, handleOpacity, angleArcRadius, showAngleReference,
    smoothStates,
    tool, penLastPoint, penPreviewPos,
  } = useShaper();

  return (
    <svg
      className="absolute pointer-events-none"
      style={{ left: -512, top: -512, width: 2048, height: 2048 }}
      viewBox="-512 -512 2048 2048"
      preserveAspectRatio="xMidYMid meet"
    >
      {showPath && strokesPath && (
        <>
          {/* Fill layer */}
          {fillEnabled && (() => {
            const weights = Object.values(fillWeights);
            const avgWeight = weights.length > 0 ? weights.reduce((sum, w) => sum + w, 0) / weights.length : 50;
            const fillOpacity = avgWeight / 100;
            return <path d={strokesPath} fill={pathColor} fillOpacity={fillPattern === 'solid' ? fillOpacity : fillOpacity * 0.8} stroke="none" />;
          })()}

          {/* Stroke path */}
          <path
            d={strokesPath}
            fill="none"
            stroke={pathColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={animationProgress > 0 && animationProgress < 1 ? pathLengthEstimate : undefined}
            strokeDashoffset={animationProgress > 0 && animationProgress < 1 ? pathLengthEstimate * (1 - animationProgress) : undefined}
          />

          {/* Static state (no animation) */}
          {animationProgress === 0 && (
            <>
              {!showAnimationHandles && !showAnimationAngles && handleLines}
              {!showAnimationHandles && !showAnimationAngles && controlPoints}
              {!showAnimationHandles && !showAnimationAngles && anchorPoints}
              {anchorLabels}
              {staticAngleLabels}
            </>
          )}

          {/* Paused animation state */}
          {animationProgress > 0 && !isAnimating && (
            <>
              {showAnimationHandles && revealedHandles.map((handle, i) => (
                <g key={`paused-handle-${i}`} opacity={handleOpacity}>
                  <line x1={handle.x1} y1={handle.y1} x2={handle.x2} y2={handle.y2} stroke="#60a5fa" strokeWidth="1" opacity={0.7} />
                  <circle cx={handle.handleX} cy={handle.handleY} r="2.5" fill="#3b82f6" opacity={0.8} />
                </g>
              ))}
              {(showAnimationHandles || showAnimationAngles) && revealedAnchors.map((anchor, i) => (
                <circle key={`paused-anchor-${i}`} cx={anchor.x} cy={anchor.y} r="3" fill={anchor.isSmooth ? '#10b981' : '#ef4444'} opacity={0.8} />
              ))}
              {!showAnimationHandles && !showAnimationAngles && anchorPoints}
              {showAnimationAngles && revealedHandles.map((handle, i) => (
                handle.angle !== undefined && (
                  <text key={`angle-${i}`} x={handle.handleX + 10} y={handle.handleY - 6} fontSize="10" fontFamily="monospace" fill="#60a5fa" opacity="0.6" fontWeight="500">{handle.angle}°</text>
                )
              ))}
            </>
          )}

          {/* Active animation state */}
          {animationProgress > 0 && isAnimating && revealedHandles.length > 0 && (
            <g className="animation-handles">
              {revealedHandles.map((handle, i) => {
                const arcR = angleArcRadius;
                const angleRad = (handle.angle! * Math.PI) / 180;
                const refAngle = 0;
                const startX = handle.anchorX + arcR * Math.cos(refAngle);
                const startY = handle.anchorY + arcR * Math.sin(refAngle);
                const endX = handle.anchorX + arcR * Math.cos(angleRad);
                const endY = handle.anchorY + arcR * Math.sin(angleRad);
                const largeArc = Math.abs(handle.angle!) > 180 ? 1 : 0;
                const sweepFlag = handle.angle! > 0 ? 1 : 0;
                const midAngle = angleRad / 2;
                const labelRadius = arcR + 12;
                const labelX = handle.anchorX + labelRadius * Math.cos(midAngle);
                const labelY = handle.anchorY + labelRadius * Math.sin(midAngle);
                return (
                  <g key={i} opacity={handle.opacity * handleOpacity}>
                    <line x1={handle.x1} y1={handle.y1} x2={handle.x2} y2={handle.y2} stroke="#60a5fa" strokeWidth="1" opacity={0.7} />
                    <circle cx={handle.handleX} cy={handle.handleY} r="2.5" fill="#3b82f6" opacity={0.8} />
                    {showAnimationAngles && handle.angle !== undefined && (
                      <>
                        {showAngleReference && <line x1={handle.anchorX} y1={handle.anchorY} x2={handle.anchorX + arcR * 1.2} y2={handle.anchorY} stroke="#60a5fa" strokeWidth="0.5" opacity={0.3} strokeDasharray="2,2" />}
                        <path d={`M ${startX} ${startY} A ${arcR} ${arcR} 0 ${largeArc} ${sweepFlag} ${endX} ${endY}`} fill="none" stroke="#60a5fa" strokeWidth="1.5" opacity="0.7" />
                        <text x={labelX} y={labelY} fontSize="9" fontFamily="monospace" fill="#60a5fa" opacity="0.9" fontWeight="600" textAnchor="middle" dominantBaseline="middle">{handle.angle}°</text>
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* Anchor reveal during animation */}
          {animationProgress > 0 && isAnimating && revealedAnchors.length > 0 && (
            <g className="animation-anchors">
              {revealedAnchors.map((anchor, i) => (
                <g key={i} opacity={anchor.opacity}>
                  {anchor.isSmooth && <circle cx={anchor.x} cy={anchor.y} r="9" fill="none" stroke="#22c55e" strokeWidth="2" opacity="0.8" />}
                  <circle cx={anchor.x} cy={anchor.y} r="5" fill={anchor.isSmooth ? '#22c55e' : '#ef4444'} opacity="0.9" />
                </g>
              ))}
            </g>
          )}
        </>
      )}

      {/* Pen tool preview */}
      {tool === 'pen' && penLastPoint && penPreviewPos && (
        <>
          <line x1={penLastPoint[0]} y1={penLastPoint[1]} x2={penPreviewPos[0]} y2={penPreviewPos[1]} stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.7" />
          <circle cx={penLastPoint[0]} cy={penLastPoint[1]} r="6" fill="#3b82f6" opacity="0.8" />
          <circle cx={penLastPoint[0]} cy={penLastPoint[1]} r="3" fill="white" opacity="0.9" />
        </>
      )}
      {tool === 'pen' && penPreviewPos && !penLastPoint && (
        <circle cx={penPreviewPos[0]} cy={penPreviewPos[1]} r="4" fill="#3b82f6" opacity="0.5" />
      )}
    </svg>
  );
}
