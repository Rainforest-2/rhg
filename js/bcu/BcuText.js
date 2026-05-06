export function normalizeBcuText(text){return text.replace(/^\uFEFF/,"").replace(/\r\n?/g,"\n");}
const textCache=new Map();
export async function fetchBcuText(url){if(textCache.has(url))return await textCache.get(url);const p=(async()=>{const res=await fetch(url);if(!res.ok) throw new Error(`HTTP ${res.status} ${url}`);return normalizeBcuText(await res.text());})();textCache.set(url,p);try{return await p;}catch(e){textCache.delete(url);throw e;}}
export function __getBcuTextCache(){return textCache;}
