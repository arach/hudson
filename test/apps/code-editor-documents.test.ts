import { describe, expect, it } from 'vitest';
import {
  coerceCodeDocumentFromInput,
  parseCodeDocumentJson,
  serializeCodeDocument,
} from '../../packages/web/hudson-showroom/src/code-editor/types';

describe('code editor document coercion', () => {
  it('preserves explicit document payload fields and source metadata', () => {
    const document = coerceCodeDocumentFromInput({
      id: 'logo-template:custom',
      title: 'custom.js',
      uri: 'hudson://logo/templates/custom.js',
      mediaType: 'text/javascript',
      language: 'javascript',
      kind: 'code',
      value: 'return `<rect />`;',
      source: { appId: 'logo', objectType: 'logo-template', objectId: 'custom' },
      metadata: { templateName: 'Custom' },
    }, { now: 123 });

    expect(document.id).toBe('logo-template:custom');
    expect(document.title).toBe('custom.js');
    expect(document.language).toBe('javascript');
    expect(document.value).toBe('return `<rect />`;');
    expect(document.source?.objectId).toBe('custom');
    expect(document.metadata?.templateName).toBe('Custom');
    expect(document.updatedAt).toBe(123);
  });

  it('opens arbitrary objects as editable JSON documents', () => {
    const document = coerceCodeDocumentFromInput({ nested: { value: 42 } }, { now: 456 });

    expect(document.title).toBe('object.json');
    expect(document.language).toBe('json');
    expect(document.value).toBe('{\n  "nested": {\n    "value": 42\n  }\n}');
    expect(parseCodeDocumentJson(document)).toEqual({ nested: { value: 42 } });
  });

  it('serializes edited documents for round-trip ports', () => {
    const document = coerceCodeDocumentFromInput({
      id: 'doc-1',
      title: 'doc.json',
      value: '{"ok":true}',
      source: { appId: 'source-app', objectType: 'thing', objectId: 'abc' },
    }, { now: 789 });

    expect(serializeCodeDocument(document)).toMatchObject({
      id: 'doc-1',
      title: 'doc.json',
      value: '{"ok":true}',
      source: { appId: 'source-app', objectType: 'thing', objectId: 'abc' },
    });
  });
});
