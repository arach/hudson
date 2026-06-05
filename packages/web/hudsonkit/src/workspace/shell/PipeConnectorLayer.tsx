'use client';

import { useMemo, useState, useCallback } from 'react';
import { useDataBus } from '../context/DataBusContext';
import type { PipeDefinition } from '../../index';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Point {
  x: number;
  y: number;
}

type AnchorSide = 'top' | 'bottom' | 'left' | 'right';

// ---------------------------------------------------------------------------
// Geometry helpers — adapted from ~/dev/arc ConnectorLayer
// ---------------------------------------------------------------------------

function bestAnchor(from: Bounds, to: Bounds): { fromSide: AnchorSide; toSide: AnchorSide } {
  const fromCenter = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
  const toCenter = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0
      ? { fromSide: 'right', toSide: 'left' }
      : { fromSide: 'left', toSide: 'right' };
  }
  return dy > 0
    ? { fromSide: 'bottom', toSide: 'top' }
    : { fromSide: 'top', toSide: 'bottom' };
}

function anchorPoint(bounds: Bounds, side: AnchorSide): Point {
  switch (side) {
    case 'top': return { x: bounds.x + bounds.w / 2, y: bounds.y };
    case 'bottom': return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h };
    case 'left': return { x: bounds.x, y: bounds.y + bounds.h / 2 };
    case 'right': return { x: bounds.x + bounds.w, y: bounds.y + bounds.h / 2 };
  }
}

function controlOffset(side: AnchorSide, distance: number): Point {
  const d = Math.abs(distance) * 0.45;
  switch (side) {
    case 'top': return { x: 0, y: -d };
    case 'bottom': return { x: 0, y: d };
    case 'left': return { x: -d, y: 0 };
    case 'right': return { x: d, y: 0 };
  }
}

function generatePath(from: Point, to: Point, fromSide: AnchorSide, toSide: AnchorSide): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const co1 = controlOffset(fromSide, dist);
  const co2 = controlOffset(toSide, dist);

  return `M ${from.x} ${from.y} C ${from.x + co1.x} ${from.y + co1.y}, ${to.x + co2.x} ${to.y + co2.y}, ${to.x} ${to.y}`;
}

// ---------------------------------------------------------------------------
// PipeConnectorLayer
// ---------------------------------------------------------------------------

interface PipeConnectorLayerProps {
  pipes: PipeDefinition[];
  windowBoundsMap: Record<string, Bounds>;
}

export function PipeConnectorLayer({ pipes, windowBoundsMap }: PipeConnectorLayerProps) {
  const { pushPipe } = useDataBus();
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const handlePush = useCallback(async (pipeId: string) => {
    setPushingId(pipeId);
    try {
      const ok = await pushPipe(pipeId);
      if (ok) {
        setFlashId(pipeId);
        setTimeout(() => setFlashId(null), 1200);
      }
    } finally {
      setPushingId(null);
    }
  }, [pushPipe]);

  const connectors = useMemo(() => {
    return pipes
      .filter(p => p.enabled && p.source?.appId && p.sink?.appId)
      .map(pipe => {
        const fromBounds = windowBoundsMap[pipe.source.appId];
        const toBounds = windowBoundsMap[pipe.sink.appId];
        if (!fromBounds || !toBounds) return null;

        const { fromSide, toSide } = bestAnchor(fromBounds, toBounds);
        const from = anchorPoint(fromBounds, fromSide);
        const to = anchorPoint(toBounds, toSide);
        const path = generatePath(from, to, fromSide, toSide);
        const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };

        return { pipe, from, to, path, mid };
      })
      .filter(Boolean) as { pipe: PipeDefinition; from: Point; to: Point; path: string; mid: Point }[];
  }, [pipes, windowBoundsMap]);

  if (connectors.length === 0) return null;

  return (
    <div className="absolute inset-0" style={{ overflow: 'visible', zIndex: 0 }}>
      {/* SVG layer for curves */}
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <marker
            id="pc-arrow"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <polygon points="0 0, 8 3, 0 6" fill="rgba(6,182,212,0.5)" />
          </marker>
          <marker
            id="pc-arrow-flash"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <polygon points="0 0, 8 3, 0 6" fill="rgba(6,182,212,0.9)" />
          </marker>
        </defs>

        {connectors.map(({ pipe, from, to, path }) => {
          const flashing = flashId === pipe.id;
          return (
            <g key={pipe.id}>
              {/* Glow */}
              <path
                d={path}
                fill="none"
                stroke={flashing ? 'rgba(6,182,212,0.25)' : 'rgba(6,182,212,0.06)'}
                strokeWidth={flashing ? 10 : 6}
                className="transition-all duration-500"
              />

              {/* Main path */}
              <path
                d={path}
                fill="none"
                stroke={flashing ? 'rgba(6,182,212,0.8)' : 'rgba(6,182,212,0.3)'}
                strokeWidth={flashing ? 2 : 1.5}
                strokeDasharray="6 4"
                markerEnd={flashing ? 'url(#pc-arrow-flash)' : 'url(#pc-arrow)'}
                className="transition-all duration-500"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="10"
                  to="0"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </path>

              {/* Endpoint dots */}
              <circle cx={from.x} cy={from.y} r={3} fill={flashing ? 'rgba(6,182,212,0.8)' : 'rgba(6,182,212,0.4)'} className="transition-all duration-500" />
              <circle cx={to.x} cy={to.y} r={3} fill={flashing ? 'rgba(6,182,212,0.8)' : 'rgba(6,182,212,0.4)'} className="transition-all duration-500" />
            </g>
          );
        })}
      </svg>

      {/* HTML overlay for interactive push buttons */}
      {connectors.map(({ pipe, mid }) => (
        <div
          key={`btn-${pipe.id}`}
          className="absolute pointer-events-auto"
          style={{
            left: mid.x,
            top: mid.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <button
            onClick={() => handlePush(pipe.id)}
            disabled={pushingId !== null}
            className={`
              flex items-center gap-1.5 px-2.5 py-1 rounded-full
              border text-[9px] font-mono
              transition-all duration-300 whitespace-nowrap
              ${flashId === pipe.id
                ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300 scale-110'
                : pushingId === pipe.id
                  ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400/60 animate-pulse'
                  : 'bg-black/60 border-white/10 text-white/40 hover:border-cyan-500/30 hover:text-cyan-400 hover:bg-cyan-500/10 backdrop-blur-sm'
              }
              disabled:opacity-30 disabled:pointer-events-none
            `}
            title={`Push: ${pipe.source.appId}.${pipe.source.portId} → ${pipe.sink.appId}.${pipe.sink.portId}`}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            {pipe.name}
          </button>
        </div>
      ))}
    </div>
  );
}
