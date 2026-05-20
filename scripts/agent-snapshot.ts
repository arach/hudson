#!/usr/bin/env bun
/**
 * Hudson agent snapshot.
 *
 * Reads app/apps/*\/index.ts and extracts the HudsonApp metadata each app
 * declares: id, name, description, ports (inputs/outputs), intent count.
 * Emits a markdown summary suitable for Hudson (the agent) to read at the
 * top of a session before deciding how to handle a cross-app commission.
 *
 * Usage:
 *   bun scripts/agent-snapshot.ts          # prints to stdout
 *   bun scripts/agent-snapshot.ts --md     # forces markdown (default)
 *
 * Why grep-based, not TypeScript-import-based:
 *   The apps pull in React, Lucide icons, hudsonkit runtime, and various
 *   client-only modules. Running them outside Next would require a build
 *   harness. The metadata fields we care about (id/name/description/ports)
 *   are conventional literals — regex extraction is reliable enough for a
 *   snapshot tool and adds zero runtime dependencies.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const APPS_DIR = join(import.meta.dir, '..', 'app', 'apps');

interface PortDecl {
  id: string;
  name: string;
  dataType: string;
  description: string;
}

interface AppSnapshot {
  dir: string;
  id?: string;
  name?: string;
  description?: string;
  mode?: string;
  outputs: PortDecl[];
  inputs: PortDecl[];
  intentCount: number;
  intentCommandIds: string[];
  hasBackend: boolean;
  hasIntentsFile: boolean;
  hasPortsFile: boolean;
}

function extractLiteralString(src: string, key: string): string | undefined {
  const re = new RegExp(`\\b${key}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`);
  const m = src.match(re);
  return m?.[1];
}

function extractPortArray(src: string, kind: 'inputs' | 'outputs'): PortDecl[] {
  // Match `outputs: [ ... ]` or `inputs: [ ... ]` inside a ports block.
  // Non-greedy across the array, paired-bracket tolerant for a single level.
  const re = new RegExp(`${kind}\\s*:\\s*\\[([^\\]]*?)\\]`, 's');
  const arrMatch = src.match(re);
  if (!arrMatch) return [];
  const arr = arrMatch[1];
  const ports: PortDecl[] = [];
  // Each entry: { id: '...', name: '...', dataType: '...', description: '...' }
  const entryRe = /\{[^}]*\}/g;
  for (const entry of arr.match(entryRe) ?? []) {
    const id = extractLiteralString(entry, 'id');
    const name = extractLiteralString(entry, 'name');
    const dataType = extractLiteralString(entry, 'dataType');
    const description = extractLiteralString(entry, 'description');
    if (id && name) {
      ports.push({ id, name, dataType: dataType ?? '?', description: description ?? '' });
    }
  }
  return ports;
}

function extractIntents(intentsSrc: string): { count: number; commandIds: string[] } {
  const commandIdMatches = [...intentsSrc.matchAll(/commandId\s*:\s*['"`]([^'"`]+)['"`]/g)];
  return {
    count: commandIdMatches.length,
    commandIds: commandIdMatches.map((m) => m[1]),
  };
}

function readApp(appDir: string): AppSnapshot | null {
  const indexPath = join(APPS_DIR, appDir, 'index.ts');
  if (!existsSync(indexPath)) return null;
  const src = readFileSync(indexPath, 'utf-8');

  const intentsPath = join(APPS_DIR, appDir, 'intents.ts');
  const portsPath = join(APPS_DIR, appDir, 'ports.ts');
  const hasIntentsFile = existsSync(intentsPath);
  const hasPortsFile = existsSync(portsPath);

  let intentCount = 0;
  let intentCommandIds: string[] = [];
  if (hasIntentsFile) {
    const intentsSrc = readFileSync(intentsPath, 'utf-8');
    const i = extractIntents(intentsSrc);
    intentCount = i.count;
    intentCommandIds = i.commandIds;
  }

  return {
    dir: appDir,
    id: extractLiteralString(src, 'id'),
    name: extractLiteralString(src, 'name'),
    description: extractLiteralString(src, 'description'),
    mode: extractLiteralString(src, 'mode'),
    outputs: extractPortArray(src, 'outputs'),
    inputs: extractPortArray(src, 'inputs'),
    intentCount,
    intentCommandIds,
    hasBackend: /backend\s*:\s*\{/.test(src),
    hasIntentsFile,
    hasPortsFile,
  };
}

function md(snaps: AppSnapshot[]): string {
  const lines: string[] = [];
  const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
  lines.push('# Hudson app snapshot');
  lines.push(`generated: ${ts}  ·  apps: ${snaps.length}`);
  lines.push('');
  lines.push('| app id | dir | mode | outputs → consumers | inputs ← producers | intents | backend |');
  lines.push('|--------|-----|------|---------------------|--------------------|---------|---------|');
  for (const s of snaps) {
    lines.push(
      `| \`${s.id ?? '?'}\` | \`${s.dir}\` | ${s.mode ?? '?'} | ${s.outputs.length} | ${s.inputs.length} | ${s.intentCount} | ${s.hasBackend ? '✓' : '·'} |`,
    );
  }
  lines.push('');

  // Detail per app
  for (const s of snaps) {
    lines.push(`## \`${s.id ?? s.dir}\` · ${s.name ?? ''}`);
    if (s.description) lines.push(`> ${s.description}`);
    lines.push('');
    if (s.outputs.length) {
      lines.push('**Outputs** (data this app produces for others to read):');
      for (const p of s.outputs) {
        lines.push(`- \`${p.id}\` (${p.dataType}) — ${p.description}`);
      }
      lines.push('');
    }
    if (s.inputs.length) {
      lines.push('**Inputs** (data this app consumes from others):');
      for (const p of s.inputs) {
        lines.push(`- \`${p.id}\` (${p.dataType}) — ${p.description}`);
      }
      lines.push('');
    }
    if (s.intentCount > 0) {
      lines.push('**Intents** (commands other agents/apps can ask this app to perform):');
      for (const id of s.intentCommandIds) lines.push(`- \`${id}\``);
      lines.push('');
    }
  }

  // Pipeline edges — derive output→input matches
  lines.push('## Inter-app pipelines (output → input by `dataType`)');
  lines.push('');
  lines.push('Edges where one app produces a dataType another consumes. Useful for multi-app workflow orchestration.');
  lines.push('');
  const edges: { from: string; out: PortDecl; to: string; in: PortDecl }[] = [];
  for (const a of snaps) {
    for (const out of a.outputs) {
      for (const b of snaps) {
        if (b.id === a.id) continue;
        for (const inp of b.inputs) {
          if (inp.dataType === out.dataType) {
            edges.push({ from: a.id ?? a.dir, out, to: b.id ?? b.dir, in: inp });
          }
        }
      }
    }
  }
  if (edges.length === 0) {
    lines.push('*(no matching edges)*');
  } else {
    for (const e of edges) {
      lines.push(`- \`${e.from}\`/${e.out.id} (${e.out.dataType}) → \`${e.to}\`/${e.in.id}`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

const dirs = readdirSync(APPS_DIR).filter((d) => {
  const p = join(APPS_DIR, d);
  return statSync(p).isDirectory() && !d.startsWith('.') && !d.startsWith('_');
});

const snaps: AppSnapshot[] = [];
for (const d of dirs.sort()) {
  const s = readApp(d);
  if (s && s.id) snaps.push(s);
}

console.log(md(snaps));
