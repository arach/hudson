/** Local confirmation gate. It cannot execute anything; callers supply effects only
 * after a second explicit user gesture. Context changes invalidate pending plans. */
export function createActionGuard() {
  let generation=0, context='', confirmed=false;
  return {
    context(next:string) { if(next===context)return false;context=next;generation++;confirmed=false;return true; },
    begin() { generation++;confirmed=false;return generation; },
    accepts(ticket:number) { return ticket===generation&&!confirmed; },
    consume(ticket:number) { if(ticket!==generation||confirmed)return false;confirmed=true;return true; },
    cancel() { generation++;confirmed=false; },
  };
}
/** Preserve snapshots and subscriber silence for repeated native events. */
export function equalNativeData(a:unknown,b:unknown):boolean {
 if(Object.is(a,b))return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>equalNativeData(v,b[i]));
 const x=a as Record<string,unknown>,y=b as Record<string,unknown>,keys=Object.keys(x);
 return keys.length===Object.keys(y).length&&keys.every(k=>Object.hasOwn(y,k)&&equalNativeData(x[k],y[k]));
}
