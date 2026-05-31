import type { StudioPage } from "studio";
import type { Bucket, Surface, Status } from "../registry";
import mtimes from "virtual:eng-mtimes";

const SPECS_FILES = import.meta.glob("../../../../specs/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const APPLE_FILES = import.meta.glob(
  "../../../../packages/native/apple/HudsonKit/Docs/*.md",
  { eager: true, query: "?raw", import: "default" },
) as Record<string, string>;

export type ProposalOrigin = "specs" | "apple";

export type ProposalKind = "proposal" | "brief" | "implementation-plan";

export type ProposalStatus = "live" | "active" | "draft" | "done" | "other";

export interface ProposalMeta {
  /** Free-form status string from the markdown header. */
  statusRaw?: string;
  /** Normalized status for the StatusPill. */
  status?: ProposalStatus;
  owner?: string;
  targets?: string;
  related?: string;
  /** Anything else key:value we found in the header block. */
  extra: { label: string; value: string }[];
}

export interface ProposalSibling {
  slug: string;
  id: string;
  kind: ProposalKind;
  title: string;
  href: string;
}

export interface Proposal {
  slug: string;
  id: string;
  /** Numeric part of the HUD id — sorts the catalog. */
  number: number;
  /** Sub-kind for `{full, brief, impl-plan}` siblings sharing a HUD number. */
  kind: ProposalKind;
  title: string;
  /** Body with H1 + meta lines + lifted headerSections removed. */
  body: string;
  /** H2 sections lifted into the header sheet (Summary / Intent / Overview). */
  headerSections: { label: string; body: string }[];
  meta: ProposalMeta;
  source: string;
  origin: ProposalOrigin;
  mtimeMs: number;
}

// ---------------------------------------------------------------------------
// Parsing helpers — Hudson-specific filename convention + generic markdown.
// The generic ones (parseMetaBlock, liftHeaderSections) are good promotion
// candidates for studio/doc; flagged upstream.
// ---------------------------------------------------------------------------

function parseHudId(filename: string): {
  id: string;
  number: number;
} | null {
  const m = filename.match(/^hud-?(\d+)-/i);
  if (!m) return null;
  return { id: `HUD-${m[1].padStart(3, "0")}`, number: parseInt(m[1], 10) };
}

function parseKind(filename: string): ProposalKind {
  if (/-brief$/i.test(filename)) return "brief";
  if (/-implementation-plan$/i.test(filename)) return "implementation-plan";
  return "proposal";
}

function kindLabel(kind: ProposalKind): string {
  return kind === "brief"
    ? "Brief"
    : kind === "implementation-plan"
      ? "Impl. plan"
      : "Proposal";
}

function extractTitle(body: string, fallback: string): string {
  const match = body.match(/^#\s+(.+?)$/m);
  if (!match) return fallback;
  return match[1].trim().replace(/^HUD-?\d+\s*[—:–-]\s*/i, "");
}

// `**Status**: Draft` and `Status: active draft` variants both appear in
// Hudson's HUD specs. Capture both. Returns parsed meta + indices of meta
// lines so the body can drop them.
function parseMetaBlock(lines: string[], h1Idx: number): {
  meta: ProposalMeta;
  metaLineIdx: number[];
} {
  const meta: ProposalMeta = { extra: [] };
  const metaLineIdx: number[] = [];
  for (let i = h1Idx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      metaLineIdx.push(i);
      continue;
    }
    if (line.startsWith("## ") || line.startsWith("# ")) break;
    const bold = line.match(/^\*\*([A-Z][^*]+)\*\*:\s+(.+)$/);
    if (bold) {
      assignMeta(meta, bold[1].trim(), bold[2].trim());
      metaLineIdx.push(i);
      continue;
    }
    const plain = line.match(/^([A-Z][A-Za-z ]{0,30}):\s+(.+)$/);
    if (plain) {
      assignMeta(meta, plain[1].trim(), plain[2].trim());
      metaLineIdx.push(i);
      continue;
    }
    break;
  }
  return { meta, metaLineIdx };
}

function assignMeta(meta: ProposalMeta, key: string, value: string) {
  const lk = key.toLowerCase();
  if (lk === "status") {
    meta.statusRaw = value;
    meta.status = normalizeStatus(value);
  } else if (lk === "owner" || lk === "owners") {
    meta.owner = value;
  } else if (lk === "targets" || lk === "target") {
    meta.targets = value;
  } else if (lk === "related" || lk === "see also") {
    meta.related = value;
  } else {
    meta.extra.push({ label: key, value });
  }
}

function normalizeStatus(raw: string): ProposalStatus {
  const head = raw.toLowerCase().trim();
  if (/^live\b/.test(head)) return "live";
  if (/^done\b|^shipped\b|^landed\b/.test(head)) return "done";
  if (/^active\b/.test(head)) return "active";
  if (/^draft\b/.test(head)) return "draft";
  return "other";
}

// Lift named H2 sections out of body so they can render in the header sheet.
// Same shape as openscout's splitOutHeaderSections — flagged upstream as a
// promotion candidate for studio/doc.
const LIFT_PATTERNS: { label: string; match: RegExp }[] = [
  { label: "Summary", match: /^(summary|intent|overview|tldr|tl;dr)\s*$/i },
];

function liftHeaderSections(input: string): {
  sections: { label: string; body: string }[];
  rest: string;
} {
  const headings: { start: number; bodyStart: number; text: string }[] = [];
  const re = /^##\s+(.+?)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) {
    const lineEnd = input.indexOf("\n", m.index);
    headings.push({
      start: m.index,
      bodyStart: lineEnd === -1 ? input.length : lineEnd + 1,
      text: m[1],
    });
  }
  const matched: { start: number; bodyStart: number; end: number; label: string }[] = [];
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    const next = headings[i + 1];
    const label = labelFor(h.text);
    if (!label) continue;
    matched.push({
      start: h.start,
      bodyStart: h.bodyStart,
      end: next ? next.start : input.length,
      label,
    });
  }
  if (matched.length === 0) return { sections: [], rest: input };
  let rest = "";
  let cursor = 0;
  for (const mm of matched) {
    rest += input.slice(cursor, mm.start);
    cursor = mm.end;
  }
  rest += input.slice(cursor);
  rest = rest.replace(/^\s*\n+/, "").replace(/\n{3,}/g, "\n\n");
  const sections = matched.map((mm) => ({
    label: mm.label,
    body: input.slice(mm.bodyStart, mm.end).trim(),
  }));
  return { sections, rest };
}

function labelFor(headingText: string): string | null {
  // Trim trailing colons so `## Summary:` matches `## Summary`. Studio
  // flagged this as the most common consumer footgun; matching their
  // forthcoming behavior so we don't need a second fix at swap time.
  const normalized = headingText.trim().replace(/:+$/, "");
  for (const p of LIFT_PATTERNS) {
    if (p.match.test(normalized)) return p.label;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

function loadProposals(): Proposal[] {
  const list: Proposal[] = [];
  const ingest = (
    filePath: string,
    body: string,
    origin: ProposalOrigin,
    sourcePrefix: string,
  ) => {
    const filename = (filePath.split("/").pop() ?? "").replace(/\.md$/, "");
    const parsed = parseHudId(filename);
    if (!parsed) return;

    const lines = body.split("\n");
    let h1Idx = -1;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      if (lines[i].startsWith("# ")) {
        h1Idx = i;
        break;
      }
    }

    const { meta, metaLineIdx } =
      h1Idx === -1
        ? { meta: { extra: [] } as ProposalMeta, metaLineIdx: [] }
        : parseMetaBlock(lines, h1Idx);

    const dropIdx = new Set([h1Idx, ...metaLineIdx]);
    const trimmed = lines
      .filter((_, i) => !dropIdx.has(i))
      .join("\n")
      .replace(/^\s*\n+/, "");

    const { sections, rest } = liftHeaderSections(trimmed);

    const source = `${sourcePrefix}${filename}.md`;
    list.push({
      slug: filename.toLowerCase(),
      id: parsed.id,
      number: parsed.number,
      kind: parseKind(filename),
      title: extractTitle(body, filename),
      body: rest,
      headerSections: sections,
      meta,
      source,
      origin,
      mtimeMs: mtimes[source] ?? 0,
    });
  };

  for (const [p, body] of Object.entries(SPECS_FILES)) {
    ingest(p, body, "specs", "specs/");
  }
  for (const [p, body] of Object.entries(APPLE_FILES)) {
    ingest(p, body, "apple", "packages/native/apple/HudsonKit/Docs/");
  }

  // Numeric by HUD-NNN, then proposal > brief > impl-plan, then slug.
  const kindOrder: Record<ProposalKind, number> = {
    proposal: 0,
    brief: 1,
    "implementation-plan": 2,
  };
  list.sort((a, b) => {
    if (a.number !== b.number) return a.number - b.number;
    if (a.kind !== b.kind) return kindOrder[a.kind] - kindOrder[b.kind];
    return a.slug.localeCompare(b.slug);
  });
  return list;
}

const PROPOSALS = loadProposals();
const BY_SLUG = new Map(PROPOSALS.map((p) => [p.slug, p]));

// ---------------------------------------------------------------------------
// Sibling detection — proposals sharing the same HUD-NNN number become a
// series (e.g. HUD-006 has full + brief + Live Surfaces variant).
// ---------------------------------------------------------------------------

function siblingsOf(proposal: Proposal): ProposalSibling[] {
  return PROPOSALS.filter(
    (p) => p.number === proposal.number && p.slug !== proposal.slug,
  ).map((p) => ({
    slug: p.slug,
    id: p.id,
    kind: p.kind,
    title: p.title,
    href: `/eng/${p.slug}`,
  }));
}

export function getProposalSiblings(slug: string): ProposalSibling[] {
  const proposal = BY_SLUG.get(slug);
  return proposal ? siblingsOf(proposal) : [];
}

// ---------------------------------------------------------------------------
// Related — parse `HUD-006 (...), HUD-008 (...), docs/foo.md` into linkable
// tokens. HUD refs resolve to the first sibling by sort order.
// ---------------------------------------------------------------------------

export interface RelatedToken {
  kind: "proposal-ref" | "doc-path" | "text";
  text: string;
  /** Set when `kind === 'proposal-ref'` and we resolved a target slug. */
  href?: string;
}

function findFirstProposalByNumber(number: number): Proposal | undefined {
  return PROPOSALS.find((p) => p.number === number);
}

export function parseRelated(raw: string | undefined): RelatedToken[] {
  if (!raw) return [];
  const out: RelatedToken[] = [];
  const tokens = raw.split(/\s*,\s*/);
  for (const token of tokens) {
    const hud = token.match(/^HUD-?(\d+)\b(.*)$/i);
    if (hud) {
      const number = parseInt(hud[1], 10);
      const target = findFirstProposalByNumber(number);
      out.push({
        kind: "proposal-ref",
        text: token,
        href: target ? `/eng/${target.slug}` : undefined,
      });
      continue;
    }
    if (/^`?docs?\//.test(token) || /\.md\b/.test(token)) {
      out.push({ kind: "doc-path", text: token });
      continue;
    }
    out.push({ kind: "text", text: token });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function listProposals(): Proposal[] {
  return PROPOSALS;
}

export function getProposal(slug: string): Proposal | undefined {
  return BY_SLUG.get(slug);
}

export function proposalKindLabel(kind: ProposalKind): string {
  return kindLabel(kind);
}

export function proposalsToStudioPages(): StudioPage<
  Bucket,
  Surface,
  Status
>[] {
  // Sidebar listing — full catalog, ordered by HUD number (then kind, then
  // slug). `PROPOSALS` is already sorted that way by `loadProposals()`.
  return PROPOSALS.map((p) => ({
    href: `/eng/${p.slug}`,
    label: `${p.id} · ${p.title}`,
    bucket: "proposals" as const,
    surface: "web" as const,
    status: "live" as const,
    blurb: p.origin === "apple" ? "iOS / macOS shell" : "Web shell",
    source: [p.source],
  }));
}
