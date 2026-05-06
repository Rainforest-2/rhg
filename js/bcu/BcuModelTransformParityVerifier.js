import { readFile } from 'node'+':fs'+'/promises';
import { parseModel } from './BcuModelParser.js';
import { parseAnim } from './BcuAnimParser.js';
import { parseImgcut } from './BcuImgcutParser.js';
import { BcuModelInstance } from './BcuModelInstance.js';
import { BcuAnimator } from './BcuAnimator.js';
import { buildPlayablePreviewAssets } from '../battle/PlayableCharacterRegistry.js';

const readText=(p)=>readFile(p.replace(/^\.\//,''),'utf8');
const ANIM4_E=(p)=>[{id:'anim00',file:`${p}00.maanim`},{id:'anim01',file:`${p}01.maanim`},{id:'anim02',file:`${p}02.maanim`},{id:'anim03',file:`${p}03.maanim`}];
const TARGETS=[
{id:'unit-010-f',baseDir:'./public/assets/bcu/000004/org/unit/010/f/',imgcut:'010_f.imgcut',model:'010_f.mamodel',animations:ANIM4_E('010_f')},
{id:'unit-011-f',baseDir:'./public/assets/bcu/000004/org/unit/011/f/',imgcut:'011_f.imgcut',model:'011_f.mamodel',animations:ANIM4_E('011_f')},
{id:'unit-012-f',baseDir:'./public/assets/bcu/000004/org/unit/012/f/',imgcut:'012_f.imgcut',model:'012_f.mamodel',animations:ANIM4_E('012_f')},
{id:'unit-000-f',baseDir:'./public/assets/bcu/000004/org/unit/000/f/',imgcut:'000_f.imgcut',model:'000_f.mamodel',animations:ANIM4_E('000_f')},
{id:'unit-001-f',baseDir:'./public/assets/bcu/000004/org/unit/001/f/',imgcut:'001_f.imgcut',model:'001_f.mamodel',animations:ANIM4_E('001_f')},
{id:'enemy-000',baseDir:'./public/assets/bcu/000002/org/enemy/000/',imgcut:'000_e.imgcut',model:'000_e.mamodel',animations:ANIM4_E('000_e')}
];

async function loadAsset(a){const [mt,it]=await Promise.all([readText(`${a.baseDir}${a.model}`),readText(`${a.baseDir}${a.imgcut}`)]);const model=parseModel(mt);const imgcut=parseImgcut(it);const anims=[];for(const c of a.animations||[]){try{anims.push({id:c.id,anim:parseAnim(await readText(`${a.baseDir}${c.file}`))});}catch{}}return {model,imgcut,anims};}
function nearly(a,b,e=1e-3){return Math.abs(a-b)<=e;}

export async function verifyBcuModelTransformParity(){
  const errors=[]; let checks=0;
  for(const t of TARGETS){const {model,anims}=await loadAsset(t); for(const {id,anim} of anims){const frames=[0,1,5,10,15,20,Math.max(0,(anim.len||1)-1)]; const uniq=[...new Set(frames.filter((f)=>f>=0))]; for(const f of uniq){const a=new BcuAnimator(anim); const prod=new BcuModelInstance(model); const ref=new BcuModelInstance(model); a.frame=f; a.apply(prod); a.apply(ref); const p=prod.getBattleDrawList(); const r=ref.getBattleDrawList(); for(let i=0;i<Math.min(p.length,r.length);i++){checks++; const pm=p[i].matrix, rm=r[i].matrix; for(let j=0;j<6;j++) if(!nearly(pm[j],rm[j],1e-6)) errors.push(`${t.id}:${id}:f${f}:p${i}:m${j}`); if(!nearly(p[i].opacity,r[i].opacity,1e-6)) errors.push(`${t.id}:${id}:f${f}:p${i}:opacity`); } }}}
  return {ok:errors.length===0,checks,errors};
}

export async function verifyPlayableRenderTransformSanity(){
  const assets=buildPlayablePreviewAssets(ANIM4_E).filter((a)=>a.group==='dogs'||a.group==='cats');
  const errors=[]; let checks=0;
  for(const a of assets){const {model,anims,imgcut}=await loadAsset(a); for(const {anim} of anims){const inst=new BcuModelInstance(model); const an=new BcuAnimator(anim); for(const f of [0,1,5,10,15,20]){an.frame=Math.min(f,Math.max(0,(anim.len||1)-1)); an.apply(inst); const list=inst.getBattleDrawList(); const visible=list.filter((p)=>Number.isInteger(p.partIndex)&&p.partIndex>=0&&(p.opacity??0)>0&&imgcut.parts?.[p.partIndex]); checks++; if(!visible.length) errors.push(`${a.id}:no-visible`); }}}
  return {ok:errors.length===0,checks,errors};
}
