'use client';

import { useCallback } from 'react';
import { useVantage } from './VantageProvider';

export function useVantagePortOutput() {
  const { status, nodes, selectedNode } = useVantage();

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
