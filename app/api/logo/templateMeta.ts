export type LogoTemplateMeta = Record<string, unknown>;

export interface LogoTemplateMetaUpdates {
  name?: string;
  description?: string;
  parentId?: string;
  params?: unknown;
}

export function mergeLogoTemplateMeta(
  existing: object,
  updates: LogoTemplateMetaUpdates,
): LogoTemplateMeta {
  const meta: LogoTemplateMeta = { ...(existing as LogoTemplateMeta) };

  if (updates.name !== undefined) meta.name = updates.name;
  if (updates.description !== undefined) meta.description = updates.description;
  if (updates.parentId !== undefined) meta.parentId = updates.parentId;
  if (updates.params !== undefined) meta.params = updates.params;

  return meta;
}
