import { resolve, dirname } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import type { TemplateVars } from './utils';
import { fileCreated } from './log';

// ---------------------------------------------------------------------------
// Dev workspace file generator
// ---------------------------------------------------------------------------

export async function generateWorkspace(
  vars: TemplateVars,
  projectRoot: string,
): Promise<string> {
  const appId = vars.__APP_ID__;
  const appVar = vars.__APP_VAR__;
  const appName = vars.__APP_NAME__;
  const displayName = vars.__APP_DISPLAY_NAME__;
  const description = vars.__APP_DESCRIPTION__;
  const mode = vars.__APP_MODE__;

  const workspaceVar = `${appVar}DevWorkspace`;
  const fileName = `${appVar}Dev.ts`;
  const relPath = `app/workspaces/${fileName}`;
  const destPath = resolve(projectRoot, relPath);

  const content = `import type { HudsonWorkspace } from '@hudson/sdk';
import { ${appVar}App } from '../apps/${appId}';

export const ${workspaceVar}: HudsonWorkspace = {
  id: '${appId}-dev',
  name: '${displayName}.dev',
  description: '${description}',
  mode: '${mode}',
  apps: [{ app: ${appVar}App }],
};
`;

  await mkdir(dirname(destPath), { recursive: true });
  await writeFile(destPath, content, 'utf-8');

  fileCreated(relPath);
  return relPath;
}
