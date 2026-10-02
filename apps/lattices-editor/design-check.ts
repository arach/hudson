/** Headless UI regression and committed evidence capture; never launches Lattices.
 * bun apps/lattices-editor/build.ts --dev && bun apps/lattices-editor/design-check.ts
 * Set EDITOR_BROWSER_EXECUTABLE or install Playwright Chromium on other machines.
 */
import { chromium, type Page } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const evidence = `${import.meta.dir}/design-evidence`;
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.EDITOR_BROWSER_EXECUTABLE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const url = pathToFileURL(`${import.meta.dir}/dist-dev/index.html`).href + '?mock=1';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function capture(page: Page, name: string, width: number) {
  // Hide only the labelled development controls, never production UI.
  await page.locator('[aria-label="Development mock controls"]').evaluate(el => (el as HTMLElement).style.visibility = 'hidden');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ animations: 'disabled', path: `${evidence}/${name}-${width}.png` });
  await page.locator('[aria-label="Development mock controls"]').evaluate(el => (el as HTMLElement).style.visibility = 'visible');
}
try {
  for (const width of [1280, 640]) {
    const page = await browser.newPage({ viewport: { width, height: 820 }, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('[aria-label="Development mock controls"]').evaluate(el => { (el as HTMLElement).style.bottom = "32px"; });
    const list = page.getByRole('listbox', { name:'Windows' });
    await page.getByRole('option', { name:'Synthetic Editor — Fixture document 1' }).waitFor();
    assert(await page.getByText('Scout · no windows', { exact:true }).textContent() === 'Scout · no windows', 'Empty groups must be one line');
    assert(await page.locator('.preview-group').last().getAttribute('aria-label') === 'Unassigned', 'Unassigned must be last');
    assert(await page.locator('.preview-row').first().evaluate(el => el.getBoundingClientRect().height) === 30, 'Dense rows are 30px');
    assert(await page.locator('.hk-agent-workspace__panel-actions:visible').count() === 0, 'Panel Actions should be hidden');
    assert(await page.locator('.hk-agent-workspace__arrangement-button').first().evaluate(el => el.getBoundingClientRect().height) === 32, 'Peer controls are 32px');
    assert(await page.getByRole('option').evaluateAll(elements => elements.every(el => (el as HTMLElement).tabIndex === -1)), 'Rows are not individual tab stops');
    if (width === 640) {
      const chatBottom = await page.locator('[data-panel-id="chat"]').evaluate(el => el.getBoundingClientRect().bottom);
      assert(Math.abs(chatBottom - 792) < 2, 'Initial narrow stack fills available height');
    }
    assert(await page.locator('[data-frame-panel="status-bar"]').evaluate(el => el.getBoundingClientRect().height) === 28, 'Status bar is 28px');
    assert(await page.getByRole('button', { name:'Send message', includeHidden: true }).isDisabled(), 'Send remains disabled');
    assert(await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--accent').trim().split(/\s+/).map(Number).join(' ')) === '0.72 0.18 162', 'Hudson emerald token inherited');
    assert(await page.locator('textarea').isDisabled(), 'Composer input stays disabled');
    await capture(page, 'initial', width);
    await list.focus(); await list.press('Home'); await list.press('ArrowDown'); await list.press('Space');
    await page.getByRole('button', { name:'Remove Ghostty — Build logs 1', exact:true }).waitFor();
    await list.press('Control+Space');
    assert(await page.locator('[data-hk-context-item]').count() === 0, 'Additive keyboard toggle deselects');
    await list.press('Space'); await list.press('ArrowDown'); await list.press('Enter');
    assert(await page.locator('[data-hk-context-item]').count() === 1, 'Enter replaces selection');
    await list.press('ArrowUp'); await list.press('Control+Space');
    assert(await page.locator('[data-hk-context-item]').count() === 2, 'Keyboard can select two rows');
    await page.getByRole('button', { name:'Inspect Source', exact:true }).click();
    await page.waitForFunction(() => (document.querySelector('.cm-scroller')?.scrollTop ?? 0) > 0);
    const sourceNode = await page.locator('.cm-editor').elementHandle();
    if (width === 640) await page.locator('[data-panel-id="chat"]').scrollIntoViewIfNeeded();
    await capture(page, 'two-selected', width);
    await page.getByRole('button', { name:'Remove Ghostty — Build logs 1', exact:true }).click();
    assert(await page.locator('[data-hk-context-item]').count() === 1, 'Removing one chip deselects one row');
    assert(await page.getByRole('option', { name:'Ghostty — Build logs 1', exact:true }).getAttribute('aria-selected') === 'false', 'Removed row is deselected');
    await page.getByRole('button', { name:'Clear', exact:true }).click();
    await page.getByRole('option', { name:'Synthetic Editor — Fixture document 1' }).click();
    await page.getByText('Matches 2 entries in Source (duplicates)', { exact:true }).waitFor();
    assert(await page.locator('.hk-code-selection').count() >= 2, 'All duplicate ranges highlighted');
    if (width === 640) await page.locator('[data-panel-id="chat"]').scrollIntoViewIfNeeded();
    await capture(page, 'ambiguous', width);

    // Source selection must call nearest scrolling on the corresponding Preview row.
    await page.evaluate(() => {
      const original = Element.prototype.scrollIntoView;
      (globalThis as unknown as { editorScrollCalls: string[] }).editorScrollCalls = [];
      Element.prototype.scrollIntoView = function(options) {
        (globalThis as unknown as { editorScrollCalls: string[] }).editorScrollCalls.push(this.id);
        original.call(this, options);
      };
    });
    await page.getByRole('button', { name:'Clear', exact:true }).click();
    await page.locator('.cm-line').filter({ hasText:'"Synthetic Editor 🚀"' }).first().click();
    await page.waitForFunction(() => (globalThis as unknown as { editorScrollCalls: string[] }).editorScrollCalls.some(id => id.startsWith('preview-row-')));
    await page.getByRole('option', { name:'Synthetic Editor — Fixture document 1', selected:true }).waitFor();

    await page.getByRole('button', { name:'Expanded layout', exact:true }).click();
    await page.locator('.hk-agent-workspace__peer-body').evaluate(el => { el.scrollTop = 0; });
    await page.waitForFunction(() => {
      const scroller = document.querySelector('.cm-scroller')!;
      const viewport = scroller.getBoundingClientRect();
      return scroller.scrollTop > 0 && Array.from(document.querySelectorAll('.hk-code-selection')).some(el => {
        const range = el.getBoundingClientRect();
        return range.top >= viewport.top && range.bottom <= viewport.bottom;
      });
    });
    await capture(page, 'expanded', width);
    await page.getByRole('button', { name:'Change', exact:true }).click();
    await page.getByText('Build 2', { exact:true }).waitFor();
    await page.getByRole('button', { name:'Change', exact:true }).click();
    await page.getByText('Build 3', { exact:true }).waitFor();
    assert(await page.locator('.history li').count() === 2, 'History has two entries');
    assert(await sourceNode!.evaluate(node => node === document.querySelector('.cm-editor')), 'CodeMirror must not remount');
    if (width === 640) await page.locator('[data-panel-id="history"]').scrollIntoViewIfNeeded();
    await capture(page, 'history-two-entries', width);

    const saved = await page.evaluate(() => localStorage.getItem('lattices.editor.layout.v3:workspace-layers'));
    await page.setViewportSize({ width:640, height:820 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.locator('.hk-agent-workspace__peer-body').evaluate(el => { el.scrollTop = 0; });
    const positions = await page.locator('.hk-agent-workspace__peer-panel:visible').evaluateAll(elements =>
      elements.map(el => ({ id:(el as HTMLElement).dataset.panelId!, top:el.getBoundingClientRect().top, height:el.getBoundingClientRect().height })).sort((a,b) => a.top-b.top));
    assert(positions[0].id === 'preview' && positions[1].id === 'chat', 'Narrow order is Preview then Chat');
    assert(positions[0].height >= 820 * .6, 'Narrow Preview takes at least 60vh');
    assert(!await page.locator('.hk-agent-composer__input').isVisible(), 'Narrow Chat is chips-only');
    assert(saved === await page.evaluate(() => localStorage.getItem('lattices.editor.layout.v3:workspace-layers')), 'Narrow layout never overwrites wide state');
    await capture(page, width === 640 ? 'narrow' : 'narrow-from-wide', 640);
    assert(errors.length === 0, errors.join('\n'));
    console.log(`PASS ${width}: chips, empty groups, ordering, keyboard, both scroll directions, stable editor, History, narrow layout`);
    await page.close();
  }
} finally { await browser.close(); }
