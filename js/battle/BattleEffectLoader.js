import { parseImgcut } from '../bcu/BcuImgcutParser.js';

async function fetchText(path){const r=await fetch(path); if(!r.ok) throw new Error(path); return await r.text();}
async function loadImage(path){return await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=path;});}

export class BattleEffectLoader {
  async loadHitEffect(){
    try {
      const image = await loadImage('./public/assets/bcu/000001/org/battle/a/000_a.png');
      const imgcut = parseImgcut(await fetchText('./public/assets/bcu/000001/org/battle/a/000_a.imgcut'));
      const parts = (imgcut.parts||[]).filter((p)=>String(p.name||'').includes('ヒットエフェクト')&&String(p.name||'').includes('爆発'));
      if (!parts.length) {
        const reason = 'hit effect parts missing';
        console.warn('[BattleEffectLoader] hit effect disabled:', reason);
        return { image: null, parts: [], loaded: false, reason };
      }
      return { image, parts, loaded: true, reason: '' };
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.warn('[BattleEffectLoader] hit effect disabled:', reason);
      return { image: null, parts: [], loaded: false, reason };
    }
  }
}
