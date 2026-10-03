import type { Projection } from './model';
/** Development-only three-display fixture. Never used as a native fallback. */
export function pass2Fixture(version:number) {
 const layers=[{id:'lattices',name:'Lattices',projects:[{app:'Ghostty',title:'mini: lattices'},{app:'Xcode',title:'Lattices'},{app:'Safari',title:'Window management'},{app:'Notes',title:'Layout notes'}]},
 {id:'scout',name:'Scout',projects:[{app:'Ghostty',title:'scout'},{app:'Safari',title:'Scout dashboard'}]},
 {id:'fab',name:'fab',projects:[{app:'Ghostty',title:'fab'}]}];
 const text=JSON.stringify({layers},null,2);
 const entries=layers.flatMap(layer=>layer.projects.map((project,index)=>{const needle=JSON.stringify(project,null,2).split('\n').map((s,i)=>i?'        '+s:s).join('\n');const from=text.indexOf(needle);if(from<0)throw Error('Pass2 source fixture');return {key:`${layer.id}:${index}`,layerId:layer.id,canonical:JSON.stringify(project),ambiguous:false,ranges:[{from,to:from+needle.length}]};}));
 const projection:Projection={snapshotId:`mock:pass2:${version}`,entries,displays:[
 {id:'2',name:'2',main:false,frame:{x:-1920,y:0,w:1920,h:1080}},
 {id:'1',name:'1',main:true,frame:{x:0,y:0,w:1440,h:900}},
 {id:'3',name:'3',main:false,frame:{x:1440,y:0,w:1080,h:1920}}],groups:[
 {id:'lattices',label:'Lattices',rows:[
 {id:'lattices:1',windowId:1,app:'Ghostty',title:'mini: lattices',layerId:'lattices',entryKeys:['lattices:0'],matchedRule:0,frameSource:'live',displayId:'2',frame:{x:-1600,y:180,w:1000,h:720}},
 {id:'lattices:2',windowId:2,app:'Xcode',title:'Lattices — EditorBridge.swift',layerId:'lattices',entryKeys:['lattices:1'],matchedRule:1,frameSource:'live',displayId:'1',frame:{x:480,y:24,w:480,h:856}},
 {id:'lattices:3',windowId:3,app:'Safari',title:'Window management reference',layerId:'lattices',entryKeys:['lattices:2'],matchedRule:2,frameSource:'live',displayId:'3',frame:{x:1480,y:180,w:900,h:900}}],preview:{layout:'columns',displayId:'1',frames:[{windowId:1,frame:{x:0,y:24,w:480,h:856}},{windowId:2,frame:{x:480,y:24,w:480,h:856}},{windowId:3,frame:{x:960,y:24,w:480,h:856}}]}},
 {id:'scout',label:'Scout',rows:[]},
 {id:'fab',label:'fab',rows:[{id:'fab:4',windowId:4,app:'Ghostty',title:'fab',layerId:'fab',entryKeys:['fab:0'],matchedRule:0,frameSource:'live',displayId:'2',frame:{x:-1820,y:40,w:700,h:600}}]},
 {id:'__unassigned__',label:'Unassigned',rows:[{id:'unassigned:5',windowId:5,app:'Mail',title:'Inbox',layerId:null,entryKeys:[],matchedRule:null,frameSource:'live',displayId:'1',frame:{x:160,y:130,w:720,h:580}}]}]};
 return {text,projection};
}
