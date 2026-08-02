// ---------------------------------------------------------------------------
// ANSI terminal output helpers — zero dependencies
// ---------------------------------------------------------------------------

const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;
const CYAN = `${ESC}36m`;
const GREEN = `${ESC}32m`;
const RED = `${ESC}31m`;
const YELLOW = `${ESC}33m`;
const GRAY = `${ESC}90m`;

export function bold(s: string) { return `${BOLD}${s}${RESET}`; }
export function dim(s: string) { return `${DIM}${s}${RESET}`; }
export function cyan(s: string) { return `${CYAN}${s}${RESET}`; }
export function green(s: string) { return `${GREEN}${s}${RESET}`; }
export function red(s: string) { return `${RED}${s}${RESET}`; }
export function yellow(s: string) { return `${YELLOW}${s}${RESET}`; }
export function gray(s: string) { return `${GRAY}${s}${RESET}`; }

export function header() {
  console.log();
  console.log(`  ${bold(cyan('create-hudson-app'))}  ${dim('v0.1.0')}`);
  console.log();
}

export function fileCreated(path: string) {
  console.log(`  ${green('+')} ${path}`);
}

export function summary(
  appId: string,
  fileCount: number,
  hasWorkspace: boolean,
  opts?: { standalone?: boolean },
) {
  console.log();
  console.log(`  ${green('Done!')} Created ${bold(appId)} with ${fileCount} files${hasWorkspace ? ' + workspace' : ''}.`);
  console.log();
  console.log(`  ${bold('Next steps:')}`);
  if (opts?.standalone) {
    console.log(`    1. ${cyan(`cd ${appId} && bun install`)}`);
    console.log(`    2. ${cyan('bun run check')}  ${dim('# typecheck && build')}`);
    console.log(`    3. ${cyan('bun run dev')}    ${dim('# http://127.0.0.1:5173')}`);
  } else {
    console.log(`    1. Import workspace in ${cyan('app/page.tsx')}`);
    console.log(`    2. ${cyan('bun dev')}`);
    console.log(`    3. Open ${cyan('http://localhost:3500')}`);
  }
  console.log();
}

export function error(msg: string) {
  console.error(`  ${red('Error:')} ${msg}`);
}

export function info(msg: string) {
  console.log(`  ${msg}`);
}
