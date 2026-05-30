import type { DrawingNode, DrawingNodeMap } from './model';

export type DrawingNodeListAction =
  | { type: 'node/add'; node: DrawingNode }
  | { type: 'node/update'; id: string; patch: Partial<DrawingNode> }
  | { type: 'node/delete'; ids: string[] }
  | { type: 'document/reset' };

export function drawingNodeListReducer(
  nodes: DrawingNode[] = [],
  action: DrawingNodeListAction,
): DrawingNode[] {
  switch (action.type) {
    case 'node/add':
      return [...nodes, action.node];
    case 'node/update': {
      let changed = false;
      const next = nodes.map((node) => {
        if (node.id !== action.id) return node;
        changed = true;
        return { ...node, ...action.patch } as DrawingNode;
      });
      return changed ? next : nodes;
    }
    case 'node/delete': {
      if (action.ids.length === 0) return nodes;
      const ids = new Set(action.ids);
      const next = nodes.filter(node => !ids.has(node.id));
      return next.length === nodes.length ? nodes : next;
    }
    case 'document/reset':
      return nodes.length === 0 ? nodes : [];
  }
}

export function drawingNodeMapReducer(
  map: DrawingNodeMap,
  documentId: string,
  action: DrawingNodeListAction,
): DrawingNodeMap {
  const current = map[documentId] ?? [];
  const nextList = drawingNodeListReducer(current, action);
  if (nextList === current) return map;

  if (nextList.length === 0) {
    if (!(documentId in map)) return map;
    const nextMap = { ...map };
    delete nextMap[documentId];
    return nextMap;
  }

  return { ...map, [documentId]: nextList };
}
