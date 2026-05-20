/**
 * Seed .data/logo-templates/ with one .js file per built-in template.
 * Run: bun scripts/seed-logo-templates.ts
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { builtinRenderBodies } from '../app/apps/logo/builtinRenderBodies';

const DIR = join(import.meta.dirname, '..', '.data', 'logo-templates');
mkdirSync(DIR, { recursive: true });

for (const [id, def] of Object.entries(builtinRenderBodies)) {
  const meta: Record<string, unknown> = {
    name: def.name,
    description: def.description,
    builtin: true,
  };
  if (def.params) meta.params = def.params;
  const header = `const meta = ${JSON.stringify(meta, null, 2)};\n\n`;
  const path = join(DIR, `${id}.js`);
  writeFileSync(path, header + def.renderBody + '\n');
  console.log(`  wrote ${path}`);
}

console.log(`\nSeeded ${Object.keys(builtinRenderBodies).length} templates to ${DIR}`);
