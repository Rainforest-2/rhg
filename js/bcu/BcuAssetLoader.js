import { fetchBcuText } from './BcuText.js';
import { parseImgcut } from './BcuImgcutParser.js';
import { parseModel } from './BcuModelParser.js';
import { parseAnim } from './BcuAnimParser.js';
const cache=new Map();
function loadImage(url){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>res(img);img.onerror=()=>rej(new Error(`Image load failed: ${url}`));img.src=url;});}
export class BcuAssetLoader{async loadAssetSet(def){if(cache.has(def.id)) return cache.get(def.id); const r={errors:[],loaded:[]}; const j=(f)=>`${def.baseDir}${f}`; try{r.image=await loadImage(j(def.image));r.loaded.push(def.image);}catch(e){r.errors.push(String(e.message));}
try{r.imgcut=parseImgcut(await fetchBcuText(j(def.imgcut)));r.loaded.push(def.imgcut);}catch(e){r.errors.push(`${def.imgcut}: ${e.message}`);} try{r.model=parseModel(await fetchBcuText(j(def.model)));r.loaded.push(def.model);}catch(e){r.errors.push(`${def.model}: ${e.message}`);} cache.set(def.id,r); return r;}
async loadAnimation(def,animDef){try{return {anim:parseAnim(await fetchBcuText(`${def.baseDir}${animDef.file}`)),error:null};}catch(e){return {anim:null,error:`${animDef.file}: ${e.message}`};}}
}
