export function normalizeBcuText(text){return text.replace(/^\uFEFF/,"").replace(/\r\n?/g,"\n");}
export async function fetchBcuText(url){const res=await fetch(url);if(!res.ok) throw new Error(`HTTP ${res.status} ${url}`);return normalizeBcuText(await res.text());}
