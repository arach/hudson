'use client';

import { useCallback } from 'react';
import { useRuntime } from './RuntimeProvider';

export function useRuntimePortOutput() {
  const { status, nodes, selectedNode } = useRuntime();

  return useCallback((portId: string) => {
    switch (portId) {
      case 'workspace-status':
        return status;
      case 'nodes':
        return nodes;
      case 'selected-node':
        return selectedNode;
      default:
        return null;
    }
  }, [nodes, selectedNode, status]);
}
