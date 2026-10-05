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
 {id:'1',name:'1',main:true,frame:{x:0,y:0,w:3440,h:1440}},
 {id:'3',name:'3',main:false,frame:{x:3440,y:0,w:1080,h:1920}}],groups:[
 {id:'lattices',label:'Lattices',rows:[
 {id:'lattices:1',windowId:1,app:'Ghostty',title:'mini: lattices',layerId:'lattices',entryKeys:['lattices:0'],matchedRule:0,frameSource:'live',displayId:'1',frame:{x:1400,y:180,w:1400,h:900}},
 {id:'lattices:2',windowId:2,app:'Xcode',title:'Lattices — EditorBridge.swift',layerId:'lattices',entryKeys:['lattices:1'],matchedRule:1,frameSource:'live',displayId:'1',frame:{x:480,y:24,w:480,h:856}},
 {id:'lattices:3',windowId:3,app:'Safari',title:'Window management reference',layerId:'lattices',entryKeys:['lattices:2'],matchedRule:2,frameSource:'live',displayId:'1',frame:{x:1800,y:320,w:1300,h:900}}],preview:{layout:'columns',displayId:'1',frames:[{windowId:1,frame:{x:0,y:24,w:480,h:856}},{windowId:2,frame:{x:480,y:24,w:480,h:856}},{windowId:3,frame:{x:960,y:24,w:480,h:856}}]}},
 {id:'scout',label:'Scout',rows:[]},
 {id:'fab',label:'fab',rows:[{id:'fab:4',windowId:4,app:'Ghostty',title:'fab',layerId:'fab',entryKeys:['fab:0'],matchedRule:0,frameSource:'live',displayId:'2',frame:{x:-1820,y:40,w:700,h:600}}]},
 {id:'__unassigned__',label:'Unassigned',rows:[{id:'unassigned:5',windowId:5,app:'Mail',title:'Inbox',layerId:null,entryKeys:[],matchedRule:null,frameSource:'live',displayId:'1',frame:{x:160,y:130,w:720,h:580}}]}]};
 const g=projection.groups[0];
 const visibleFrame={x:0,y:24,w:3440,h:1396};
 const absolute=(f:{x:number;y:number;w:number;h:number})=>({x:f.x*3440,y:24+f.y*1396,w:f.w*3440,h:f.h*1396});
 const boxes=[{x:0,y:0,w:.5,h:.5},{x:0,y:.5,w:.5,h:.5},{x:.5,y:0,w:.5,h:1}];
 g.layout={kind:'auto',displayId:'1',visibleFrame,lanes:{open:[{x:0,w:.5,label:'Terminals & editors'},{x:.5,w:.5,label:'Other apps'}],all:[{x:0,w:.3,label:'Terminals'},{x:.3,w:.4,label:'Editors & design'},{x:.7,w:.3,label:'Other apps'}]},openTargets:g.rows.map((r,i)=>({windowId:r.windowId,entryIndex:i,entryKey:r.entryKeys[0],unitFrame:boxes[i],frame:absolute(boxes[i]),displayId:'1',status:i===2?'wontMove':'moves',reason:i===2?'on another desktop':undefined})),allTargets:[{x:0,y:0,w:.3,h:1},{x:.3,y:0,w:.4,h:.5},{x:.7,y:0,w:.3,h:1},{x:.3,y:.5,w:.4,h:.5}].map((f,i)=>({entryIndex:i,entryKey:'lattices:'+i,unitFrame:f,frame:absolute(f),displayId:'1'})),skipped:[]};
 projection.groups[1].layout={...g.layout,openTargets:[],allTargets:[],lanes:{open:[],all:[]}};
 projection.groups[2].layout={...g.layout,kind:'none',openTargets:[],allTargets:[],lanes:{open:[],all:[]}};
 return {text,projection};
}
