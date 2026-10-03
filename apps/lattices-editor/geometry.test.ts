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
