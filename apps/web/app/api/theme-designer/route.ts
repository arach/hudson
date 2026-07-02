import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  BUILT_IN_TEMPLATE_IDS,
  emitTemplateCss,
  isValidTemplateId,
  parseThemeCss,
  sanitizeTemplateId,
  validateTemplateTokens,
  type ThemeTemplateRecord,
  type TokenMap,
} from '@/app/apps/theme-designer/model';
import { isTrustedLocalRequest } from '@/app/lib/localRequestGuard';
import { REPO_ROOT } from '@/app/lib/repoRoot';

export const runtime = 'nodejs';

type SaveBody = {
  template?: ThemeTemplateRecord;
  registerRef?: boolean;
  refId?: string;
  defaultTheme?: 'dark' | 'light';
  defaultWorkspace?: string;
};

const TOKENS_PATH = join(REPO_ROOT, 'packages', 'web', 'hudsonkit', 'src', 'styles', 'tokens.css');
const REGISTRY_PATH = join(process.cwd(), 'app', 'embed', 'registry.ts');

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}


function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTokenMap(value: unknown): TokenMap | null {
  if (!isPlainObject(value)) return null;
  const map: TokenMap = {};
  for (const [key, tokenValue] of Object.entries(value)) {
    if (typeof tokenValue !== 'string') return null;
    map[key] = tokenValue;
  }
  return map;
}

function isValidWorkspaceId(value: string): boolean {
  return /^[a-z][a-z0-9-]{0,63}$/.test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeTemplateBlocks(css: string, id: string): string {
  const escaped = escapeRegExp(id);
  const re = new RegExp(
    `\\n?\\s*\\[data-hudson-template=["']${escaped}["'](?:\\[data-hudson-theme=["'](?:dark|light)["']\\])?\\s*\\{[\\s\\S]*?\\}\\s*`,
    'g',
  );
  return css.replace(re, '\n');
}

function quoteObjectKey(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

function singleQuote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

async function upsertConsumerRef({
  refId,
  templateId,
  theme,
  defaultWorkspace,
}: {
  refId: string;
  templateId: string;
  theme: 'dark' | 'light';
  defaultWorkspace: string;
}) {
  const source = await readFile(REGISTRY_PATH, 'utf-8');
  if (source.includes(`ref: ${singleQuote(refId)}`) || source.includes(`ref: "${refId}"`)) {
    return { updated: false, reason: 'ref already present' };
  }

  const entry = [
    `  ${quoteObjectKey(refId)}: {`,
    `    ref: ${singleQuote(refId)},`,
    `    theme: ${singleQuote(theme)},`,
    `    template: ${singleQuote(templateId)},`,
    `    defaultWorkspace: ${singleQuote(defaultWorkspace)},`,
    '    palette: {},',
    '    fonts: {},',
    '  },',
  ].join('\n');

  const marker = '\n};\n\n/** Look up a consumer';
  if (!source.includes(marker)) {
    throw new Error('Could not find consumers object terminator in app/embed/registry.ts');
  }

  await writeFile(REGISTRY_PATH, source.replace(marker, `\n${entry}\n};\n\n/** Look up a consumer`), 'utf-8');
  return { updated: true };
}

export async function GET() {
  try {
    const css = await readFile(TOKENS_PATH, 'utf-8');
    return NextResponse.json({ ok: true, ...parseThemeCss(css), dev: process.env.NODE_ENV === 'development' });
  } catch (error) {
    return jsonError(String(error), 500);
  }
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return jsonError('Theme Designer can write source files only in development.', 403);
  }
  if (!isTrustedLocalRequest(req)) {
    return jsonError('Theme Designer writeback is limited to same-origin loopback development requests.', 403);
  }
  if (!req.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonError('Theme Designer writeback expects an application/json body.', 415);
  }

  let body: SaveBody;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const template = body.template;
  if (!template || !isPlainObject(template)) return jsonError('Missing template payload.');
  const id = sanitizeTemplateId(typeof template.id === 'string' ? template.id : '');
  if (!isValidTemplateId(id)) return jsonError('Template id must be kebab-case and start with a letter.');
  if ((BUILT_IN_TEMPLATE_IDS as readonly string[]).includes(id)) {
    return jsonError('Built-in templates are read-only in the designer. Save as a new template id.');
  }

  const themes = isPlainObject(template.themes) ? template.themes : null;
  const base = normalizeTokenMap(template.base ?? {});
  const dark = normalizeTokenMap(themes?.dark ?? {});
  const light = normalizeTokenMap(themes?.light ?? {});
  if (!base || !dark || !light) return jsonError('Template token maps must contain string values only.');

  const normalized: ThemeTemplateRecord = {
    id,
    base,
    themes: {
      dark: { ...dark, 'color-scheme': 'dark' },
      light: { ...light, 'color-scheme': 'light' },
    },
  };
  const tokenIssues = validateTemplateTokens(normalized);
  if (tokenIssues.length > 0) {
    return jsonError(`Unsafe token payload: ${tokenIssues.slice(0, 3).join('; ')}`);
  }

  try {
    const current = await readFile(TOKENS_PATH, 'utf-8');
    const nextCss = `${removeTemplateBlocks(current, id).trimEnd()}\n\n${emitTemplateCss(normalized, id)}\n`;
    await writeFile(TOKENS_PATH, nextCss, 'utf-8');

    let ref: { updated: boolean; reason?: string } | undefined;
    if (body.registerRef) {
      const refId = sanitizeTemplateId(typeof body.refId === 'string' ? body.refId : id);
      if (!isValidTemplateId(refId)) return jsonError('Preset ref id must be kebab-case and start with a letter.');
      const defaultWorkspace = typeof body.defaultWorkspace === 'string' ? body.defaultWorkspace : 'hudson-os';
      if (!isValidWorkspaceId(defaultWorkspace)) return jsonError('Default workspace id must be kebab-case.');
      const defaultTheme = body.defaultTheme === 'light' ? 'light' : 'dark';
      ref = await upsertConsumerRef({
        refId,
        templateId: id,
        theme: defaultTheme,
        defaultWorkspace,
      });
    }

    return NextResponse.json({ ok: true, id, css: emitTemplateCss(normalized, id), ref });
  } catch (error) {
    return jsonError(String(error), 500);
  }
}
