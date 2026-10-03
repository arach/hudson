import {chromium} from 'playwright';
import {pathToFileURL} from 'node:url';
import type {createMockTransport} from './mock';
declare global {var editorMock:ReturnType<typeof createMockTransport>;}
const browser=await chromium.launch({executablePath:process.env.EDITOR_BROWSER_EXECUTABLE??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m);};
try{for(const width of [1280,560]){
 const page=await browser.newPage({viewport:{width,height:820},reducedMotion:'reduce'});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(import.meta.dir+'/dist-dev/index.html').href+'?mock&host&pass2');await page.getByRole('heading',{name:'Lattices',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
 await page.locator('[aria-label="Development mock controls"]').evaluate(el=>(el as HTMLElement).style.visibility='hidden');
 assert(await page.locator('.display-map').isVisible()===(width===1280),'Responsive current map');
 assert(await page.locator('.overview-window-table tbody tr').count()===3,'Three layer windows');
 assert(await page.locator('.waiting-rules li').count()===1,'Unmatched rule waits');
 await page.screenshot({path:`${import.meta.dir}/design-evidence/pass2-overview-${width}.png`});
 await page.screenshot({path:`${import.meta.dir}/design-evidence/polish-layer-${width}.png`});
 if(width===1280){await page.locator('.waiting-rules').scrollIntoViewIfNeeded();await page.screenshot({path:import.meta.dir+'/design-evidence/polish-layer-waiting-1280.png'});await page.locator('.overview-content').evaluate(el=>el.scrollTop=0);}
 await page.getByRole('button',{name:'Preview layout',exact:true}).click();await page.getByRole('heading',{name:'Where Lattices would go'}).waitFor();
 assert(await page.locator('.layout-stage').isVisible()===(width===1280),'Responsive stage');
 assert(await page.locator('.move-tag.moves').count()===2&&await page.locator('.move-tag.stays').count()===1,'Actual live movement comparison');
 if(width===1280)await page.screenshot({path:import.meta.dir+'/design-evidence/polish-preview-now-1280.png'});
 assert(await page.getByRole('button',{name:'Now',exact:true,includeHidden:true}).getAttribute('aria-pressed')==='true','Now is initial view');
 if(width===1280){
 const bridgeCalls=await page.evaluate(()=>[...editorMock.calls]);
 await page.getByRole('button',{name:'Would go',exact:true,includeHidden:true}).click();
 assert(JSON.stringify(await page.evaluate(()=>editorMock.calls))===JSON.stringify(bridgeCalls),'Toggle has no host effects');
 assert(await page.locator('.window-proposed').count()===3,'Targets come from native frames');
 assert(await page.locator('.window-now').count()===2,'Changed live spots are dashed');
 if(width===1280){await page.screenshot({path:import.meta.dir+'/design-evidence/pass2-preview-1280.png'});await page.screenshot({path:import.meta.dir+'/design-evidence/polish-preview-would-go-1280.png'});}
 }else{assert(!await page.locator('.arrangement-toggle').isVisible(),'Hidden stage has no dead toggle');}
 await page.getByRole('button',{name:'Done',exact:true}).click();
 await page.evaluate(()=>editorMock.command({command:'selectLayers',value:['scout']}));await page.getByRole('heading',{name:'Scout',exact:true}).waitFor();
 assert(await page.getByRole('button',{name:'Preview layout',exact:true}).isDisabled(),'Empty layer cannot preview');assert(await page.locator('.waiting-rules li').count()===2,'Empty layer waiting rules');
 if(width===1280)await page.screenshot({path:`${import.meta.dir}/design-evidence/pass2-empty-1280.png`});
 await page.evaluate(()=>editorMock.command({command:'selectLayers',value:['__unassigned__']}));await page.getByRole('heading',{name:'Unassigned',exact:true}).waitFor();
 assert(await page.locator('.window-white').count()===1,'Unassigned white map position');
 if(width===1280)await page.screenshot({path:`${import.meta.dir}/design-evidence/pass2-unassigned-1280.png`});
 await page.evaluate(()=>editorMock.command({command:'selectLayers',value:['fab']}));await page.getByRole('heading',{name:'fab',exact:true}).waitFor();assert(await page.locator('.waiting-rules').count()===0,'No empty waiting heading');await page.getByRole('button',{name:'Preview layout',exact:true}).click();
 assert(await page.locator('.preview-unavailable').isVisible(),'No eligible native preview honest fallback');assert(await page.getByRole('button',{name:'Would go',exact:true,includeHidden:true}).isDisabled(),'No targets disables toggle');assert(await page.locator('.layout-stage').getAttribute('data-mode')==='now','Absent targets retain Now');assert(await page.locator('.move-tag').count()===0,'No invented Stays');
 assert(errors.length===0,errors.join('\n'));console.log(`PASS Pass2 ${width}: maps, rules, empty, unassigned, pure preview, unavailable`);await page.close();
}}finally{await browser.close();}
