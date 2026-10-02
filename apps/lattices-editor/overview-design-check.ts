import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import type { createMockTransport } from './mock';
declare global { var editorMock: ReturnType<typeof createMockTransport>; }
const browser=await chromium.launch({executablePath:process.env.EDITOR_BROWSER_EXECUTABLE??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const url=pathToFileURL(`${import.meta.dir}/dist-dev/index.html`).href+'?mock=1&host=1&overviewfixture=1';
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m);};
try {
 for(const width of [1280,560]) {
  const page=await browser.newPage({viewport:{width,height:820},reducedMotion:'reduce'});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.locator('.layer-reading h1').waitFor();await page.evaluate(()=>document.fonts.ready);
  await page.locator('[aria-label="Development mock controls"]').evaluate(el=>(el as HTMLElement).style.visibility='hidden');
  assert(await page.locator('.editor-root').getAttribute('data-view')==='overview','Overview default');
  assert(await page.locator('.layer-index nav button').count()===8,'Real fixture has eight layers');
  assert(!await page.locator('.workspace-view').isVisible(),'Workspace hidden without unmounting');
  const editor=await page.locator('.cm-editor').elementHandle();
  assert(await page.locator('.layer-picker').isVisible()===(width===560),'Narrow picker replaces index');
  assert(await page.locator('.matched-by').isVisible()===(width===1280),'Narrow hides match details');
  await page.screenshot({path:`${import.meta.dir}/design-evidence/overview-${width}.png`});
  await page.getByRole('button',{name:'+ Preview',exact:true}).click();await page.getByRole('listbox').waitFor();
  assert(await page.locator('.editor-root').getAttribute('data-view')==='workspace','Add Preview opens Workspace');
  assert(await editor!.evaluate(el=>el===document.querySelector('.cm-editor')),'Workspace retains CodeViewer across views');
  const clear=page.locator('.clear-selection');
  assert(await clear.evaluate(el=>['Top','Right','Bottom','Left'].every(side=>getComputedStyle(el).getPropertyValue('border-'+side.toLowerCase()+'-width')==='0px')),'Clear has no border');
  assert(await clear.evaluate(el=>getComputedStyle(el).outlineStyle==='none'),'Clear has no pointer-focus outline');
  await page.keyboard.press('Tab'); await clear.focus();
  assert(await clear.evaluate(el=>el.matches(':focus-visible') && getComputedStyle(el).outlineStyle!=='none'),'Clear retains keyboard focus ring');
  await clear.evaluate(el=>(el as HTMLElement).blur());
  assert(await page.locator('.preview-group').evaluateAll(groups=>groups.every(group=>{
    const style=getComputedStyle(group.firstElementChild!, '::before');
    return group.querySelectorAll('[role=option]').length ? style.backgroundColor==='rgb(51, 199, 115)' : style.backgroundColor==='rgba(0, 0, 0, 0)' && style.borderTopWidth==='1px';
  })),'Open groups have green dots; empty groups have hollow rings');
  await page.screenshot({path:`${import.meta.dir}/design-evidence/overview-to-workspace-${width}.png`});
  await page.reload();await page.getByRole('listbox').waitFor();assert(await page.locator('.editor-root').getAttribute('data-view')==='workspace','Workspace preference restores');
  await page.evaluate(()=>editorMock.command({command:'view',value:'overview'}));await page.locator('.layer-reading h1').waitFor();
  if(width===560)await page.getByLabel('Choose layer').selectOption('overview:0');else await page.locator('.layer-index').getByRole('button',{name:'Research —',exact:true}).click();
  await page.getByRole('heading',{name:'Research',exact:true}).waitFor();assert(await page.getByText('No windows are open.',{exact:true}).isVisible(),'Empty layer data');
  assert(errors.length===0,errors.join('\n'));console.log(`PASS Overview ${width}: default, real counts, responsive picker, open panel, stable source, persisted view`);await page.close();
 }
}finally{await browser.close();}
