import { describe, expect, it } from 'vitest';
import { bucketTemplatesForSidebar } from '@/app/apps/logo/LogoLeftPanel';
import {
  buildPersistedMatrixSession,
  withTemplateParamDefaults,
  type MatrixSession,
} from '@/app/apps/logo/LogoProvider';
import {
  compactLogoTemplateLabel,
  normalizeLogoTemplateLineage,
  resolveLogoTemplatePlacement,
  type LogoTemplate,
} from '@/app/apps/logo/types';

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

  it('heals older AI-created brand templates that were saved without lineage metadata', () => {
    const sections = bucketTemplatesForSidebar([
      template('t-decoration', 'Talkie T', { kind: 'brand', builtin: true }),
      template('talkie-instrument-viewer', 'Talkie T · Instrument Viewer', {
        kind: 'brand',
        builtin: true,
        parentId: 't-decoration',
      }),
      template('16857149', 'Talkie T · Instrument Viewer-v2', {
        kind: 'brand',
        parentId: 'talkie-instrument-viewer',
        createdAt: 2,
      }),
      template('4a313932', 'Talkie T · Instrument Viewer-v2-v2', {
        createdAt: 3,
      }),
    ]);

    expect(sections.styles.map(node => node.template.id)).not.toContain('4a313932');
    const instrumentViewer = sections.brands[0].children.find(
      node => node.template.id === 'talkie-instrument-viewer',
    );
    const v2 = instrumentViewer?.children.find(node => node.template.id === '16857149');

    expect(v2?.children.map(node => node.template.id)).toEqual(['4a313932']);
    expect(v2?.children[0].template).toMatchObject({
      id: '4a313932',
      kind: 'brand',
      parentId: '16857149',
    });
  });

  it('places new AI-created templates under the active source template by default', () => {
    const templates = [
      template('t-decoration', 'Talkie T', { kind: 'brand', builtin: true }),
      template('talkie-instrument-viewer', 'Talkie T · Instrument Viewer', {
        kind: 'brand',
        parentId: 't-decoration',
      }),
    ];

    expect(resolveLogoTemplatePlacement(templates, 'talkie-instrument-viewer', {
      name: 'Streamlined Viewer',
    })).toEqual({
      parentId: 'talkie-instrument-viewer',
      kind: 'brand',
    });
  });

  it('compacts repeated brand prefixes in nested sidebar labels', () => {
    const lineage = normalizeLogoTemplateLineage([
      template('t-decoration', 'Talkie T', { kind: 'brand', builtin: true }),
      template('16857149', 'Talkie T · Instrument Viewer-v2', {
        kind: 'brand',
        parentId: 't-decoration',
      }),
      template('4a313932', 'Talkie T · Instrument Viewer-v2-v2', {
        createdAt: 3,
      }),
    ]);
    const byId = new Map(lineage.map(item => [item.id, item]));

    expect(compactLogoTemplateLabel(byId.get('16857149')!, [byId.get('t-decoration')!]))
      .toBe('Instrument Viewer-v2');
    expect(compactLogoTemplateLabel(byId.get('4a313932')!, [
      byId.get('t-decoration')!,
      byId.get('16857149')!,
    ])).toBe('v2');
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

  it('backfills defaults for new AI-authored template params immediately', () => {
    const values = withTemplateParamDefaults({}, 'custom-template', [
      { key: 'depth', default: true },
      { key: 'ink', default: '#f7f3eb' },
    ]);

    expect(values).toEqual({
      'custom-template': {
        depth: 1,
        ink: '#f7f3eb',
      },
    });
  });
});
