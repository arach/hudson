import { NextResponse } from 'next/server';
import { readFile, writeFile, readdir, unlink, mkdir, stat, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { builtinRenderBodies } from '../../../apps/logo-designer/builtinRenderBodies';

const BUILTIN_IDS = new Set([
  'negative-space', 'green-channel', 'grid-color', 'interlocking',
  'lattice-grid', 'app-windows', 'dot-matrix', 'mosaic',
]);

// ---------------------------------------------------------------------------
// Template directory — one .js file per template
// User templates live in ~/hudson/logos/.data/logo-templates/
// Bundled seed templates live in {project}/.data/logo-templates/
// ---------------------------------------------------------------------------
const HOME = process.env.HOME || '';
const TEMPLATES_DIR = join(HOME, 'hudson', 'logos', '.data', 'logo-templates');
const SEED_DIR = join(process.cwd(), '.data', 'logo-templates');

interface TemplateMeta {
  name?: string;
  description?: string;
  builtin?: boolean;
  /** Id of the template this was spawned from — drives family-tree nesting. */
  parentId?: string;
  params?: Record<string, {
    type: 'number' | 'color' | 'toggle' | 'enum';
    label: string;
    default: number | string | boolean;
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
  }>;
}

interface ParsedTemplate {
  id: string;
  name: string;
  description: string;
  renderBody: string;
  builtin: boolean;
  parentId?: string;
  params: {
    key: string;
    label: string;
    type: 'number' | 'color';
    default: number | string;
    min?: number;
    max?: number;
    step?: number;
  }[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Extract the `meta` object from a template file. The meta is declared
 * as `const meta = { ... };` at the top. We extract just that declaration
 * and evaluate it separately so the render body's `return` doesn't interfere.
 */
function extractMeta(source: string): TemplateMeta {
  try {
    const match = source.match(/const\s+meta\s*=\s*(\{[\s\S]*?\});/);
    if (!match) return {};
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return ${match[1]};`);
    return fn() || {};
  } catch {
    return {};
  }
}

function parseTemplate(id: string, source: string, mtime: number): ParsedTemplate {
  const meta = extractMeta(source);

  const params: ParsedTemplate['params'] = [];
  if (meta.params) {
    for (const [key, def] of Object.entries(meta.params)) {
      params.push({ key, ...(def as Omit<ParsedTemplate['params'][number], 'key'>) });
    }
  }

  return {
    id,
    name: meta.name || id,
    description: meta.description || '',
    renderBody: source.trim(),
    builtin: meta.builtin || false,
    parentId: meta.parentId,
    params,
    createdAt: mtime,
    updatedAt: mtime,
  };
}

function builtInAsFile(id: string, def: typeof builtinRenderBodies[string]): string {
  const meta: Record<string, unknown> = {
    name: def.name,
    description: def.description,
    builtin: true,
  };
  if (def.params) meta.params = def.params;
  return `const meta = ${JSON.stringify(meta, null, 2)};\n\n${def.renderBody}\n`;
}

let seeded = false;
async function ensureDir() {
  await mkdir(TEMPLATES_DIR, { recursive: true });

  if (!seeded) {
    seeded = true;

    // Primary path: copy any bundled templates that are missing from the user's dir.
    // Installer-flow friendly — lets ops teams ship pre-baked overrides via SEED_DIR.
    if (existsSync(SEED_DIR)) {
      const existing = new Set((await readdir(TEMPLATES_DIR)).filter(f => f.endsWith('.js')));
      const seeds = (await readdir(SEED_DIR)).filter(f => f.endsWith('.js'));
      const missing = seeds.filter(f => !existing.has(f));
      if (missing.length > 0) {
        await Promise.all(missing.map(f => copyFile(join(SEED_DIR, f), join(TEMPLATES_DIR, f))));
      }
    }

    // Fallback: user dir is still empty because neither SEED_DIR nor previous runs
    // left anything behind. Synthesize the built-ins from `builtinRenderBodies.ts`
    // (which ships with the repo). Self-healing — works on a fresh clone with no
    // setup step, and keeps the filesystem as the single source of truth thereafter.
    const existing = (await readdir(TEMPLATES_DIR)).filter(f => f.endsWith('.js'));
    if (existing.length === 0) {
      await Promise.all(
        Object.entries(builtinRenderBodies).map(([id, def]) =>
          writeFile(join(TEMPLATES_DIR, `${id}.js`), builtInAsFile(id, def), 'utf-8'),
        ),
      );
    }
  }
}

async function readAllTemplates(): Promise<ParsedTemplate[]> {
  await ensureDir();
  const files = await readdir(TEMPLATES_DIR);
  const templates: ParsedTemplate[] = [];
  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    try {
      const filePath = join(TEMPLATES_DIR, file);
      const [source, fstat] = await Promise.all([
        readFile(filePath, 'utf-8'),
        stat(filePath),
      ]);
      const id = file.replace(/\.js$/, '');
      templates.push(parseTemplate(id, source, fstat.mtimeMs));
    } catch { /* skip malformed */ }
  }
  return templates;
}

// ---------------------------------------------------------------------------
// GET — return all templates
// ---------------------------------------------------------------------------
export async function GET() {
  const templates = await readAllTemplates();
  return NextResponse.json({ templates });
}

// ---------------------------------------------------------------------------
// POST — create, update, or delete a template
// ---------------------------------------------------------------------------
function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] logo/template: ${msg}`);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    log(`POST: id=${body.id ?? 'none'} name=${body.name ?? 'none'} action=${body.action ?? 'save'} renderBody=${body.renderBody ? `${body.renderBody.length} chars` : 'none'}`);
    const { id, name, description, parentId, renderBody, params, action } = body as {
      id?: string;
      name?: string;
      description?: string;
      parentId?: string;
      renderBody?: string;
      /** Client may send params as an array (LogoTemplate.params) or a Record. */
      params?: NonNullable<TemplateMeta['params']> | Array<{
        key: string;
        label?: string;
        type?: 'number' | 'color' | 'toggle' | 'enum';
        default?: number | string | boolean;
        min?: number;
        max?: number;
        step?: number;
        options?: string[];
      }>;
      action?: 'delete';
    };

    // Normalize params: client sends an array of {key, ...rest}; the file format
    // stores a Record<key, rest>. Convert either way.
    const paramsRecord: NonNullable<TemplateMeta['params']> | undefined = (() => {
      if (!params) return undefined;
      if (Array.isArray(params)) {
        const out: NonNullable<TemplateMeta['params']> = {};
        for (const p of params) {
          if (!p || !p.key) continue;
          const { key, ...rest } = p;
          out[key] = rest as NonNullable<TemplateMeta['params']>[string];
        }
        return out;
      }
      return params;
    })();

    await ensureDir();

    // Protect built-in templates from modification
    if (id && BUILTIN_IDS.has(id)) {
      log(`BLOCKED: cannot modify built-in template "${id}"`);
      return NextResponse.json({ error: `Cannot modify built-in template "${id}"` }, { status: 403 });
    }

    // Delete
    if (action === 'delete' && id) {
      try {
        await unlink(join(TEMPLATES_DIR, `${id}.js`));
      } catch { /* already gone */ }
      return NextResponse.json({ deleted: true, id });
    }

    // Create or update
    const templateId = id || crypto.randomUUID().slice(0, 8);
    const filePath = join(TEMPLATES_DIR, `${templateId}.js`);

    if (renderBody) {
      // The client sends a bare render body (just the JS that produces the
      // SVG inner) — the file format requires a `const meta = {...}` header
      // so parseTemplate can read back name/description/params. If the body
      // already has a meta block (e.g. someone hand-edited a full file), pass
      // it through verbatim; otherwise prepend a meta block synthesized from
      // the request fields.
      const trimmed = renderBody.trim();
      const hasMetaHeader = /^\s*const\s+meta\s*=/.test(trimmed);
      let fileContent: string;
      if (hasMetaHeader) {
        fileContent = trimmed + '\n';
      } else {
        const meta: Record<string, unknown> = {};
        if (name) meta.name = name;
        if (description) meta.description = description;
        if (parentId) meta.parentId = parentId;
        if (paramsRecord && Object.keys(paramsRecord).length > 0) meta.params = paramsRecord;
        const metaStr = Object.keys(meta).length > 0
          ? `const meta = ${JSON.stringify(meta, null, 2)};\n\n`
          : '';
        fileContent = metaStr + trimmed + '\n';
      }
      await writeFile(filePath, fileContent, 'utf-8');
    } else if (name || description) {
      // Partial update — read existing, update meta
      let existingSource: string;
      try {
        existingSource = await readFile(filePath, 'utf-8');
      } catch {
        return NextResponse.json({ error: 'Template not found and no renderBody provided' }, { status: 400 });
      }
      // Replace meta object in source
      const existingMeta = extractMeta(existingSource);
      if (name) existingMeta.name = name;
      if (description) existingMeta.description = description;
      if (parentId) existingMeta.parentId = parentId;
      // Rebuild meta line and replace in source
      const metaStr = `const meta = ${JSON.stringify(existingMeta, null, 2)};`;
      const updated = existingSource.replace(/const meta\s*=\s*\{[\s\S]*?\};/, metaStr);
      await writeFile(filePath, updated, 'utf-8');
    } else {
      return NextResponse.json({ error: 'renderBody is required for new templates' }, { status: 400 });
    }

    const fstat = await stat(filePath);
    const source = await readFile(filePath, 'utf-8');
    const template = parseTemplate(templateId, source, fstat.mtimeMs);
    return NextResponse.json({ template });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
