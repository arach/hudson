import { describe, expect, it } from 'vitest';
import { bucketTemplatesForSidebar } from '@/app/apps/logo/LogoLeftPanel';
import { buildPersistedMatrixSession, type MatrixSession } from '@/app/apps/logo/LogoProvider';
import type { LogoTemplate } from '@/app/apps/logo/types';

function template(
  id: string,
  name: string,
  overrides: Partial<LogoTemplate> = {},
): LogoTemplate {
  return {
    id,
    name,
    description: '',
    renderBody: 'return "";',
    params: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('Logo template registration', () => {
  it('keeps AI-generated grandchildren reachable in the sidebar tree', () => {
    const sections = bucketTemplatesForSidebar([
      template('t-decoration', 'Talkie T', { kind: 'brand', builtin: true }),
      template('talkie-instrument-viewer', 'Talkie T · Instrument Viewer', {
        kind: 'brand',
        builtin: true,
        parentId: 't-decoration',
      }),
      template('talkie-instrument-viewer-v1', 'Talkie T · Instrument Viewer-v1', {
        kind: 'brand',
        parentId: 'talkie-instrument-viewer',
      }),
      template('talkie-instrument-viewer-v2', 'Talkie T · Instrument Viewer-v2', {
        kind: 'brand',
        parentId: 'talkie-instrument-viewer',
      }),
    ]);

    expect(sections.brands.map(node => node.template.id)).toEqual(['t-decoration']);
    const instrumentViewer = sections.brands[0].children.find(
      node => node.template.id === 'talkie-instrument-viewer',
    );

    expect(instrumentViewer?.children.map(node => node.template.id)).toEqual([
      'talkie-instrument-viewer-v1',
      'talkie-instrument-viewer-v2',
    ]);
  });

  it('reconstructs saved matrix experiments from persisted child templates', () => {
    const templates = [
      template('talkie-instrument-viewer', 'Talkie T · Instrument Viewer', {
        kind: 'brand',
        builtin: true,
      }),
      template('talkie-instrument-viewer-v1', 'Talkie T · Instrument Viewer-v1', {
        kind: 'brand',
        parentId: 'talkie-instrument-viewer',
        createdAt: 2,
      }),
      template('talkie-instrument-viewer-v2', 'Talkie T · Instrument Viewer-v2', {
        kind: 'brand',
        parentId: 'talkie-instrument-viewer',
        createdAt: 3,
      }),
      template('talkie-built-in-child', 'Built In Child', {
        kind: 'brand',
        builtin: true,
        parentId: 'talkie-instrument-viewer',
        createdAt: 4,
      }),
    ];
    const existing: MatrixSession[] = [{
      version: 2,
      label: 'v2',
      kind: 'ai',
      templateIds: ['talkie-instrument-viewer-v1'],
      sourceTemplateId: 'talkie-instrument-viewer',
      createdAt: 2,
    }];

    const session = buildPersistedMatrixSession(
      templates,
      'talkie-instrument-viewer',
      existing,
    );

    expect(session).toMatchObject({
      version: 3,
      label: 'v3 · saved',
      kind: 'ai',
      sourceTemplateId: 'talkie-instrument-viewer',
      templateIds: ['talkie-instrument-viewer-v2'],
    });
  });
});
