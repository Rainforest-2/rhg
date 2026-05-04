import { parseImgCut } from '../bcu/BcuImgCutParser.js';

async function fetchText(path){const r=await fetch(path); if(!r.ok) throw new Error(path); return await r.text();}
async function loadImage(path){return await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=path;});}

export class BattleEffectLoader {
  async loadHitEffect(){
    const image = await loadImage('./public/assets/bcu/000001/org/battle/a/000_a.png');
    const imgcut = parseImgCut(await fetchText('./public/assets/bcu/000001/org/battle/a/000_a.imgcut'));
    const parts = (imgcut.parts||[]).filter((p)=>String(p.name||'').includes('ヒットエフェクト')&&String(p.name||'').includes('爆発'));
    if (!parts.length) { console.warn('[BattleEffectLoader] hit effect parts missing'); return { image, parts: [] }; }
    return { image, parts };
  }
}
