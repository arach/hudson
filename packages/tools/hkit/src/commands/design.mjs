// hkit design - curated Hudson Design guidance for humans and agents.

import process from 'node:process';
import { AGENT_INTRO, DESIGN_PATTERNS, ROOT_TOKENS } from '../design-data.mjs';

const USAGE = `hkit design - Hudson Design briefs, tokens, and agent guidance

USAGE
  hkit design [intro] [--json]
  hkit design brief <pattern> [--target web|ios|macos|apple|native] [--json]
  hkit design patterns [--json]
  hkit design tokens [--group <name>] [--json]
  hkit design mappings [--target web|apple|native] [--json]
  hkit design check [--json]

COMMANDS
  intro       Print the agent-oriented Hudson Design introduction.
  brief       Print a pattern brief. Example: hkit design brief inspector-settings --target ios
  patterns    List available design pattern briefs.
  tokens      List root tokens and their platform mappings.
  mappings    List token mappings for one platform.
  check       Validate the curated design contract for unmapped or unresolved references.
`;

const TARGETS = new Set(['web', 'ios', 'macos', 'apple', 'native']);

function parse(argv) {
  const args = {
    cmd: argv[0] ?? 'intro',
    rest: [],
    target: undefined,
    group: undefined,
    json: false,
    help: false,
  };

  if (args.cmd === '--help' || args.cmd === '-h') {
    args.cmd = 'intro';
    args.help = true;
    return args;
  }

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { args.help = true; continue; }
    if (a === '--json') { args.json = true; continue; }
    if (a === '--target') { args.target = normalizeTarget(argv[++i]); continue; }
    if (a.startsWith('--target=')) { args.target = normalizeTarget(a.slice('--target='.length)); continue; }
    if (a === '--group') { args.group = argv[++i]; continue; }
    if (a.startsWith('--group=')) { args.group = a.slice('--group='.length); continue; }
    if (a.startsWith('-')) { args._err = `unknown argument: ${a}`; continue; }
    args.rest.push(a);
  }

  return args;
}

function normalizeTarget(value) {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower === 'native') return 'apple';
  if (lower === 'ios' || lower === 'macos') return lower;
  if (lower === 'apple' || lower === 'web') return lower;
  return value;
}

function asPlatform(target) {
  if (target === 'ios' || target === 'macos' || target === 'apple') return 'apple';
  return 'web';
}

function paint(color, text, enabled) {
  if (!enabled) return text;
  const codes = { red: 31, yellow: 33, green: 32, dim: 2, bold: 1, cyan: 36 };
  return `\x1b[${codes[color]}m${text}\x1b[0m`;
}

function bullet(lines, prefix = '  - ') {
  return lines.map(line => `${prefix}${line}`).join('\n');
}

function renderIntro(color) {
  const lines = [
    paint('bold', AGENT_INTRO.title, color),
    AGENT_INTRO.summary,
    '',
    paint('bold', 'Principles', color),
    bullet(AGENT_INTRO.principles),
    '',
    paint('bold', 'Agent Workflow', color),
    bullet(AGENT_INTRO.workflow),
    '',
    paint('bold', 'Useful Commands', color),
    '  hkit design patterns',
    '  hkit design brief inspector-settings --target ios',
    '  hkit design tokens --group surface',
    '  hkit design check',
  ];
  return lines.join('\n') + '\n';
}

function renderPatterns(color) {
  const lines = [paint('bold', 'Hudson Design Patterns', color), ''];
  for (const [id, pattern] of Object.entries(DESIGN_PATTERNS)) {
    lines.push(`${paint('cyan', id, color)}  ${pattern.title}`);
    lines.push(`  ${pattern.summary}`);
  }
  return lines.join('\n') + '\n';
}

function renderBrief(id, target, color) {
  const pattern = DESIGN_PATTERNS[id];
  if (!pattern) {
    const known = Object.keys(DESIGN_PATTERNS).join(', ');
    throw new Error(`unknown design pattern "${id}". Known patterns: ${known}`);
  }

  const requestedTarget = target ?? 'web';
  if (!TARGETS.has(requestedTarget)) {
    throw new Error(`unknown target "${requestedTarget}". Use web, ios, macos, apple, or native.`);
  }
  const platform = asPlatform(requestedTarget);
  const targetLabel = requestedTarget === 'ios' || requestedTarget === 'macos'
    ? `${requestedTarget} (Apple)`
    : requestedTarget;

  const tokenLines = pattern.tokens.map(tokenId => {
    const token = ROOT_TOKENS.find(t => t.id === tokenId);
    const mapped = token?.[platform]?.join(', ') ?? 'unmapped';
    return `${tokenId} -> ${mapped}`;
  });

  const platformNotes = platform === 'apple'
    ? [
        'Read colors and runtime theme through @Environment(\\.hudTheme) when a primitive participates in runtime theming.',
        'Use HudSpacing, HudLayout, HudFont, HudTextSize, and HudOpacity for dimensional/static tokens.',
        'Keep SwiftUI behavior native; the root token name is the design language, not the implementation API.',
      ]
    : [
        'Read colors through CSS custom properties such as var(--hud-bg) and var(--hud-ink).',
        'Use ThemeProvider plus data-hudson-theme and data-hudson-template for runtime theme selection.',
        'Keep React components in Hudson app slots; shell chrome remains owned by the shell.',
      ];

  const lines = [
    `${paint('bold', pattern.title, color)} ${paint('dim', `(${id}, target: ${targetLabel})`, color)}`,
    pattern.summary,
    '',
    paint('bold', 'Use When', color),
    bullet(pattern.useWhen),
    '',
    paint('bold', 'Root Tokens', color),
    bullet(tokenLines),
    '',
    paint('bold', 'Rules', color),
    bullet(pattern.rules),
    '',
    paint('bold', 'Platform Notes', color),
    bullet(platformNotes),
    '',
    paint('bold', 'Anti-patterns', color),
    bullet(pattern.antiPatterns),
    '',
    paint('bold', 'Acceptance Checklist', color),
    bullet(pattern.acceptance),
  ];
  return lines.join('\n') + '\n';
}

function filterTokens(group) {
  return group ? ROOT_TOKENS.filter(t => t.group === group) : ROOT_TOKENS;
}

function renderTokens(group, color) {
  const tokens = filterTokens(group);
  if (group && tokens.length === 0) {
    const groups = [...new Set(ROOT_TOKENS.map(t => t.group))].join(', ');
    throw new Error(`unknown token group "${group}". Known groups: ${groups}`);
  }

  const lines = [paint('bold', group ? `Hudson Root Tokens: ${group}` : 'Hudson Root Tokens', color), ''];
  for (const token of tokens) {
    lines.push(`${paint('cyan', token.id, color)}  ${token.label}`);
    lines.push(`  web:   ${token.web.join(', ')}`);
    lines.push(`  apple: ${token.apple.join(', ')}`);
    lines.push(`  ${paint('dim', token.guidance, color)}`);
  }
  return lines.join('\n') + '\n';
}

function renderMappings(target, color) {
  const normalized = normalizeTarget(target ?? 'web');
  if (!TARGETS.has(normalized)) {
    throw new Error(`unknown target "${target}". Use web, apple, ios, macos, or native.`);
  }
  const platform = asPlatform(normalized);
  const lines = [paint('bold', `Hudson Design Mappings: ${normalized}`, color), ''];
  for (const token of ROOT_TOKENS) {
    lines.push(`${token.id.padEnd(22)} ${token[platform].join(', ')}`);
  }
  return lines.join('\n') + '\n';
}

function checkContract() {
  const findings = [];
  const tokenIds = new Set(ROOT_TOKENS.map(t => t.id));

  for (const token of ROOT_TOKENS) {
    if (!token.web?.length) findings.push({ severity: 'error', id: token.id, detail: 'missing web mapping' });
    if (!token.apple?.length) findings.push({ severity: 'error', id: token.id, detail: 'missing apple mapping' });
    if (!token.group) findings.push({ severity: 'error', id: token.id, detail: 'missing token group' });
  }

  for (const [patternId, pattern] of Object.entries(DESIGN_PATTERNS)) {
    for (const tokenId of pattern.tokens) {
      if (!tokenIds.has(tokenId)) {
        findings.push({
          severity: 'error',
          id: patternId,
          detail: `pattern references unknown token ${tokenId}`,
        });
      }
    }
  }

  return findings;
}

function renderCheck(color) {
  const findings = checkContract();
  if (findings.length === 0) {
    return `${paint('green', '[ok]', color)} Hudson Design contract is internally consistent.\n`;
  }

  const lines = [paint('red', `[${findings.length} finding${findings.length === 1 ? '' : 's'}]`, color)];
  for (const finding of findings) {
    lines.push(`  ${finding.severity.toUpperCase()} ${finding.id}: ${finding.detail}`);
  }
  return lines.join('\n') + '\n';
}

export async function run(argv) {
  const args = parse(argv);
  const color = process.stdout.isTTY;

  if (args.help) {
    process.stdout.write(USAGE);
    return;
  }
  if (args._err) {
    process.stderr.write(`design: ${args._err}\n\n${USAGE}`);
    process.exit(2);
  }

  try {
    if (args.json) {
      if (args.cmd === 'intro') process.stdout.write(JSON.stringify(AGENT_INTRO, null, 2) + '\n');
      else if (args.cmd === 'patterns') process.stdout.write(JSON.stringify(DESIGN_PATTERNS, null, 2) + '\n');
      else if (args.cmd === 'brief') {
        const id = args.rest[0];
        if (!id) throw new Error('brief requires a pattern id');
        const pattern = DESIGN_PATTERNS[id];
        if (!pattern) throw new Error(`unknown design pattern "${id}"`);
        process.stdout.write(JSON.stringify({ id, target: args.target ?? 'web', ...pattern }, null, 2) + '\n');
      } else if (args.cmd === 'tokens') process.stdout.write(JSON.stringify(filterTokens(args.group), null, 2) + '\n');
      else if (args.cmd === 'mappings') {
        const platform = asPlatform(normalizeTarget(args.target ?? 'web'));
        process.stdout.write(JSON.stringify(ROOT_TOKENS.map(t => ({ id: t.id, mapping: t[platform] })), null, 2) + '\n');
      } else if (args.cmd === 'check') {
        const findings = checkContract();
        process.stdout.write(JSON.stringify({ ok: findings.length === 0, findings }, null, 2) + '\n');
        if (findings.some(f => f.severity === 'error')) process.exit(1);
      } else {
        throw new Error(`unknown design command "${args.cmd}"`);
      }
      return;
    }

    if (args.cmd === 'intro') process.stdout.write(renderIntro(color));
    else if (args.cmd === 'patterns') process.stdout.write(renderPatterns(color));
    else if (args.cmd === 'brief') {
      const id = args.rest[0];
      if (!id) throw new Error('brief requires a pattern id');
      process.stdout.write(renderBrief(id, args.target, color));
    } else if (args.cmd === 'tokens') process.stdout.write(renderTokens(args.group, color));
    else if (args.cmd === 'mappings') process.stdout.write(renderMappings(args.target, color));
    else if (args.cmd === 'check') {
      const findings = checkContract();
      process.stdout.write(renderCheck(color));
      if (findings.some(f => f.severity === 'error')) process.exit(1);
    } else {
      throw new Error(`unknown design command "${args.cmd}"`);
    }
  } catch (err) {
    process.stderr.write(`design: ${err?.message ?? err}\n\n${USAGE}`);
    process.exit(2);
  }
}
