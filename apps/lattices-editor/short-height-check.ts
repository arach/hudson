import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import type { createMockTransport } from './mock';
declare global { var editorMock: ReturnType<typeof createMockTransport>; }
const browser=await chromium.launch({executablePath:process.env.EDITOR_BROWSER_EXECUTABLE??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const url=pathToFileURL(`${import.meta.dir}/dist-dev/index.html`).href+'?mock=1&host=1&overviewfixture=1';
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m);};
try {
 for(const [width,height] of [[1280,650],[1280,820],[560,650]]) {
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  await page.goto(url);await page.locator('.layer-reading h1').waitFor();await page.evaluate(()=>document.fonts.ready);
  await page.locator('[aria-label="Development mock controls"]').evaluate(el=>(el as HTMLElement).style.visibility='hidden');
  const bounds=()=>page.evaluate(()=>{
   const c=document.querySelector('.overview-chat')!.getBoundingClientRect(), r=document.querySelector('.overview-content')!.getBoundingClientRect();
   const send=document.querySelector('.overview-chat [data-action=send]')!.getBoundingClientRect();
   return {top:c.top,bottom:c.bottom,contentBottom:r.bottom,sendBottom:send.bottom};
  });
  const b=await bounds();assert(b.bottom<=height&&b.top>=0&&b.contentBottom<=b.top,'Overview composer visible without overlap');assert(b.sendBottom<=height,'Overview send fully inside');
  await page.locator('.overview-content').evaluate(el=>{el.scrollTop=el.scrollHeight;});const after=await bounds();assert(Math.abs(after.top-b.top)<1,'Composer does not move when reading scrolls');
  await page.locator('.overview-content').evaluate(el=>{el.scrollTop=0;});
  await page.screenshot({path:`${import.meta.dir}/design-evidence/overview-pinned-${width}x${height}.png`});
  if(width===1280&&height===650) {
   await page.evaluate(()=>{editorMock.command({command:'view',value:'workspace'});editorMock.command({command:'togglePanel',value:'source'});editorMock.command({command:'togglePanel',value:'history'});editorMock.command({command:'arrangement',value:'grid'});});
   await page.getByRole('listbox').waitFor();
   // Equal grid rows at 580px reproduce a roughly 290px Chat panel.
   await page.setViewportSize({width:1280,height:580});
   const before=await page.locator('[data-panel-id=chat]').evaluate(el=>{const panel=el.getBoundingClientRect(),composer=el.querySelector('.composer-host')!.getBoundingClientRect(),send=el.querySelector('[data-action=send]')!.getBoundingClientRect();return {bottom:panel.bottom,composerTop:composer.top,composerBottom:composer.bottom,sendBottom:send.bottom};});
   assert(before.composerBottom<=before.bottom&&before.sendBottom<=before.bottom,'Workspace input and send fully fit 290px Chat');
   await page.locator('.context-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight;});
   assert(await page.locator('.composer-host').evaluate(el=>el.getBoundingClientRect().top)===before.composerTop,'Try scrolling does not move input');
   await page.screenshot({path:`${import.meta.dir}/design-evidence/workspace-chat-290-scrolled.png`});
   await page.locator('.context-scroll').evaluate(el=>{el.scrollTop=0;});
   await page.screenshot({path:`${import.meta.dir}/design-evidence/workspace-chat-290.png`});
  }
  console.log(`PASS pinned composers ${width}x${height}`);await page.close();
 }
}finally{await browser.close();}
