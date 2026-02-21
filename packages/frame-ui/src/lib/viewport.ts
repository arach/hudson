export function worldToScreen(
  worldPos: { x: number; y: number },
  panOffset: { x: number; y: number },
  scale: number,
  viewportCenter: { x: number; y: number }
) {
  return {
    x: viewportCenter.x + (worldPos.x + panOffset.x) * scale,
    y: viewportCenter.y + (worldPos.y + panOffset.y) * scale,
  };
}

export function screenToWorld(
  screenPos: { x: number; y: number },
  panOffset: { x: number; y: number },
  scale: number,
  viewportCenter: { x: number; y: number }
) {
  return {
    x: (screenPos.x - viewportCenter.x) / scale - panOffset.x,
    y: (screenPos.y - viewportCenter.y) / scale - panOffset.y,
  };
}
