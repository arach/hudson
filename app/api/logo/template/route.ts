import { NextResponse } from 'next/server';
import { readFile, writeFile, readdir, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { appStorage } from 'hudsonkit/server';
import { builtinRenderBodies } from '../../../apps/logo/builtinRenderBodies';
import { compileLogoRenderBodySync, stripTemplateMetaBlock } from '../renderCompiler';
import { mergeLogoTemplateMeta } from '../templateMeta';

const BUILTIN_IDS = new Set([
  'negative-space', 'green-channel', 'grid-color', 'interlocking',
  'lattice-grid', 'app-windows', 'dot-matrix', 'mosaic', 't-decoration',
  't-texture-phosphor', 't-texture-dot-matrix', 't-texture-pixel',
  't-texture-halftone', 't-texture-letterpress', 't-texture-etched',
  't-texture-chrome', 't-texture-particle',
]);

// ---------------------------------------------------------------------------
// Template directory — one .js file per template
// User: ~/hudson/logo/.data/logo-templates/  (was ~/hudson/logos/...)
// Seed: {project}/.data/logo/logo-templates/  (was {project}/.data/logo-templates/)
// `migrateFromDataDir: 'logos'` renames the legacy user dir on first ensure().
// ---------------------------------------------------------------------------
const storage = appStorage('logo', { migrateFromDataDir: 'logos' });
const TEMPLATE_REL = 'logo-templates';
const isTemplateFile = (name: string) => name.endsWith('.js');
const templatePaths = storage.paths(TEMPLATE_REL);
const TEMPLATES_DIR = templatePaths.user;

interface TemplateMeta {
  name?: string;
  description?: string;
  builtin?: boolean;
  /** Classification: 'style' = abstract style templates, 'brand' = brand-specific marks. */
  kind?: 'style' | 'brand';
  /** Id of the template this was spawned from — drives family-tree nesting. */
  parentId?: string;
  params?: Record<string, TemplateParamMeta>;
}

interface TemplateParamMeta {
  type: 'number' | 'color' | 'toggle' | 'enum' | 'text' | 'repeatable';
  label: string;
  default: number | string | boolean | Record<string, unknown>[];
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  placeholder?: string;
  itemTemplate?: Record<string, unknown>;
  itemFields?: TemplateParamMeta[];
  group?: string;
}

interface ParsedTemplate {
  id: string;
  name: string;
  description: string;
  renderBody: string;
  sourceCode?: string;
  builtin: boolean;
  kind?: 'style' | 'brand';
  parentId?: string;
  params: {
    key: string;
    label: string;
    type: 'number' | 'color' | 'toggle' | 'enum' | 'text' | 'repeatable';
    default: number | string | boolean | Record<string, unknown>[];
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
    placeholder?: string;
    itemTemplate?: Record<string, unknown>;
    itemFields?: ParsedTemplate['params'];
    group?: string;
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
    const fn = new Function(`return ${match[1]};`);
    return fn() || {};
  } catch {
    return {};
  }
}

function parseTemplate(id: string, source: string, mtime: number): ParsedTemplate {
  const meta = extractMeta(source);
  const sourceBody = stripTemplateMetaBlock(source).trim();
  let renderBody = sourceBody;
  try {
    renderBody = compileLogoRenderBodySync(sourceBody);
  } catch (err) {
    log(`WARN: failed to compile template "${id}": ${err instanceof Error ? err.message : String(err)}`);
  }

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
    renderBody,
    sourceCode: sourceBody,
    builtin: meta.builtin || false,
    kind: meta.kind,
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
    kind: id === 't-decoration' ? 'brand' : 'style',
  };
  if (def.params) meta.params = def.params;
  return `const meta = ${JSON.stringify(meta, null, 2)};\n\n${def.renderBody}\n`;
}

async function ensureDir() {
  await storage.seedIfEmpty({
    rel: TEMPLATE_REL,
    match: isTemplateFile,
    // Installer-flow friendly: copy any bundled templates missing from the user
    // dir (none ship today, but the path is preserved for ops overrides).
    copyMissing: true,
    // Self-healing fallback: if neither seeds nor prior runs left anything
    // behind, synthesize the built-ins from `builtinRenderBodies.ts`. Keeps
    // the filesystem as the single source of truth thereafter.
    fallback: async ({ userDir }) => {
      await Promise.all(
        Object.entries(builtinRenderBodies).map(([id, def]) =>
          writeFile(join(userDir, `${id}.js`), builtInAsFile(id, def), 'utf-8'),
        ),
      );
    },
  });
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
    const { id, name, description, kind, parentId, renderBody, params, action } = body as {
      id?: string;
      name?: string;
      description?: string;
      kind?: 'style' | 'brand';
      parentId?: string;
      renderBody?: string;
      /** Client may send params as an array (LogoTemplate.params) or a Record. */
      params?: NonNullable<TemplateMeta['params']> | Array<{
        key: string;
        label?: string;
        type?: 'number' | 'color' | 'toggle' | 'enum' | 'text' | 'repeatable';
        default?: number | string | boolean | Record<string, unknown>[];
        min?: number;
        max?: number;
        step?: number;
        options?: string[];
        placeholder?: string;
        itemTemplate?: Record<string, unknown>;
        itemFields?: TemplateParamMeta[];
        group?: string;
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
        const existingSource = id ? await readFile(filePath, 'utf-8').catch(() => '') : '';
        const existingMeta = existingSource ? extractMeta(existingSource) : {};
        const meta = mergeLogoTemplateMeta(existingMeta, {
          name,
          description,
          kind,
          parentId,
          params: paramsRecord,
        });
        const metaStr = Object.keys(meta).length > 0
          ? `const meta = ${JSON.stringify(meta, null, 2)};\n\n`
          : '';
        fileContent = metaStr + trimmed + '\n';
      }
      await writeFile(filePath, fileContent, 'utf-8');
    } else if (
      name !== undefined ||
      description !== undefined ||
      kind !== undefined ||
      parentId !== undefined ||
      paramsRecord !== undefined
    ) {
      // Partial update — read existing, update meta
      let existingSource: string;
      try {
        existingSource = await readFile(filePath, 'utf-8');
      } catch {
        return NextResponse.json({ error: 'Template not found and no renderBody provided' }, { status: 400 });
      }
      // Replace meta object in source
      const existingMeta = extractMeta(existingSource);
      const nextMeta = mergeLogoTemplateMeta(existingMeta, {
        name,
        description,
        kind,
        parentId,
        params: paramsRecord,
      });
      // Rebuild meta line and replace in source
      const metaStr = `const meta = ${JSON.stringify(nextMeta, null, 2)};`;
      const updated = /const\s+meta\s*=/.test(existingSource)
        ? existingSource.replace(/const meta\s*=\s*\{[\s\S]*?\};/, metaStr)
        : `${metaStr}\n\n${existingSource}`;
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
