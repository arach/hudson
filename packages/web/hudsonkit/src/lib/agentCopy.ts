// agentCopy — walk a DOM subtree and emit a markdown flattening suitable
// for pasting into a CLI, agent prompt, issue tracker, or chat thread.
//
// Same-document only: does not cross iframe or shadow DOM boundaries.
// Best-effort: handles standard semantic HTML; treats unknown wrappers as
// transparent; prunes any element matching `skipSelector` (default
// `[data-copy-skip]`).
//
// Per-call extension: pass `renderers` (selector → fn) to override the
// default behaviour for known subtrees. Renderers receive a `walk` callback
// so they can delegate sub-content back to the default walker.

export type AgentCopyRenderer = (node: Element, walk: (node: Element) => string) => string;

export interface AgentCopyOptions {
  /** CSS selector for subtrees to prune entirely. Default `[data-copy-skip]`. */
  skipSelector?: string;
  /** Per-call renderer map. First matching selector wins. */
  renderers?: Record<string, AgentCopyRenderer>;
}

const DEFAULT_SKIP_SELECTOR = '[data-copy-skip]';

export function agentCopy(node: Element, options: AgentCopyOptions = {}): string {
  const ctx: WalkContext = {
    skipSelector: options.skipSelector ?? DEFAULT_SKIP_SELECTOR,
    renderers: options.renderers,
  };
  return collapseBlankLines(walkBlock(node, ctx)).trim() + '\n';
}

export async function agentCopyToClipboard(
  node: Element,
  options?: AgentCopyOptions,
): Promise<void> {
  const text = agentCopy(node, options);
  await navigator.clipboard.writeText(text);
}

interface WalkContext {
  skipSelector: string;
  renderers?: Record<string, AgentCopyRenderer>;
}

function matchRenderer(node: Element, ctx: WalkContext): AgentCopyRenderer | null {
  if (!ctx.renderers) return null;
  for (const [selector, renderer] of Object.entries(ctx.renderers)) {
    if (node.matches(selector)) return renderer;
  }
  return null;
}

function walkBlock(node: Element, ctx: WalkContext): string {
  if (node.matches(ctx.skipSelector)) return '';
  const renderer = matchRenderer(node, ctx);
  if (renderer) return renderer(node, (n) => walkBlock(n, ctx));

  const tag = node.tagName.toLowerCase();
  switch (tag) {
    case 'h1': return `# ${walkInline(node, ctx)}\n\n`;
    case 'h2': return `## ${walkInline(node, ctx)}\n\n`;
    case 'h3': return `### ${walkInline(node, ctx)}\n\n`;
    case 'h4': return `#### ${walkInline(node, ctx)}\n\n`;
    case 'h5': return `##### ${walkInline(node, ctx)}\n\n`;
    case 'h6': return `###### ${walkInline(node, ctx)}\n\n`;
    case 'p': {
      const inline = walkInline(node, ctx).trim();
      return inline ? `${inline}\n\n` : '';
    }
    case 'ul': return walkList(node, ctx, false) + '\n';
    case 'ol': return walkList(node, ctx, true) + '\n';
    case 'pre': return walkPre(node) + '\n\n';
    case 'blockquote': return walkBlockquote(node, ctx) + '\n';
    case 'table': return walkTable(node, ctx) + '\n\n';
    case 'hr': return '---\n\n';
    case 'br': return '\n';
    case 'a':
    case 'code':
    case 'em':
    case 'strong':
    case 'i':
    case 'b':
    case 'span':
      return walkInline(node, ctx);
    case 'script':
    case 'style':
    case 'svg':
    case 'button':
    case 'noscript':
      return '';
    default:
      return walkBlockChildren(node, ctx);
  }
}

function walkBlockChildren(node: Element, ctx: WalkContext): string {
  let out = '';
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      out += walkBlock(child as Element, ctx);
    } else if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent ?? '').replace(/\s+/g, ' ');
      if (text.trim()) out += text;
    }
  }
  return out;
}

function walkInline(node: Element, ctx: WalkContext): string {
  if (node.matches(ctx.skipSelector)) return '';
  const renderer = matchRenderer(node, ctx);
  if (renderer) return renderer(node, (n) => walkBlock(n, ctx));

  let out = '';
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      if (el.matches(ctx.skipSelector)) continue;
      const inlineRenderer = matchRenderer(el, ctx);
      if (inlineRenderer) {
        out += inlineRenderer(el, (n) => walkBlock(n, ctx));
        continue;
      }
      switch (el.tagName.toLowerCase()) {
        case 'a': {
          const href = el.getAttribute('href') ?? '';
          const label = walkInline(el, ctx);
          out += href ? `[${label}](${href})` : label;
          break;
        }
        case 'code':
          out += `\`${el.textContent ?? ''}\``;
          break;
        case 'strong':
        case 'b':
          out += `**${walkInline(el, ctx)}**`;
          break;
        case 'em':
        case 'i':
          out += `*${walkInline(el, ctx)}*`;
          break;
        case 'br':
          out += '  \n';
          break;
        case 'script':
        case 'style':
        case 'svg':
        case 'button':
        case 'noscript':
          break;
        default:
          out += walkInline(el, ctx);
      }
    } else if (child.nodeType === Node.TEXT_NODE) {
      out += (child.textContent ?? '').replace(/\s+/g, ' ');
    }
  }
  return out;
}

function walkList(node: Element, ctx: WalkContext, ordered: boolean): string {
  let out = '';
  let index = 1;
  for (const child of Array.from(node.children)) {
    if (child.matches(ctx.skipSelector)) continue;
    if (child.tagName.toLowerCase() !== 'li') continue;
    const marker = ordered ? `${index}.` : '-';
    out += `${marker} ${walkInline(child, ctx).trim()}\n`;
    index++;
  }
  return out;
}

function walkPre(node: Element): string {
  const code = node.querySelector('code');
  const langMatch = code?.className.match(/language-(\S+)/);
  const lang = langMatch ? langMatch[1] : '';
  const text = ((code ?? node).textContent ?? '').replace(/\n+$/, '');
  return '```' + lang + '\n' + text + '\n```';
}

function walkBlockquote(node: Element, ctx: WalkContext): string {
  const inner = walkBlockChildren(node, ctx).trim();
  if (!inner) return '';
  return inner.split('\n').map((line) => (line ? `> ${line}` : '>')).join('\n') + '\n';
}

function walkTable(node: Element, ctx: WalkContext): string {
  const allRows = Array.from(
    node.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tr'),
  );
  const rows: string[][] = [];
  for (const tr of allRows) {
    if (tr.matches(ctx.skipSelector)) continue;
    const cells: string[] = [];
    for (const cell of Array.from(tr.children)) {
      if (cell.matches(ctx.skipSelector)) continue;
      const t = cell.tagName.toLowerCase();
      if (t !== 'td' && t !== 'th') continue;
      cells.push(walkInline(cell, ctx).trim());
    }
    if (cells.length) rows.push(cells);
  }
  if (rows.length === 0) return '';
  const header = rows[0];
  const body = rows.slice(1);
  const sep = header.map(() => '---');
  const fmt = (row: string[]) => '| ' + row.join(' | ') + ' |';
  return [fmt(header), fmt(sep), ...body.map(fmt)].join('\n');
}

function collapseBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n');
}
