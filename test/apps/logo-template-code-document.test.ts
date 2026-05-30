import { describe, expect, it } from 'vitest';
import {
  logoTemplateToCodeDocumentPayload,
  resolveLogoTemplateDocumentUpdate,
} from '../../app/apps/logo/ports';
import type { LogoTemplate } from '../../app/apps/logo/types';

function makeTemplate(overrides: Partial<LogoTemplate> = {}): LogoTemplate {
  return {
    id: 'custom-logo',
    name: 'Custom Logo',
    description: 'Custom test template',
    renderBody: 'return `<rect width="${vb}" height="${vb}" fill="${p.paneColor}" />`;',
    sourceCode: 'return `<circle cx="${vb / 2}" cy="${vb / 2}" r="${p.radius}" />`;',
    params: [{
      key: 'radius',
      label: 'Radius',
      type: 'number',
      default: 128,
      min: 16,
      max: 256,
      step: 1,
    }],
    kind: 'style',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('logo template code document ports', () => {
  it('exports the active template as an editable JavaScript document payload', () => {
    const payload = logoTemplateToCodeDocumentPayload(makeTemplate());

    expect(payload).toMatchObject({
      id: 'logo-template:custom-logo',
      title: 'custom-logo.js',
      mediaType: 'text/javascript',
      language: 'javascript',
      kind: 'code',
      readOnly: false,
      source: {
        appId: 'logo',
        objectType: 'logo-template',
        objectId: 'custom-logo',
      },
    });
    expect(payload.value).toContain('const meta = {');
    expect(payload.value).toContain('"radius"');
    expect(payload.value).toContain('return `<circle');
  });

  it('marks built-in templates as read only', () => {
    const payload = logoTemplateToCodeDocumentPayload(makeTemplate({
      id: 'negative-space',
      builtin: true,
    }));

    expect(payload.readOnly).toBe(true);
  });

  it('resolves edited document payloads back to template updates', () => {
    const update = resolveLogoTemplateDocumentUpdate({
      id: 'logo-template:custom-logo',
      value: 'const meta = {};\n\nreturn `<path />`;',
      source: { appId: 'logo', objectType: 'logo-template', objectId: 'custom-logo' },
    }, 'fallback-template');

    expect(update).toEqual({
      templateId: 'custom-logo',
      sourceCode: 'const meta = {};\n\nreturn `<path />`;',
    });
  });
});
