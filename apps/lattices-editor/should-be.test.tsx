import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {ShouldBe} from './should-be';
import {pass2Fixture} from './mock-pass2';
import {layoutStatus,notOpenTargets,placementWords,validLayout} from './should-be-data';
import {validateProjection} from './model';
test('native layout wire validates, including unknown and secondary targets',()=>{
 const {projection:p,text}=pass2Fixture(1),l=p.groups[0].layout!;validateProjection(p,text);
 expect(validLayout(l)).toBe(true);expect(notOpenTargets(l).map(t=>t.entryIndex)).toEqual([3]);
 l.openTargets[0]={...l.openTargets[0],unitFrame:null,frame:null,displayId:null,status:'wontMove',reason:'explicit placement unavailable',ambiguous:true};
 expect(validLayout(l)).toBe(true);delete l.openTargets[0].reason;expect(validLayout(l)).toBe(false);
});
test('placement descriptions and status never turn wontMove into In place',()=>{
 const l=pass2Fixture(1).projection.groups[0].layout!;
 expect(placementWords({x:.3,y:.5,w:.4,h:.5})).toBe('middle 40%, bottom');expect(placementWords(null)).toBe('Position unavailable');
 expect(layoutStatus(l)).toBe("2 of 3 out of place · 1 won't move");
 l.openTargets=l.openTargets.filter(t=>t.status==='wontMove');expect(layoutStatus(l)).toBe("1 won't move");
});
test('unavailable and none stay distinct; historical positions never drawn',()=>{
 const p=pass2Fixture(1).projection,g=p.groups[0];delete g.layout;g.rows=g.rows.map(r=>({...r,frameSource:'lastKnown'}));
 const html=renderToStaticMarkup(<ShouldBe projection={p} group={g} onSource={()=>{}}/>);
 expect(html).toContain('Layout information is unavailable');expect(html).toContain('3 windows have no live position');expect(html).not.toContain('layout-window lit');
});
test('open targets preserve multiple members of one entry and nullable explicit slots',()=>{
 const p=pass2Fixture(1).projection,g=p.groups[0],l=g.layout!;
 l.openTargets[1].entryIndex=0;l.openTargets[1].entryKey=l.openTargets[0].entryKey;
 l.openTargets[2]={...l.openTargets[2],frame:null,unitFrame:null,displayId:null,reason:'explicit placement unavailable'};
 const html=renderToStaticMarkup(<ShouldBe projection={p} group={g} onSource={()=>{}}/>);
 expect(html).toContain('EditorBridge.swift');expect(html).toContain('explicit placement unavailable');expect(html).toContain('Position unavailable');
});
test('layout identities cannot fabricate members or canonical rules',()=>{
 const {projection:p,text}=pass2Fixture(1);p.groups[0].layout!.openTargets[0].windowId=999;
 expect(()=>validateProjection(p,text)).toThrow('Invalid layout window identity');
 p.groups[0].layout!.openTargets[0].windowId=1;p.groups[0].layout!.allTargets[0].entryIndex=999;
 expect(()=>validateProjection(p,text)).toThrow('Invalid layout entry identity');
});
test('unopened rule app uses native appEquals or outer app with nested predicates',async()=>{
 const {overviewFacts}=await import('./overview-data');const p=pass2Fixture(1).projection;
 p.entries[3].canonical=JSON.stringify({match:{appEquals:'Notes',titleContains:'Layout notes'}});
 expect(overviewFacts(p,'lattices').rules[3].app).toBe('Notes');
 p.entries[3].canonical=JSON.stringify({app:'Notes',match:{titleContains:'Layout notes'}});
 expect(overviewFacts(p,'lattices').rules[3].app).toBe('Notes');
});
