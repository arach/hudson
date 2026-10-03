import {chromium} from 'playwright';
import {pathToFileURL} from 'node:url';
import type {createMockTransport} from './mock';
declare global {var editorMock:ReturnType<typeof createMockTransport>;}
const browser=await chromium.launch({executablePath:process.env.EDITOR_BROWSER_EXECUTABLE??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m);};
try{for(const width of [1280,560]){
 const page=await browser.newPage({viewport:{width,height:width===1280?1200:820},reducedMotion:'reduce'});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(import.meta.dir+'/dist-dev/index.html').href+'?mock&host&pass2');await page.getByRole('heading',{name:'Lattices',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
 await page.locator('[aria-label="Development mock controls"]').evaluate(el=>(el as HTMLElement).style.visibility='hidden');
 assert(await page.getByRole('button',{name:'Should be',exact:true}).getAttribute('aria-pressed')==='true','Should be defaults');
 assert(await page.locator('.layout-window.lit').count()===3,'Native targets include wontMove');
 assert(await page.locator('.layout-rules tbody tr').count()===4,'Open windows plus unopened rule');
 assert((await page.locator('.layout-rules').innerText()).includes('on another desktop'),'Native exclusion reason');
 assert(await page.getByRole('button',{name:'Preview layout',exact:true}).count()===0,'Separate preview removed');
 await page.locator('.overview-content').evaluate(el=>el.scrollTop=0);
 await page.screenshot({path:`${import.meta.dir}/design-evidence/should-be-${width}.png`});
 const calls=await page.evaluate(()=>[...editorMock.calls]);
 await page.getByRole('checkbox',{name:'Show where they are now'}).uncheck();assert(await page.locator('.layout-window.was').count()===0,'Ghost toggle');

 await page.getByRole('checkbox',{name:'Include 1 not open'}).check();
 assert(await page.locator('.layout-window.not-open').count()===1,'Hatched unopened reservation');
 assert(!/Moves|Stays/.test(await page.locator('.layout-rules').innerText()),'Reservations never inherit statuses');
 await page.locator('.overview-content').evaluate(el=>el.scrollTop=0);
 await page.screenshot({path:`${import.meta.dir}/design-evidence/should-be-all-${width}.png`});
 await page.getByRole('button',{name:'Now',exact:true}).click();assert(await page.locator('.layout-window.was').count()===0,'Now has no ghosts');
 assert(await page.locator('.layout-window.lit').count()===3,'Live positions only');
 await page.locator('.overview-content').evaluate(el=>el.scrollTop=0);
 await page.screenshot({path:`${import.meta.dir}/design-evidence/should-be-now-${width}.png`});
 assert(JSON.stringify(await page.evaluate(()=>editorMock.calls))===JSON.stringify(calls),'All controls are local and read only');
 await page.evaluate(()=>editorMock.command({command:'selectLayers',value:['fab']}));await page.getByRole('heading',{name:'fab',exact:true}).waitFor();
 assert(await page.getByRole('button',{name:'Should be',exact:true}).isDisabled(),'None disables Should be');
 assert(await page.getByText('This layer leaves windows where they are.').isVisible(),'Explicit none copy');
 assert(errors.length===0,errors.join('\n'));console.log(`PASS Should be ${width}: target/Now/all, statuses, none, no effects`);await page.close();
}}finally{await browser.close();}
