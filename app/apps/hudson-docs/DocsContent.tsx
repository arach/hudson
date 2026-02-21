'use client';

import { useDocs } from './DocsProvider';
import { COMPONENTS } from './data';
import { ComponentSheet, ListView, TilesView } from './components';

export function DocsContent() {
  const {
    viewMode, openSheets, selectedCard, setSelectedCard,
    searchValue, settings, sheetPositions, getSheetPos,
    handleSheetDragStart, isDraggingRef, toggleSheet, closeSheet,
  } = useDocs();

  const isCanvasMode = viewMode === 'canvas';

  return (
    <>
      {/* Canvas-only: hub card, floating sheets, connectors */}
      {isCanvasMode && (() => {
        const hubPos = sheetPositions['hub'] ?? { x: 0, y: 0 };
        const isHubSelected = selectedCard === 'hub';
        const g = settings.glowIntensity / 100;
        const hubShadow = isHubSelected
          ? `0 0 40px rgba(16,185,129,${(0.3*g).toFixed(3)}), 0 0 80px rgba(16,185,129,${(0.15*g).toFixed(3)}), inset 0 1px 0 rgba(16,185,129,${(0.2*g).toFixed(3)})`
          : '0 0 40px rgba(0,0,0,0.6)';
        return (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `calc(50% + ${hubPos.x}px)`,
              top: `calc(50% + ${hubPos.y}px)`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              onMouseDown={(e) => handleSheetDragStart('hub', e)}
              onClick={() => { if (!isDraggingRef.current) setSelectedCard('hub'); }}
              style={{ boxShadow: hubShadow }}
              className={`w-[340px] p-6 border rounded-lg bg-neutral-800/40 backdrop-blur-sm pointer-events-auto cursor-grab active:cursor-grabbing transition-all ${
                isHubSelected ? 'border-emerald-500/80' : 'border-neutral-700/50 hover:border-neutral-600/80'
              }`}
            >
              <h1 className="text-xl font-bold text-white mb-1 font-mono tracking-wider">HUDSON</h1>
              <p className="text-neutral-300 text-[11px] font-mono mb-5">
                HUD-style chrome components. Click a card to open its doc sheet.
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                {COMPONENTS.map(c => {
                  const Icon = c.icon;
                  const isOpen = openSheets.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleSheet(c.id)}
                      className={`p-2.5 rounded border text-left transition-all cursor-pointer pointer-events-auto ${
                        isOpen
                          ? 'border-emerald-500/50 bg-emerald-500/5'
                          : 'border-neutral-700/50 bg-neutral-900/40 hover:border-neutral-700 hover:bg-black/50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Icon size={10} className={isOpen ? 'text-emerald-400' : 'text-neutral-400'} />
                        <span className={`font-bold tracking-wider text-[10px] ${isOpen ? 'text-emerald-400' : 'text-emerald-400/70'}`}>{c.label}</span>
                      </div>
                      <div className="text-neutral-400 text-[9px] font-mono leading-tight mb-0.5">{c.ns}</div>
                      <div className="text-neutral-300 text-[10px] leading-tight">{c.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating component doc sheets */}
      {isCanvasMode && COMPONENTS.filter(c => openSheets.has(c.id)).map(c => {
        const pos = getSheetPos(c);
        return (
          <div
            key={c.id}
            className="absolute pointer-events-none"
            style={{
              left: `calc(50% + ${pos.x}px)`,
              top: `calc(50% + ${pos.y}px)`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <ComponentSheet
              entry={c}
              onClose={() => closeSheet(c.id)}
              isSelected={selectedCard === c.id}
              onSelect={() => { if (!isDraggingRef.current) setSelectedCard(c.id); }}
              onDragStart={(e) => handleSheetDragStart(c.id, e)}
              glowIntensity={settings.glowIntensity}
            />
          </div>
        );
      })}

      {/* Connection lines from hub to open sheets */}
      {isCanvasMode && <ConnectorLines />}

      {/* List view */}
      {viewMode === 'list' && <ListView components={COMPONENTS} searchValue={searchValue} selectedId={selectedCard} onSelect={setSelectedCard} />}

      {/* Tiles view */}
      {viewMode === 'tiles' && <TilesView components={COMPONENTS} openIds={openSheets} onClose={closeSheet} glowIntensity={settings.glowIntensity} selectedId={selectedCard} onSelect={setSelectedCard} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Connector lines sub-component (reads from context)
// ---------------------------------------------------------------------------
function ConnectorLines() {
  const { openSheets, selectedCard, settings, sheetPositions, getSheetPos } = useDocs();

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: -1 }}
    >
      {COMPONENTS.filter(c => openSheets.has(c.id)).map(c => {
        const pos = getSheetPos(c);
        // Use the SVG's own dimensions for coordinate space
        // The SVG fills the world content area, so 50% = center
        const svgEl = document.querySelector('[data-hudson-world] svg');
        const svgW = svgEl?.clientWidth ?? window.innerWidth;
        const svgH = svgEl?.clientHeight ?? window.innerHeight;
        const halfVW = svgW / 2;
        const halfVH = svgH / 2;
        const hubPos = sheetPositions['hub'] ?? { x: 0, y: 0 };
        const hubCenter = { x: halfVW + hubPos.x, y: halfVH + hubPos.y };
        const sheetCenter = { x: halfVW + pos.x, y: halfVH + pos.y };

        const dx = sheetCenter.x - hubCenter.x;
        const dy = sheetCenter.y - hubCenter.y;
        const CARD_HW = 170;
        const HUB_HH = 130;
        const SHEET_HH = 200;

        let hubAnchor, sheetAnchor;
        if (dx === 0 && dy === 0) {
          hubAnchor = hubCenter;
          sheetAnchor = sheetCenter;
        } else if (Math.abs(dx) * HUB_HH > Math.abs(dy) * CARD_HW) {
          const dir = dx > 0 ? 1 : -1;
          hubAnchor = { x: hubCenter.x + dir * CARD_HW, y: hubCenter.y };
          sheetAnchor = { x: sheetCenter.x - dir * CARD_HW, y: sheetCenter.y };
        } else {
          const dir = dy > 0 ? 1 : -1;
          hubAnchor = { x: hubCenter.x, y: hubCenter.y + dir * HUB_HH };
          sheetAnchor = { x: sheetCenter.x, y: sheetCenter.y - dir * SHEET_HH };
        }

        const isSelected = selectedCard === c.id;
        const lineColor = isSelected ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.08)';
        const dotColor = isSelected ? 'rgba(16,185,129,0.5)' : 'rgba(16,185,129,0.2)';
        const dash = { dashed: '4 4', solid: undefined, dotted: '2 2' }[settings.connectorStyle];
        return (
          <g key={c.id}>
            <line
              x1={hubAnchor.x} y1={hubAnchor.y}
              x2={sheetAnchor.x} y2={sheetAnchor.y}
              stroke={lineColor}
              strokeWidth={isSelected ? 1.5 : 1}
              strokeDasharray={dash}
            />
            <circle cx={hubAnchor.x} cy={hubAnchor.y} r={3} fill="black" stroke={dotColor} strokeWidth={1.5} />
            <circle cx={sheetAnchor.x} cy={sheetAnchor.y} r={3} fill="black" stroke={dotColor} strokeWidth={1.5} />
          </g>
        );
      })}
    </svg>
  );
}
