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
  const headingStyle=()=>page.locator(".layer-reading h1").evaluate(el=>{const s=getComputedStyle(el);return {family:s.fontFamily,size:s.fontSize,weight:s.fontWeight,line:s.lineHeight,tracking:s.letterSpacing};});
  const heading=await headingStyle();
  assert(heading.size==="28px"&&heading.weight==="600"&&heading.family.includes("SF Pro Display")&&Math.abs(parseFloat(heading.line)-30.8)<.1&&Math.abs(parseFloat(heading.tracking)+.42)<.01,"Overview uses specified UI heading typography");
  assert(await page.locator(".layer-reading h1").innerText()==="All windows","Missing host seed defaults All windows");
  if(width===1280) {
    await page.screenshot({path:import.meta.dir+"/design-evidence/desk-all-1280.png"});
    await page.locator(".layer-index nav button").first().click();
    await page.getByRole("heading",{name:"Build 1",exact:true}).waitFor();
    await page.screenshot({path:import.meta.dir+"/design-evidence/desk-layer-1280.png"});
    await page.locator(".layer-index nav button").nth(1).click({modifiers:["Meta"]});
    await page.getByRole("heading",{name:"2 layers",exact:true}).waitFor();
    assert(await page.locator(".layer-index nav button[aria-pressed=true]").count()===2,"Cmd-click keeps both layers");
    await page.waitForFunction(()=>JSON.stringify((editorMock.uiStates.at(-1) as {selectedLayerIds:string[]}).selectedLayerIds)===JSON.stringify(["build","overview:0"]));
    await page.screenshot({path:import.meta.dir+"/design-evidence/desk-multi-1280.png"});
  }
  await page.evaluate(()=>editorMock.command({command:"selectLayers",value:["build"]}));
  await page.getByRole("heading",{name:"Build 1",exact:true}).waitFor();
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
  if(width===560)await page.getByLabel("Choose layer").selectOption("unassigned");else await page.locator(".unassigned-index button").click();
  await page.getByRole("heading",{name:"Unassigned",exact:true}).waitFor();
  assert(JSON.stringify(await headingStyle())===JSON.stringify(heading),"Unassigned uses identical UI typography");
  assert(errors.length===0,errors.join('\n'));console.log(`PASS Overview ${width}: default, real counts, responsive picker, open panel, stable source, persisted view`);await page.close();
 }
}finally{await browser.close();}
