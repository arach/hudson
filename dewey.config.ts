/** @type {import('@arach/dewey').DeweyConfig} */
export default {
  project: {
    name: 'hudson',
    tagline: 'Multi-app canvas workspace platform for React',
    type: 'react-library',
    version: '0.1.0',
  },

  agent: {
    criticalContext: [
      'Hudson uses bun as its package manager — never use npm or pnpm',
      'All UI components are custom-built — do not replace with library components',
      'Use @base-ui/react for context menu only, motion sparingly',
      'Every app must implement the HudsonApp interface from hudsonkit',
      'Apps do not manage shell chrome — the shell reads from app hooks and renders slots',
      'State is owned by each app Provider via React context',
      'NEVER use purple in designs — prefer cyan/blue/teal/emerald color ranges',
    ],

    entryPoints: {
      'shell': 'app/shell/',
      'apps': 'app/apps/',
      'workspaces': 'app/workspaces/',
      'sdk': 'packages/web/hudsonkit/src/',
      'types': 'packages/web/hudsonkit/src/types/',
    },

    rules: [
      { pattern: 'new app', instruction: 'See docs/building-apps.md and app/apps/shaper/ as reference' },
      { pattern: 'workspace', instruction: 'Check app/workspaces/ for workspace definitions' },
      { pattern: 'intent', instruction: 'See packages/web/hudsonkit/src/types/intent.ts and app/lib/intent-catalog.ts' },
      { pattern: 'component', instruction: 'Check packages/web/hudsonkit/src/components/ for chrome, canvas, windows, and overlays' },
      { pattern: 'styling', instruction: 'Uses Tailwind v4, design tokens in packages/web/hudsonkit/src/lib/theme.ts' },
    ],

    sections: ['overview', 'quickstart', 'building-apps', 'api', 'architecture', 'skill'],
  },

  docs: {
    path: './docs',
    output: './',
    required: ['overview', 'quickstart', 'building-apps', 'api', 'architecture', 'skill'],
  },

  install: {
    objective: 'Clone and run the Hudson development environment.',

    doneWhen: {
      command: 'curl -s http://localhost:3500 | head -1',
      expectedOutput: '<!DOCTYPE html>',
    },

    prerequisites: [
      'Node.js >= 18',
      'bun (https://bun.sh)',
      'git',
    ],

    steps: [
      { description: 'Clone the repository', command: 'git clone https://github.com/arach/hudson.git && cd hudson' },
      { description: 'Install dependencies', command: 'bun install' },
      { description: 'Start the dev server', command: 'bun dev' },
      { description: 'Open in browser', command: 'open http://localhost:3500' },
    ],
  },
}
