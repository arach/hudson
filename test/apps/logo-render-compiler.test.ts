// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  compileLogoRenderBodySync,
  stripTemplateMetaBlock,
} from '@/app/api/logo/renderCompiler';
import { mergeLogoTemplateMeta } from '@/app/api/logo/templateMeta';

describe('Logo render compiler', () => {
  it('compiles AI-authored TypeScript into executable render body JavaScript', () => {
    const js = compileLogoRenderBodySync(`
      const meta = { "name": "Example" };

      const vb = 512;
      function halve(value: number): number {
        return value / 2;
      }
      return \`<rect width="\${halve(vb)}" height="\${vb}"/>\`;
    `);

    expect(js).not.toContain('value: number');
    expect(js).not.toMatch(/\bconst\s+vb\s*=/);

    const fn = new Function('p', 'vb', js);
    expect(fn({}, 512)).toBe('<rect width="256" height="512"/>');
  });

  it('strips the template meta header before runtime compilation', () => {
    const body = stripTemplateMetaBlock(`
      const meta = { "name": "Example", "params": { "scale": { "default": 1 } } };

      return '<g/>';
    `);

    expect(body.trim()).toBe("return '<g/>';");
  });

  it('preserves existing placement metadata when render-only updates arrive', () => {
    const meta = mergeLogoTemplateMeta(
      {
        name: 'Talkie T · Instrument Viewer-v2',
        kind: 'brand',
        parentId: 'talkie-instrument-viewer',
        description: 'Old design',
        params: { obsolete: { type: 'toggle', label: 'Obsolete', default: true } },
      },
      {
        description: 'Simplified design',
      },
    );

    expect(meta).toMatchObject({
      name: 'Talkie T · Instrument Viewer-v2',
      kind: 'brand',
      parentId: 'talkie-instrument-viewer',
      description: 'Simplified design',
      params: { obsolete: { type: 'toggle', label: 'Obsolete', default: true } },
    });
  });
});
