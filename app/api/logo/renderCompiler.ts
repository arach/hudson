import { transform, transformSync } from 'esbuild';

/**
 * LLMs writing JS-inside-JSON often over-escape template literals. Normalize
 * those sequences before esbuild sees the render body.
 */
export function normalizeLogoRenderSource(source: string): string {
  return source
    .replace(/\\`/g, '`')
    .replace(/\\\$\{/g, '${');
}

export function stripTemplateMetaBlock(source: string): string {
  return source.replace(/^\s*const\s+meta\s*=\s*\{[\s\S]*?\};\s*/, '');
}

export function stripRuntimeParamRedeclarations(source: string): string {
  return source
    .replace(/^(const|let|var)\s+vb\s*=\s*[^;]+;\n?/gm, '')
    .replace(/^(const|let|var)\s+p\s*=\s*[^;]+;\n?/gm, '');
}

function normalizeCompiledLogoRenderBody(js: string): string {
  return stripRuntimeParamRedeclarations(js).trim();
}

export async function compileLogoRenderBody(source: string): Promise<string> {
  const normalized = normalizeLogoRenderSource(stripTemplateMetaBlock(source).trim());
  const result = await transform(normalized, {
    loader: 'ts',
    target: 'es2020',
  });
  return normalizeCompiledLogoRenderBody(result.code);
}

export function compileLogoRenderBodySync(source: string): string {
  const normalized = normalizeLogoRenderSource(stripTemplateMetaBlock(source).trim());
  const result = transformSync(normalized, {
    loader: 'ts',
    target: 'es2020',
  });
  return normalizeCompiledLogoRenderBody(result.code);
}
