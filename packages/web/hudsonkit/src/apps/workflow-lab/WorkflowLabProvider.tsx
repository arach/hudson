'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  hudWorkflowBasicSchema,
  hudWorkflowFixtures,
  type HudWorkflowDocument,
  type HudWorkflowFixture,
  type HudWorkflowNode,
  type HudWorkflowSchema,
} from '../../workflow';

interface WorkflowLabContextValue {
  fixtures: HudWorkflowFixture[];
  schema: HudWorkflowSchema;
  activeFixture: HudWorkflowFixture;
  activeDocument: HudWorkflowDocument;
  activeFixtureId: string;
  selectedNodeId: string | null;
  selectedNode: HudWorkflowNode | null;
  selectFixture: (id: string) => void;
  selectNode: (id: string | null) => void;
}

const WorkflowLabContext = createContext<WorkflowLabContextValue | null>(null);

export function useWorkflowLab() {
  const context = useContext(WorkflowLabContext);
  if (!context) throw new Error('useWorkflowLab must be used inside WorkflowLabProvider');
  return context;
}

export function WorkflowLabProvider({ children }: { children: ReactNode }) {
  const [activeFixtureId, setActiveFixtureId] = useState(hudWorkflowFixtures[0]?.id ?? '');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const activeFixture = useMemo(
    () => hudWorkflowFixtures.find(fixture => fixture.id === activeFixtureId) ?? hudWorkflowFixtures[0],
    [activeFixtureId],
  );
  const activeDocument = activeFixture.document;

  const selectedNode = useMemo(
    () => activeDocument.nodes.find(node => node.id === selectedNodeId) ?? null,
    [activeDocument.nodes, selectedNodeId],
  );

  const selectFixture = useCallback((id: string) => {
    setActiveFixtureId(id);
    setSelectedNodeId(null);
  }, []);

  const value = useMemo<WorkflowLabContextValue>(() => ({
    fixtures: hudWorkflowFixtures,
    schema: hudWorkflowBasicSchema,
    activeFixture,
    activeDocument,
    activeFixtureId,
    selectedNodeId,
    selectedNode,
    selectFixture,
    selectNode: setSelectedNodeId,
  }), [
    activeDocument,
    activeFixture,
    activeFixtureId,
    selectedNode,
    selectedNodeId,
    selectFixture,
  ]);

  return (
    <WorkflowLabContext.Provider value={value}>
      {children}
    </WorkflowLabContext.Provider>
  );
}
