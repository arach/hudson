import { describe, expect, it } from 'vitest';
import { hudWorkflowBasicSchema, hudWorkflowFixtures } from '../src/workflow';
import type { HudWorkflowNode, HudWorkflowPort } from '../src/workflow';

function portsFor(node: HudWorkflowNode, role: HudWorkflowPort['role']): HudWorkflowPort[] {
  const nodeType = hudWorkflowBasicSchema.nodeTypes.find(type => type.id === node.typeID);
  const ownPorts = role === 'input' ? node.inputs : node.outputs;
  const defaultPorts = role === 'input' ? nodeType?.defaultInputs : nodeType?.defaultOutputs;
  return ownPorts ?? defaultPorts ?? [];
}

describe('HudWorkflow fixtures', () => {
  it('only references known node types', () => {
    const nodeTypeIds = new Set(hudWorkflowBasicSchema.nodeTypes.map(nodeType => nodeType.id));

    for (const fixture of hudWorkflowFixtures) {
      for (const node of fixture.document.nodes) {
        expect(nodeTypeIds.has(node.typeID), `${fixture.id}:${node.id}`).toBe(true);
      }
    }
  });

  it('has valid connection endpoints and port ids', () => {
    for (const fixture of hudWorkflowFixtures) {
      const nodes = new Map(fixture.document.nodes.map(node => [node.id, node]));

      for (const connection of fixture.document.connections) {
        const source = nodes.get(connection.sourceNodeID);
        const target = nodes.get(connection.targetNodeID);

        expect(source, `${fixture.id}:${connection.id}:source`).toBeDefined();
        expect(target, `${fixture.id}:${connection.id}:target`).toBeDefined();
        if (!source || !target) continue;

        expect(
          portsFor(source, 'output').some(port => port.id === connection.sourcePortID),
          `${fixture.id}:${connection.id}:sourcePort`,
        ).toBe(true);
        expect(
          portsFor(target, 'input').some(port => port.id === connection.targetPortID),
          `${fixture.id}:${connection.id}:targetPort`,
        ).toBe(true);
      }
    }
  });

  it('keeps fixture documents JSON-serializable', () => {
    for (const fixture of hudWorkflowFixtures) {
      expect(JSON.parse(JSON.stringify(fixture.document))).toEqual(fixture.document);
    }
  });
});
