import { convertBcuDistanceToWorld } from './BcuKnockbackSpec.js';
const ok=(details={})=>({ok:true,errors:[],details}); const ng=(...errors)=>({ok:false,errors});
export async function verifyHpKbTimeline(){ const dist=convertBcuDistanceToWorld(345); if(dist!==345) return ng('expected 345 world'); const actor={hp:100,x:500}; actor.hp-=20; actor.x-=dist; return actor.x===155?ok({distance:dist}):ng('actor kb simulation failed'); }
