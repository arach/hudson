import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  BUILT_IN_TEMPLATE_IDS,
  emitTemplateCss,
  isValidTemplateId,
  parseThemeCss,
  sanitizeTemplateId,
  type ThemeTemplateRecord,
} from '@/app/apps/theme-designer/model';

export const runtime = 'nodejs';

type SaveBody = {
  template?: ThemeTemplateRecord;
  registerRef?: boolean;
  refId?: string;
  defaultTheme?: 'dark' | 'light';
  defaultWorkspace?: string;
};

const TOKENS_PATH = join(process.cwd(), 'packages', 'web', 'hudsonkit', 'src', 'styles', 'tokens.css');
const REGISTRY_PATH = join(process.cwd(), 'app', 'embed', 'registry.ts');

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
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

  let body: SaveBody;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const template = body.template;
  if (!template) return jsonError('Missing template payload.');
  const id = sanitizeTemplateId(template.id);
  if (!isValidTemplateId(id)) return jsonError('Template id must be kebab-case and start with a letter.');
  if ((BUILT_IN_TEMPLATE_IDS as readonly string[]).includes(id)) {
    return jsonError('Built-in templates are read-only in the designer. Save as a new template id.');
  }

  const normalized: ThemeTemplateRecord = {
    id,
    base: { ...template.base },
    themes: {
      dark: { ...template.themes.dark, 'color-scheme': 'dark' },
      light: { ...template.themes.light, 'color-scheme': 'light' },
    },
  };

  try {
    const current = await readFile(TOKENS_PATH, 'utf-8');
    const nextCss = `${removeTemplateBlocks(current, id).trimEnd()}\n\n${emitTemplateCss(normalized, id)}\n`;
    await writeFile(TOKENS_PATH, nextCss, 'utf-8');

    let ref: { updated: boolean; reason?: string } | undefined;
    if (body.registerRef) {
      const refId = sanitizeTemplateId(body.refId || id);
      if (!isValidTemplateId(refId)) return jsonError('Preset ref id must be kebab-case and start with a letter.');
      ref = await upsertConsumerRef({
        refId,
        templateId: id,
        theme: body.defaultTheme ?? 'dark',
        defaultWorkspace: body.defaultWorkspace || 'hudson-os',
      });
    }

    return NextResponse.json({ ok: true, id, css: emitTemplateCss(normalized, id), ref });
  } catch (error) {
    return jsonError(String(error), 500);
  }
}
