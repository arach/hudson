/** Host-mode protocol, panel header and board evidence check. No native launch. */
import { chromium, type Page } from 'playwright';
import { pathToFileURL } from 'node:url';
import type { createMockTransport } from './mock';
import type { UICommand } from './ui';
declare global { var editorMock: ReturnType<typeof createMockTransport>; }
const evidence = `${import.meta.dir}/design-evidence`;
const url = pathToFileURL(`${import.meta.dir}/dist-dev/index.html`).href + '?mock=1&host=1';
const browser = await chromium.launch({ executablePath: process.env.EDITOR_BROWSER_EXECUTABLE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true });
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
async function command(page: Page, value: UICommand) { await page.evaluate(c => editorMock.command(c), value); }
async function capture(page: Page, name: string) {
  await page.locator('[aria-label="Development mock controls"]').evaluate(el => { (el as HTMLElement).style.visibility='hidden'; });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path:`${evidence}/host-${name}.png` });
}
try {
  const page = await browser.newPage({ viewport:{width:1280,height:820}, reducedMotion:'reduce' });
  const errors: string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url); await page.getByRole('listbox').waitFor();
  assert(await page.locator('.editor-heading,.editor-status').count()===0,'Host must have no web page chrome');
  assert(!await page.locator('.hk-agent-workspace__peer-toolbar').isVisible(),'Host owns arrangement toolbar');
  assert(await page.locator('[data-panel-id=preview]').evaluate(el=>el.getBoundingClientRect().top)===0,'Panels begin at top');
  await page.waitForFunction(()=>editorMock.uiStates.length>0);
  assert(await page.locator('.preview-row').first().evaluate(el=>el.getBoundingClientRect().height)===34,'Rows 34px');
  assert(await page.locator('[data-panel-id=preview] .hk-agent-workspace__peer-panel-header').evaluate(el=>el.getBoundingClientRect().height)===36,'Headers 36px');
  await capture(page,'main-1280');
  const list = page.getByRole('listbox'); await list.focus(); await list.press('Home'); await list.press('ArrowDown'); await list.press('Space'); await list.press('ArrowDown'); await list.press('Control+Space');
  await page.getByText('2 selected',{exact:true}).waitFor();
  await command(page,{command:'toggleSource'});
  await page.waitForFunction(()=>document.querySelector('.cm-scroller')!.scrollTop>0);
  const code = await page.locator('.cm-editor').elementHandle();
  await capture(page,'context-source-1280');
  await command(page,{command:'togglePanel',value:'history'}); await command(page,{command:'arrangement',value:'grid'});
  await page.waitForFunction(()=> (editorMock.uiStates.at(-1) as {arrangement:string})?.arrangement==='grid');
  await capture(page,'expanded-1280');
  await page.getByRole('button',{name:'Clear',exact:true}).click();
  await page.getByRole('option',{name:'Synthetic Editor — Fixture document 1',exact:true}).click();
  assert(await page.locator('.source[data-ambiguous=true]').count()===1,'Duplicates marked amber');
  await capture(page,'states-ambiguous-1280');
  await page.evaluate(()=>editorMock.invalid()); await page.getByRole('alert').filter({hasText:'last consistent'}).waitFor();
  await capture(page,'states-stale-1280');
  await page.evaluate(()=>editorMock.recover()); await page.waitForFunction(()=>!document.querySelector('[role=alert]'));
  assert(await code!.evaluate(el=>el===document.querySelector('.cm-editor')),'CodeViewer stable across commands and recovery');
  const saved = await page.evaluate(()=>localStorage.getItem('lattices.editor.layout.v3:workspace-layers'));
  await page.setViewportSize({width:640,height:820});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
  const order = await page.locator('.hk-agent-workspace__peer-panel:visible').evaluateAll(es=>es.map(el=>({id:(el as HTMLElement).dataset.panelId,top:el.getBoundingClientRect().top,height:el.getBoundingClientRect().height})).sort((a,b)=>a.top-b.top));
  assert(order[0].id==='preview' && order[1].id==='chat' && order[2].id==='source','Narrow is Preview/context/Source');
  assert(order[0].height>=820*.62-1,'Preview has 62vh');
  assert(saved===await page.evaluate(()=>localStorage.getItem('lattices.editor.layout.v3:workspace-layers')),'Narrow preserves wide state');
  await capture(page,'narrow-640');
  const initialError = await browser.newPage({viewport:{width:1280,height:820}});
  await initialError.goto(url+'&unreadable=1'); await initialError.getByText("Can't read workspace layers",{exact:true}).waitFor();
  await capture(initialError,'states-unreadable-1280');
  await initialError.getByRole('button',{name:'Retry',exact:true}).click(); await initialError.evaluate(()=>editorMock.recover());
  await initialError.getByRole('listbox').waitFor();
  assert(errors.length===0,errors.join('\n')); await initialError.close();
  console.log('PASS host: no duplicate chrome, ui.command/ui.state, header counts, 34px rows, 36px headers, stable Source, states and narrow ordering');
  const sheet = await browser.newPage({viewport:{width:1600,height:1420}});
  await sheet.goto(pathToFileURL(`${evidence}/`).href);
  await sheet.setContent(`<body style="margin:0;background:#141416;color:#eee;font:16px system-ui;display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px">${['main-1280','expanded-1280','narrow-640','states-ambiguous-1280','states-stale-1280','states-unreadable-1280'].map(name=>`<section>${name}<img style="display:block;width:100%;height:420px;object-fit:contain;object-position:top left" src="${pathToFileURL(`${evidence}/host-${name}.png`).href}"></section>`).join('')}</body>`);
  await sheet.locator('img').evaluateAll(es=>Promise.all(es.map(el=>(el as HTMLImageElement).decode())));
  await sheet.screenshot({path:`${evidence}/host-boards-contact-sheet.png`,fullPage:true});
} finally { await browser.close(); }
