'use client';

import type { ReactNode } from 'react';
import { Copy, Eye, EyeOff, Lock, Trash2, Unlock } from 'lucide-react';
import type { ContextMenuEntry } from 'hudsonkit/context-menu';
import { DrawingSurface, makeDrawingNodeId, moveDrawingNode, type DrawingNode } from '../../lib/drawing';
import { useLogo } from './LogoProvider';

interface Props {
  /** Active template id — offset writes are keyed by this. */
  templateId: string;
  /** Rendered preview size in CSS pixels. SVG viewBox is always 512x512, so
   *  the user-to-pixel scale is `512 / size`. */
  size: number;
  /** The `<TemplateSvg>` or any rendered SVG containing `data-element-id`
   *  markers that this surface wraps. */
  children: ReactNode;
}

export function LogoInteractiveSurface({ templateId, size, children }: Props) {
  const {
    elementOffsets,
    setElementOffset,
    editorTool,
    drawingShapes,
    selectedDrawingId,
    setSelectedDrawingId,
    addDrawingShape,
    updateDrawingShape,
    deleteDrawingShape,
  } = useLogo();

  return (
    <DrawingSurface
      size={size}
      tool={editorTool}
      nodes={drawingShapes[templateId] ?? []}
      selectedNodeId={selectedDrawingId}
      editableElementOffsets={elementOffsets[templateId] ?? {}}
      onSelectedNodeChange={setSelectedDrawingId}
      onAddNode={(node) => addDrawingShape(templateId, node)}
      onUpdateNode={(nodeId, patch) => updateDrawingShape(templateId, nodeId, patch)}
      onDeleteNode={(nodeId) => deleteDrawingShape(templateId, nodeId)}
      getNodeContextMenuItems={(node) => buildDrawingNodeContextMenu({
        node,
        onDuplicate: () => addDrawingShape(templateId, duplicateDrawingNode(node)),
        onToggleVisible: () => updateDrawingShape(templateId, node.id, { visible: !node.visible }),
        onToggleLocked: () => updateDrawingShape(templateId, node.id, { locked: !node.locked }),
        onDelete: () => deleteDrawingShape(templateId, node.id),
      })}
      onEditableElementOffsetChange={(elementId, offset) => setElementOffset(templateId, elementId, offset)}
    >
      {children}
    </DrawingSurface>
  );
}

function duplicateDrawingNode(node: DrawingNode): DrawingNode {
  return moveDrawingNode({
    ...node,
    id: makeDrawingNodeId(node.type),
    name: `${node.name} copy`,
    locked: false,
  }, 16, 16);
}

function buildDrawingNodeContextMenu({
  node,
  onDuplicate,
  onToggleVisible,
  onToggleLocked,
  onDelete,
}: {
  node: DrawingNode;
  onDuplicate: () => void;
  onToggleVisible: () => void;
  onToggleLocked: () => void;
  onDelete: () => void;
}): ContextMenuEntry[] {
  const VisibleIcon = node.visible ? EyeOff : Eye;
  const LockIcon = node.locked ? Unlock : Lock;

  return [
    {
      id: 'drawing:duplicate',
      label: 'Duplicate',
      icon: <Copy size={13} />,
      action: onDuplicate,
    },
    { type: 'separator' },
    {
      id: 'drawing:visibility',
      label: node.visible ? 'Hide' : 'Show',
      icon: <VisibleIcon size={13} />,
      action: onToggleVisible,
    },
    {
      id: 'drawing:lock',
      label: node.locked ? 'Unlock' : 'Lock',
      icon: <LockIcon size={13} />,
      action: onToggleLocked,
    },
    { type: 'separator' },
    {
      id: 'drawing:delete',
      label: 'Delete',
      shortcut: 'Del',
      icon: <Trash2 size={13} />,
      action: onDelete,
    },
  ];
}
