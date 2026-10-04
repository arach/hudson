import {expect,test} from 'bun:test';
import {createActionGuard,equalNativeData} from './action-guard';
test('context changes and cancellation invalidate plans; confirmation is single-use',()=>{
 const gate=createActionGuard();gate.context('layer:a/revision:1/overview');const first=gate.begin();
 expect(gate.accepts(first)).toBe(true);gate.context('layer:b/revision:1/overview');expect(gate.consume(first)).toBe(false);
 const second=gate.begin();gate.cancel();expect(gate.consume(second)).toBe(false);
 const third=gate.begin();expect(gate.consume(third)).toBe(true);expect(gate.consume(third)).toBe(false);
});
test('unchanged context does not invalidate; a later explicit plan supersedes older replies',()=>{
 const gate=createActionGuard();gate.context('same');const first=gate.begin();expect(gate.context('same')).toBe(false);expect(gate.accepts(first)).toBe(true);
 const next=gate.begin();expect(gate.accepts(first)).toBe(false);expect(gate.accepts(next)).toBe(true);
});
test('native dedupe ignores object key order, preserves ordered messages and detects changes',()=>{
 expect(equalNativeData({messages:[{id:'1',text:'hello'}],isSending:false},{isSending:false,messages:[{text:'hello',id:'1'}]})).toBe(true);
 expect(equalNativeData({counts:{restored:1}},{counts:{restored:2}})).toBe(false);
 expect(equalNativeData([1,2],[2,1])).toBe(false);
});
