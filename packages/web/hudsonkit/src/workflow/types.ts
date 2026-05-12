import type { ReactNode } from 'react';

export type HudWorkflowValue =
  | null
  | string
  | number
  | boolean
  | HudWorkflowValue[]
  | { [key: string]: HudWorkflowValue };

export type HudWorkflowTint =
  | 'cyan'
  | 'blue'
  | 'teal'
  | 'emerald'
  | 'amber'
  | 'neutral';

export type HudWorkflowPortRole = 'input' | 'output';

export interface HudWorkflowViewport {
  pan: { x: number; y: number };
  scale: number;
}

export interface HudWorkflowDocumentMetadata {
  sourceFormat?: 'fixture' | 'flat-json' | 'portable' | 'native' | 'unknown';
  sourceId?: string;
  sourcePath?: string;
  slug?: string;
  description?: string;
  icon?: string;
  color?: HudWorkflowTint | string;
  maintainer?: string | null;
  isEnabled?: boolean;
  isPinned?: boolean;
  autoRun?: boolean;
  autoRunOrder?: number;
  sidecar?: Record<string, HudWorkflowValue>;
}

export interface HudWorkflowPort {
  id: string;
  label: string;
  role: HudWorkflowPortRole;
}

export interface HudWorkflowNode {
  id: string;
  typeID: string;
  title: string;
  subtitle?: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  inputs?: HudWorkflowPort[];
  outputs?: HudWorkflowPort[];
  outputKey?: string;
  isEnabled?: boolean;
  condition?: string | null;
  fieldValues?: Record<string, HudWorkflowValue>;
  metadata?: Record<string, HudWorkflowValue>;
}

export interface HudWorkflowConnection {
  id: string;
  sourceNodeID: string;
  sourcePortID: string;
  targetNodeID: string;
  targetPortID: string;
  label?: string;
}

export interface HudWorkflowDocument {
  id: string;
  title: string;
  metadata?: HudWorkflowDocumentMetadata;
  nodes: HudWorkflowNode[];
  connections: HudWorkflowConnection[];
  viewport?: HudWorkflowViewport;
  selectedNodeIDs?: string[];
}

export type HudWorkflowFieldType =
  | 'string'
  | 'text'
  | 'number'
  | 'boolean'
  | 'picker'
  | 'slider'
  | 'string-array'
  | 'object'
  | 'object-array';

export interface HudWorkflowPickerOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface HudWorkflowFieldSchema {
  id: string;
  label: string;
  type: HudWorkflowFieldType;
  placeholder?: string;
  helpText?: string;
  group?: string;
  order?: number;
  options?: HudWorkflowPickerOption[];
  min?: number;
  max?: number;
  step?: number;
}

export interface HudWorkflowNodeTypeSchema {
  id: string;
  label: string;
  category: string;
  iconName?: string;
  tint?: HudWorkflowTint;
  defaultInputs?: HudWorkflowPort[];
  defaultOutputs?: HudWorkflowPort[];
  fields?: HudWorkflowFieldSchema[];
}

export interface HudWorkflowSchema {
  nodeTypes: HudWorkflowNodeTypeSchema[];
}

export interface HudWorkflowFixture {
  id: string;
  label: string;
  description: string;
  document: HudWorkflowDocument;
}
