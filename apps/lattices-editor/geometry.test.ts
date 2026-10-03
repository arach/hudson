import {expect,test} from 'bun:test';
import {pass2Fixture} from './mock-pass2';
import {changeLabel,currentFrame,displayBounds,matchedEntry,positionLabel,validFrame} from './geometry';
import {validateProjection} from './model';
test('real geometry fixture uses source ranges and global display bounds',()=>{
 const {projection:p,text}=pass2Fixture(1);validateProjection(p,text);
 expect(displayBounds(p.displays!)).toEqual({x:-1920,y:0,w:4440,h:1920});
 expect(matchedEntry(p,p.groups[0].rows[0])?.key).toBe('lattices:0');
 expect(matchedEntry(p,{...p.groups[0].rows[0],matchedRule:null})).toBeUndefined();
 expect(validFrame({x:0,y:0,w:0,h:100})).toBe(false);
});
test('provenance never presents historical/unknown positions as measured Now',()=>{
 const p=pass2Fixture(1).projection,g=p.groups[0],r=g.rows[0],target=g.preview!.frames[0].frame;
 expect(changeLabel(r,target)).toBe('Moves');expect(changeLabel(g.rows[1],g.preview!.frames[1].frame)).toBe('Stays');
 expect(changeLabel(r)).toBeNull();
 for(const frameSource of ['lastKnown','savedHome','unavailable',undefined] as const)expect(changeLabel({...r,frameSource},target)).toBeNull();
 expect(positionLabel({...r,frameSource:'lastKnown'})).toBe('Last known');expect(positionLabel({...r,frameSource:undefined})).toBe('Position');
 expect(currentFrame({...r,frameSource:'unavailable'})).toBeUndefined();
});

test('polished displays preserve relative physical size and align bottoms without changing host frames', async()=>{
 const {displayScene}=await import('./geometry');const displays=pass2Fixture(1).projection.displays!;const before=JSON.stringify(displays);
 const scene=displayScene(displays);expect(scene).toHaveLength(3);
 expect(new Set(scene.map(d=>d.y+d.h)).size).toBe(1);
 for(const item of scene)expect(item.w/item.h).toBeCloseTo(item.display.frame.w/item.display.frame.h);
 expect(JSON.stringify(displays)).toBe(before);
});
test('Waiting section is backed only by materialized unmatched source rules',async()=>{
 const {overviewFacts,waitingRules}=await import('./overview-data');const p=pass2Fixture(1).projection;
 const rules=overviewFacts(p,'lattices').rules;expect(waitingRules(rules).map(r=>r.app)).toEqual(['Notes']);
 expect(waitingRules(rules.map(r=>({...r,open:1})))).toEqual([]);
 expect(waitingRules(rules.map(r=>({...r,occurrences:0})))).toEqual([]);
});

test('Now never draws a historical frame as a live current position',async()=>{
 const {renderToStaticMarkup}=await import('react-dom/server');const {createElement}=await import('react');const {DisplayMap}=await import('./display-map');
 const p=pass2Fixture(1).projection;const rows=p.groups[0].rows;
 for(const frameSource of ['lastKnown','savedHome',undefined] as const){
  const historical={...rows[0],frameSource};const projection={...p,groups:[{...p.groups[0],rows:[historical]}]};
  const html=renderToStaticMarkup(createElement(DisplayMap,{projection,rows:[historical],mode:'now'}));
  expect(html.includes('class="window-current"')).toBe(false);expect(html.includes('1 without live positions')).toBe(true);
 }
});
