import { describe, expect, it } from 'vitest';
import { agentCopy } from '../src/lib/agentCopy';

function el(html: string): Element {
  const root = document.createElement('div');
  root.innerHTML = html.trim();
  return root;
}

describe('agentCopy', () => {
  it('emits headings h1–h6 with matching markdown hashes', () => {
    const out = agentCopy(el('<h1>One</h1><h2>Two</h2><h3>Three</h3><h6>Six</h6>'));
    expect(out).toBe('# One\n\n## Two\n\n### Three\n\n###### Six\n');
  });

  it('emits paragraphs separated by a blank line', () => {
    const out = agentCopy(el('<p>First.</p><p>Second.</p>'));
    expect(out).toBe('First.\n\nSecond.\n');
  });

  it('emits unordered and ordered lists', () => {
    const ul = agentCopy(el('<ul><li>a</li><li>b</li></ul>'));
    expect(ul).toBe('- a\n- b\n');
    const ol = agentCopy(el('<ol><li>one</li><li>two</li></ol>'));
    expect(ol).toBe('1. one\n2. two\n');
  });

  it('emits fenced code blocks with the language class', () => {
    const out = agentCopy(
      el('<pre><code class="language-ts">const x = 1;</code></pre>'),
    );
    expect(out).toBe('```ts\nconst x = 1;\n```\n');
  });

  it('emits links as [label](href)', () => {
    const out = agentCopy(el('<p>see <a href="https://x.dev">docs</a>.</p>'));
    expect(out).toBe('see [docs](https://x.dev).\n');
  });

  it('emits a markdown table with header + separator + body rows', () => {
    const out = agentCopy(
      el(
        '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
      ),
    );
    expect(out).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |\n');
  });

  it('prunes subtrees matching [data-copy-skip]', () => {
    const out = agentCopy(
      el('<div><p>keep</p><div data-copy-skip><p>drop</p></div></div>'),
    );
    expect(out).toBe('keep\n');
  });

  it('honours an app-provided renderer for matching selectors', () => {
    const out = agentCopy(el('<div><div data-row data-id="42">x</div></div>'), {
      renderers: {
        '[data-row]': (node) => `ROW:${(node as HTMLElement).dataset.id}\n`,
      },
    });
    expect(out).toBe('ROW:42\n');
  });

  it('passes a walk callback to renderers for sub-content delegation', () => {
    const out = agentCopy(
      el(
        '<div><div data-card><h2>title</h2><p>body</p></div></div>',
      ),
      {
        renderers: {
          '[data-card]': (node, walk) => {
            const body = node.querySelector('p')!;
            return `CARD\n${walk(body)}`;
          },
        },
      },
    );
    expect(out).toBe('CARD\nbody\n');
  });

  it('treats unknown wrappers transparently', () => {
    const out = agentCopy(
      el('<div><section><article><p>hi</p></article></section></div>'),
    );
    expect(out).toBe('hi\n');
  });

  it('skips script, style, and svg subtrees', () => {
    const out = agentCopy(
      el(
        '<div><p>before</p><script>x</script><style>y</style><svg><path/></svg><p>after</p></div>',
      ),
    );
    expect(out).toBe('before\n\nafter\n');
  });

  it('honours a custom skipSelector override', () => {
    const out = agentCopy(el('<div><p>keep</p><p class="hide">drop</p></div>'), {
      skipSelector: '.hide',
    });
    expect(out).toBe('keep\n');
  });
});
