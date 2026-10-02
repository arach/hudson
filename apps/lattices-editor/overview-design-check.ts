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
  await page.screenshot({path:`${import.meta.dir}/design-evidence/overview-to-workspace-${width}.png`});
  await page.reload();await page.getByRole('listbox').waitFor();assert(await page.locator('.editor-root').getAttribute('data-view')==='workspace','Workspace preference restores');
  await page.evaluate(()=>editorMock.command({command:'view',value:'overview'}));await page.locator('.layer-reading h1').waitFor();
  if(width===560)await page.getByLabel('Choose layer').selectOption('overview:0');else await page.locator('.layer-index').getByRole('button',{name:'Research —',exact:true}).click();
  await page.getByRole('heading',{name:'Research',exact:true}).waitFor();assert(await page.getByText('No windows are open.',{exact:true}).isVisible(),'Empty layer data');
  assert(errors.length===0,errors.join('\n'));console.log(`PASS Overview ${width}: default, real counts, responsive picker, open panel, stable source, persisted view`);await page.close();
 }
}finally{await browser.close();}
